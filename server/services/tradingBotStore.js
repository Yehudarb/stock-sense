import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { closePaperPosition, createPaperOrder, getPaperAccount } from './paperTradingStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const STORE_PATH = join(DATA_DIR, 'tradingBot.json')
const runtime = {
  storePath: STORE_PATH,
}

const DEFAULT_STATE = {
  mode: 'paper',
  botEnabled: false,
  liveTradingEnabled: false,
  userConfirmedLiveTrading: false,
  killSwitch: false,
  activeStrategy: 'signal_follow_demo',
  cooldownMinutes: 30,
  maxDailyLossPct: 3,
  maxRiskPerTradePct: 1,
  alertsEnabled: true,
  lastRunAt: null,
  lastActionAt: null,
  recentEvents: [],
  warnings: ['Live trading is disabled by default.'],
  updatedAt: null,
}

function timestamp() {
  return new Date().toISOString()
}

function ensureDataDir() {
  const dir = dirname(runtime.storePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadState() {
  try {
    if (!existsSync(runtime.storePath)) return { ...DEFAULT_STATE, updatedAt: timestamp() }
    const parsed = JSON.parse(readFileSync(runtime.storePath, 'utf8'))
    return {
      ...DEFAULT_STATE,
      ...parsed,
      recentEvents: parsed.recentEvents ?? [],
      warnings: parsed.warnings ?? DEFAULT_STATE.warnings,
      updatedAt: parsed.updatedAt ?? timestamp(),
    }
  } catch {
    return { ...DEFAULT_STATE, updatedAt: timestamp() }
  }
}

function saveState(state) {
  ensureDataDir()
  const next = { ...state, updatedAt: timestamp() }
  writeFileSync(runtime.storePath, JSON.stringify(next, null, 2), 'utf8')
  return next
}

function liveTradingAllowedByEnv() {
  return (
    process.env.LIVE_TRADING_ENABLED === 'true' &&
    process.env.USER_CONFIRMED_LIVE_TRADING === 'true' &&
    !!process.env.BROKER_API_KEY &&
    !!process.env.BROKER_SECRET &&
    process.env.KILL_SWITCH !== 'true'
  )
}

function normalizeMode(value) {
  return ['backtest', 'paper', 'live'].includes(value) ? value : 'paper'
}

function buildWarnings(state) {
  const warnings = []
  if (state.mode === 'live') {
    warnings.push('Live trading requested, but it remains disabled until all safety flags are explicitly enabled.')
  }
  if (!state.botEnabled) warnings.push('Bot automation is currently disabled.')
  if (state.killSwitch) warnings.push('Kill switch is active. No automated trading actions should run.')
  if (!state.liveTradingEnabled) warnings.push('Live trading is disabled by default.')
  return warnings
}

function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase()
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return null
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

function appendEvent(state, event = {}) {
  const entry = {
    id: `bot_${Math.random().toString(36).slice(2, 11)}`,
    timestamp: timestamp(),
    level: event.level ?? 'info',
    eventType: event.eventType ?? 'bot_action',
    mode: state.mode,
    ticker: event.ticker ?? null,
    strategyId: event.strategyId ?? state.activeStrategy,
    orderId: event.orderId ?? null,
    message: event.message ?? '',
    metadata: event.metadata ?? {},
  }

  state.lastRunAt = entry.timestamp
  state.recentEvents.unshift(entry)
  state.recentEvents = state.recentEvents.slice(0, 40)
  return entry
}

function computeBotQuantity({
  price,
  stopLoss,
  equity,
  cash,
  side,
  botRiskPct,
  accountRiskPct,
  maxSymbolExposurePct,
}) {
  const currentPrice = Number(price)
  const stop = Number(stopLoss)
  const accountEquity = Number(equity)
  const effectiveRiskPct = Math.min(
    Number.isFinite(Number(botRiskPct)) ? Number(botRiskPct) : 1,
    Number.isFinite(Number(accountRiskPct)) ? Number(accountRiskPct) : 1,
  )

  if (!Number.isFinite(currentPrice) || !Number.isFinite(stop) || !Number.isFinite(accountEquity)) return 0
  if (currentPrice <= 0 || stop <= 0 || accountEquity <= 0) return 0

  const riskPerShare = Math.abs(currentPrice - stop)
  if (!riskPerShare) return 0

  const maxRiskAmount = accountEquity * (effectiveRiskPct / 100)
  const riskQuantity = Math.floor(maxRiskAmount / riskPerShare)
  const exposureQuantity = Math.floor((accountEquity * ((Number(maxSymbolExposurePct) || 100) / 100)) / currentPrice)
  const cashQuantity = side === 'long' ? Math.floor((Number(cash) || 0) / currentPrice) : Number.POSITIVE_INFINITY

  return Math.max(0, Math.min(riskQuantity, exposureQuantity, cashQuantity))
}

function deriveProtectiveLevels({ side, decision, currentPrice }) {
  const marketPrice = Number(currentPrice)
  const invalidation = Number(decision?.invalidation ?? decision?.stopLoss)
  const longTarget = Number(decision?.takeProfit ?? decision?.holdUntil)
  const downsidePct = Math.abs(Number(decision?.downsidePct)) > 0 ? Math.abs(Number(decision?.downsidePct)) / 100 : 0.02
  const upsidePct = Math.abs(Number(decision?.upsidePct)) > 0 ? Math.abs(Number(decision?.upsidePct)) / 100 : 0.03

  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return { stopLoss: null, takeProfit: null }

  let stopLoss = Number.isFinite(invalidation) ? invalidation : marketPrice * (1 - downsidePct)
  let takeProfit = Number.isFinite(longTarget) ? longTarget : marketPrice * (1 + upsidePct)

  if (side === 'short') {
    const riskDistance = Number.isFinite(stopLoss) ? Math.abs(marketPrice - stopLoss) : marketPrice * downsidePct
    const rewardDistance = Number.isFinite(takeProfit) ? Math.abs(takeProfit - marketPrice) : marketPrice * upsidePct
    stopLoss = marketPrice + riskDistance
    takeProfit = Math.max(0.01, marketPrice - rewardDistance)
  }

  return {
    stopLoss: round(stopLoss),
    takeProfit: round(takeProfit),
  }
}

function shouldClosePosition(position, signalAction) {
  if (!position || !signalAction) return false
  if (position.side === 'long') return ['SELL', 'STRONG_SELL'].includes(signalAction)
  return ['BUY', 'STRONG_BUY'].includes(signalAction)
}

function canExecutePaperBot(state) {
  if (state.killSwitch) return 'Kill switch is active.'
  if (!state.botEnabled) return 'Bot automation is disabled.'
  if (state.mode !== 'paper') return `Bot auto execution is allowed only in paper mode. Current mode: ${state.mode}.`
  return ''
}

export function getTradingBotState() {
  const state = loadState()
  state.warnings = buildWarnings(state)
  return saveState(state)
}

export function updateTradingBotSettings(input = {}) {
  const state = loadState()
  const requestedMode = normalizeMode(input.mode ?? state.mode)
  const safeLiveAllowed = liveTradingAllowedByEnv()

  state.botEnabled = typeof input.botEnabled === 'boolean' ? input.botEnabled : state.botEnabled
  state.killSwitch = typeof input.killSwitch === 'boolean' ? input.killSwitch : state.killSwitch
  state.userConfirmedLiveTrading = typeof input.userConfirmedLiveTrading === 'boolean'
    ? input.userConfirmedLiveTrading
    : state.userConfirmedLiveTrading
  state.liveTradingEnabled = safeLiveAllowed && state.userConfirmedLiveTrading
  state.mode = requestedMode === 'live'
    ? (state.liveTradingEnabled ? 'live' : 'paper')
    : requestedMode
  state.activeStrategy = String(input.activeStrategy ?? state.activeStrategy)
  state.cooldownMinutes = Math.max(1, Number(input.cooldownMinutes ?? state.cooldownMinutes) || state.cooldownMinutes)
  state.maxDailyLossPct = Math.max(0.1, Number(input.maxDailyLossPct ?? state.maxDailyLossPct) || state.maxDailyLossPct)
  state.maxRiskPerTradePct = Math.max(0.1, Number(input.maxRiskPerTradePct ?? state.maxRiskPerTradePct) || state.maxRiskPerTradePct)
  state.alertsEnabled = typeof input.alertsEnabled === 'boolean' ? input.alertsEnabled : state.alertsEnabled
  state.warnings = buildWarnings(state)
  return saveState(state)
}

export function recordTradingBotEvent(event = {}) {
  const state = loadState()
  const entry = appendEvent(state, event)
  state.warnings = buildWarnings(state)
  saveState(state)
  return entry
}

export async function executeAutoPaperCycle(input = {}) {
  const state = loadState()
  state.warnings = buildWarnings(state)
  state.lastRunAt = timestamp()

  const ticker = normalizeTicker(input.ticker)
  const signalAction = String(input.decision?.action ?? input.decision?.primaryAction ?? '').trim().toUpperCase()
  const currentPrice = Number(input.snapshot?.price ?? input.decision?.currentPrice)
  const blockReason = canExecutePaperBot(state)

  if (blockReason) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: blockReason, bot: saveState(state), account: await getPaperAccount() }
  }

  if (!ticker || !signalAction || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: 'Missing ticker, price, or decision context for auto execution.', bot: saveState(state), account: await getPaperAccount() }
  }

  const account = await getPaperAccount()
  const position = account.openPositions.find(item => item.ticker === ticker) ?? null
  const pendingOrder = account.pendingOrders.find(item => item.ticker === ticker) ?? null

  if (pendingOrder) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: 'A pending demo order already exists for this ticker.', bot: saveState(state), account }
  }

  if (position && shouldClosePosition(position, signalAction)) {
    const nextAccount = await closePaperPosition(position.id)
    state.lastActionAt = timestamp()
    const event = appendEvent(state, {
      eventType: 'position_closed',
      ticker,
      message: `Auto paper bot closed the ${position.side} position on ${ticker} after the signal flipped.`,
      metadata: {
        action: 'close',
        side: position.side,
        quantity: position.quantity,
        strategy: state.activeStrategy,
      },
    })
    state.warnings = buildWarnings(state)
    return { action: 'closed', reason: event.message, event, bot: saveState(state), account: nextAccount }
  }

  if (position) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: 'An open demo position already exists and still aligns with the current signal.', bot: saveState(state), account }
  }

  const cooldownMs = Math.max(1, Number(state.cooldownMinutes) || 1) * 60 * 1000
  if (state.lastActionAt && ((Date.now() - new Date(state.lastActionAt).getTime()) < cooldownMs)) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: 'Bot cooldown is still active.', bot: saveState(state), account }
  }

  let side = null
  if (['BUY', 'STRONG_BUY'].includes(signalAction)) side = 'long'
  if (['SELL', 'STRONG_SELL'].includes(signalAction) && account.riskSettings?.shortSellingEnabled) side = 'short'
  if (!side) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: 'No eligible auto-entry setup was found for the current signal.', bot: saveState(state), account }
  }

  const { stopLoss, takeProfit } = deriveProtectiveLevels({ side, decision: input.decision, currentPrice })
  const quantity = computeBotQuantity({
    price: currentPrice,
    stopLoss,
    equity: account.equity ?? account.cash,
    cash: account.cash,
    side,
    botRiskPct: state.maxRiskPerTradePct,
    accountRiskPct: account.riskSettings?.riskPerTradePct,
    maxSymbolExposurePct: account.riskSettings?.maxSymbolExposurePct,
  })

  if (!quantity || !stopLoss) {
    state.warnings = buildWarnings(state)
    return { action: 'skipped', reason: 'Auto bot could not calculate a safe order size for this setup.', bot: saveState(state), account }
  }

  const nextAccount = await createPaperOrder({
    ticker,
    side,
    orderType: 'market',
    quantity,
    entryPrice: currentPrice,
    stopLoss,
    takeProfit,
    notes: `Auto paper bot · ${state.activeStrategy}`,
  })

  state.lastActionAt = timestamp()
  const openedPosition = nextAccount.openPositions.find(item => item.ticker === ticker)
  const event = appendEvent(state, {
    eventType: 'order_created',
    ticker,
    orderId: openedPosition?.orderId ?? null,
    message: `Auto paper bot opened a ${side} position on ${ticker}.`,
    metadata: {
      action: 'open',
      side,
      quantity,
      strategy: state.activeStrategy,
      stopLoss,
      takeProfit,
    },
  })
  state.warnings = buildWarnings(state)
  return { action: 'opened', reason: event.message, event, bot: saveState(state), account: nextAccount }
}

export function __setTradingBotTestConfig(config = {}) {
  if (config.storePath) {
    runtime.storePath = config.storePath
  }
}

export function __resetTradingBotTestConfig() {
  runtime.storePath = STORE_PATH
}
