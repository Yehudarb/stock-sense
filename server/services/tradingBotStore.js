import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const STORE_PATH = join(DATA_DIR, 'tradingBot.json')

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
  recentEvents: [],
  warnings: ['Live trading is disabled by default.'],
  updatedAt: null,
}

function timestamp() {
  return new Date().toISOString()
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function loadState() {
  try {
    if (!existsSync(STORE_PATH)) return { ...DEFAULT_STATE, updatedAt: timestamp() }
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
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
  writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8')
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
  state.warnings = buildWarnings(state)
  saveState(state)
  return entry
}
