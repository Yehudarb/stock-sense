import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getSnapshot } from './yahooFinance.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const DEFAULT_STORE_PATH = join(DATA_DIR, 'paperTrading.json')
const DEFAULT_BALANCE = 100000
const DEFAULT_SETTINGS = {
  riskPerTradePct: 1,
  maxDailyLossPct: 3,
  maxOpenPositions: 5,
  maxSymbolExposurePct: 20,
  commissionPerTrade: 1,
  slippageBps: 5,
  shortSellingEnabled: true,
}

const runtime = {
  storePath: DEFAULT_STORE_PATH,
  now: () => new Date(),
  snapshotResolver: ticker => getSnapshot(ticker),
}

function timestamp() {
  return runtime.now().toISOString()
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function ensureDataDir() {
  const dir = dirname(runtime.storePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`
}

function normalizeNumber(value, fallback = null) {
  if (value === '' || value == null) return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeTicker(ticker) {
  return String(ticker ?? '').trim().toUpperCase()
}

function sideDirection(side) {
  return side === 'short' ? -1 : 1
}

function isSameUtcDay(isoA, isoB) {
  if (!isoA || !isoB) return false
  return isoA.slice(0, 10) === isoB.slice(0, 10)
}

function createDefaultState() {
  return {
    initialBalance: DEFAULT_BALANCE,
    cash: DEFAULT_BALANCE,
    pendingOrders: [],
    openPositions: [],
    closedTrades: [],
    orderHistory: [],
    riskSettings: { ...DEFAULT_SETTINGS },
    updatedAt: timestamp(),
  }
}

function loadState() {
  try {
    if (!existsSync(runtime.storePath)) return createDefaultState()
    const parsed = JSON.parse(readFileSync(runtime.storePath, 'utf8'))
    return {
      ...createDefaultState(),
      ...parsed,
      pendingOrders: parsed.pendingOrders ?? [],
      openPositions: parsed.openPositions ?? [],
      closedTrades: parsed.closedTrades ?? [],
      orderHistory: parsed.orderHistory ?? [],
      riskSettings: { ...DEFAULT_SETTINGS, ...(parsed.riskSettings ?? {}) },
    }
  } catch {
    return createDefaultState()
  }
}

function saveState(state) {
  ensureDataDir()
  const next = { ...state, updatedAt: timestamp() }
  writeFileSync(runtime.storePath, JSON.stringify(next, null, 2), 'utf8')
  return next
}

async function resolveSnapshots(tickers) {
  const unique = [...new Set((tickers ?? []).filter(Boolean))]
  const entries = await Promise.all(unique.map(async ticker => {
    try {
      const snapshot = await runtime.snapshotResolver(ticker)
      return [ticker, snapshot]
    } catch {
      return [ticker, null]
    }
  }))
  return Object.fromEntries(entries)
}

function currentSymbolExposure(state, ticker, snapshots) {
  return round(state.openPositions
    .filter(position => position.ticker === ticker)
    .reduce((sum, position) => {
      const mark = snapshots[position.ticker]?.price ?? position.entryPrice
      return sum + (mark * position.quantity)
    }, 0))
}

function currentDailyRealizedLoss(state) {
  const today = timestamp().slice(0, 10)
  return Math.abs(round(state.closedTrades
    .filter(trade => isSameUtcDay(trade.closedAt, today) && (trade.realizedPnl ?? 0) < 0)
    .reduce((sum, trade) => sum + trade.realizedPnl, 0)) ?? 0)
}

function computeCommission(settings, quantity) {
  return round((settings.commissionPerTrade ?? 0) * Math.max(1, Number(quantity) || 0))
}

function applySlippage(price, side, settings, orderType = 'market') {
  if (price == null) return null
  if (orderType !== 'market' && orderType !== 'stop') return round(price)
  const bps = (settings.slippageBps ?? 0) / 10000
  if (!bps) return round(price)
  const multiplier = side === 'short' ? (1 - bps) : (1 + bps)
  return round(price * multiplier)
}

function validateProtection({ side, referencePrice, stopLoss, takeProfit }) {
  if (stopLoss == null) {
    throw Object.assign(new Error('Stop loss is required in demo mode'), { status: 400 })
  }

  if (side === 'long' && stopLoss >= referencePrice) {
    throw Object.assign(new Error('Long stop loss must be below entry price'), { status: 400 })
  }
  if (side === 'short' && stopLoss <= referencePrice) {
    throw Object.assign(new Error('Short stop loss must be above entry price'), { status: 400 })
  }
  if (takeProfit != null && side === 'long' && takeProfit <= referencePrice) {
    throw Object.assign(new Error('Long take profit must be above entry price'), { status: 400 })
  }
  if (takeProfit != null && side === 'short' && takeProfit >= referencePrice) {
    throw Object.assign(new Error('Short take profit must be below entry price'), { status: 400 })
  }
}

function validateRisk({ state, settings, side, ticker, quantity, referencePrice, stopLoss, snapshots }) {
  const accountEquityEstimate = Math.max(state.cash, state.initialBalance)
  const maxDailyLossAmount = accountEquityEstimate * ((settings.maxDailyLossPct ?? 0) / 100)
  if (maxDailyLossAmount > 0 && currentDailyRealizedLoss(state) >= maxDailyLossAmount) {
    throw Object.assign(new Error('Daily loss limit reached for the demo account'), { status: 400 })
  }

  if (!settings.shortSellingEnabled && side === 'short') {
    throw Object.assign(new Error('Short selling is disabled in current risk settings'), { status: 400 })
  }

  const activeExposureCount = state.openPositions.length + state.pendingOrders.length
  if (activeExposureCount >= (settings.maxOpenPositions ?? DEFAULT_SETTINGS.maxOpenPositions)) {
    throw Object.assign(new Error('Maximum number of open demo trades reached'), { status: 400 })
  }

  const maxRiskAmount = accountEquityEstimate * ((settings.riskPerTradePct ?? 0) / 100)
  const riskAmount = Math.abs(referencePrice - stopLoss) * quantity
  if (maxRiskAmount > 0 && riskAmount > maxRiskAmount) {
    throw Object.assign(new Error(`Trade risk exceeds the allowed ${settings.riskPerTradePct}% per trade`), { status: 400 })
  }

  const notional = quantity * referencePrice
  const maxSymbolExposure = accountEquityEstimate * ((settings.maxSymbolExposurePct ?? 100) / 100)
  const nextSymbolExposure = (currentSymbolExposure(state, ticker, snapshots) ?? 0) + notional
  if (maxSymbolExposure > 0 && nextSymbolExposure > maxSymbolExposure) {
    throw Object.assign(new Error('Symbol exposure would exceed the configured risk limit'), { status: 400 })
  }

  const commission = computeCommission(settings, quantity)
  if (side === 'long' && (notional + commission) > state.cash) {
    throw Object.assign(new Error('Not enough cash for this demo trade'), { status: 400 })
  }
}

function buildOrder({
  ticker,
  side,
  orderType,
  quantity,
  entryPrice,
  stopLoss,
  takeProfit,
  notes,
}) {
  return {
    id: randomId('ord'),
    ticker,
    side,
    orderType,
    quantity,
    entryPrice: round(entryPrice),
    stopLoss: round(stopLoss),
    takeProfit: round(takeProfit),
    notes: String(notes ?? '').trim(),
    status: orderType === 'market' ? 'created' : 'pending',
    createdAt: timestamp(),
  }
}

function buildPositionFromOrder(order, fillPrice, settings, executionAssumption) {
  const commission = computeCommission(settings, order.quantity)
  return {
    id: randomId('pos'),
    orderId: order.id,
    ticker: order.ticker,
    side: order.side,
    orderType: order.orderType,
    quantity: order.quantity,
    entryPrice: round(fillPrice),
    stopLoss: round(order.stopLoss),
    takeProfit: round(order.takeProfit),
    notes: order.notes,
    openedAt: timestamp(),
    feesPaid: commission,
    executionAssumption,
  }
}

function fillOrderIntoState(state, orderId, fillPrice, executionAssumption) {
  const orderIndex = state.pendingOrders.findIndex(order => order.id === orderId)
  const source = orderIndex >= 0 ? state.pendingOrders[orderIndex] : state.orderHistory.find(order => order.id === orderId)
  if (!source) return null

  const settings = state.riskSettings
  const order = {
    ...source,
    status: 'filled',
    filledAt: timestamp(),
    fillPrice: round(fillPrice),
    executionAssumption,
  }
  const position = buildPositionFromOrder(order, fillPrice, settings, executionAssumption)
  const notional = position.entryPrice * position.quantity

  if (position.side === 'long') {
    state.cash = round(state.cash - notional - position.feesPaid)
  } else {
    state.cash = round(state.cash + notional - position.feesPaid)
  }

  state.openPositions.unshift(position)

  if (orderIndex >= 0) {
    state.pendingOrders.splice(orderIndex, 1)
  }
  upsertOrderHistory(state, order)
  return position
}

function upsertOrderHistory(state, order) {
  const index = state.orderHistory.findIndex(entry => entry.id === order.id)
  if (index === -1) {
    state.orderHistory.unshift(order)
  } else {
    state.orderHistory[index] = { ...state.orderHistory[index], ...order }
  }
}

function createRejectedOrder(state, order, reason) {
  const rejected = {
    ...order,
    status: 'rejected',
    rejectionReason: reason,
    rejectedAt: timestamp(),
  }
  upsertOrderHistory(state, rejected)
  return rejected
}

function closePositionInState(state, positionId, exitPrice, exitReason = 'manual', executionAssumption = 'Manual close at current market price') {
  const index = state.openPositions.findIndex(position => position.id === positionId)
  if (index === -1) return null

  const position = state.openPositions[index]
  const closeCommission = computeCommission(state.riskSettings, position.quantity)
  const notional = position.quantity * exitPrice

  if (position.side === 'long') {
    state.cash = round(state.cash + notional - closeCommission)
  } else {
    state.cash = round(state.cash - notional - closeCommission)
  }

  const grossPnl = (exitPrice - position.entryPrice) * position.quantity * sideDirection(position.side)
  const realizedPnl = round(grossPnl - (position.feesPaid ?? 0) - closeCommission)
  const closedTrade = {
    id: randomId('trd'),
    positionId: position.id,
    orderId: position.orderId,
    ticker: position.ticker,
    side: position.side,
    orderType: position.orderType,
    quantity: position.quantity,
    entryPrice: position.entryPrice,
    exitPrice: round(exitPrice),
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    notes: position.notes,
    openedAt: position.openedAt,
    closedAt: timestamp(),
    holdMinutes: Math.max(1, Math.round((runtime.now().getTime() - new Date(position.openedAt).getTime()) / 60000)),
    exitReason,
    executionAssumption,
    feesPaid: round((position.feesPaid ?? 0) + closeCommission),
    realizedPnl,
  }

  state.openPositions.splice(index, 1)
  state.closedTrades.unshift(closedTrade)
  return closedTrade
}

function pendingOrderShouldFill(order, currentPrice) {
  if (currentPrice == null) return false
  if (order.orderType === 'limit') {
    return order.side === 'long' ? currentPrice <= order.entryPrice : currentPrice >= order.entryPrice
  }
  if (order.orderType === 'stop') {
    return order.side === 'long' ? currentPrice >= order.entryPrice : currentPrice <= order.entryPrice
  }
  return false
}

function pendingOrderFillPrice(order, currentPrice, settings) {
  if (order.orderType === 'limit') {
    return round(order.entryPrice)
  }
  return applySlippage(order.entryPrice ?? currentPrice, order.side, settings, 'stop')
}

async function processMarketState(state) {
  const snapshots = await resolveSnapshots([
    ...state.pendingOrders.map(order => order.ticker),
    ...state.openPositions.map(position => position.ticker),
  ])

  for (const order of [...state.pendingOrders]) {
    const currentPrice = snapshots[order.ticker]?.price
    if (!pendingOrderShouldFill(order, currentPrice)) continue
    fillOrderIntoState(
      state,
      order.id,
      pendingOrderFillPrice(order, currentPrice, state.riskSettings),
      order.orderType === 'limit'
        ? 'Pending limit order filled when market traded through the requested level.'
        : 'Pending stop-entry order triggered when market crossed the stop level.',
    )
  }

  for (const position of [...state.openPositions]) {
    const currentPrice = snapshots[position.ticker]?.price
    if (currentPrice == null) continue

    const stopHit = position.stopLoss != null && (
      (position.side === 'long' && currentPrice <= position.stopLoss) ||
      (position.side === 'short' && currentPrice >= position.stopLoss)
    )
    const targetHit = position.takeProfit != null && (
      (position.side === 'long' && currentPrice >= position.takeProfit) ||
      (position.side === 'short' && currentPrice <= position.takeProfit)
    )

    if (stopHit) {
      closePositionInState(state, position.id, position.stopLoss, 'stop_loss', 'Position closed automatically at the configured stop-loss level.')
      continue
    }

    if (targetHit) {
      closePositionInState(state, position.id, position.takeProfit, 'take_profit', 'Position closed automatically at the configured take-profit level.')
    }
  }

  return snapshots
}

function enrichAccountState(state, snapshots) {
  const openPositions = state.openPositions.map(position => {
    const currentPrice = snapshots[position.ticker]?.price ?? null
    const rawUnrealized = currentPrice == null
      ? null
      : ((currentPrice - position.entryPrice) * position.quantity * sideDirection(position.side)) - (position.feesPaid ?? 0)

    return {
      ...position,
      currentPrice,
      marketPriceChangedAt: snapshots[position.ticker]?.timestamp ?? null,
      exposure: round((currentPrice ?? position.entryPrice) * position.quantity),
      unrealizedPnl: round(rawUnrealized),
      unrealizedPct: currentPrice == null
        ? null
        : round((((currentPrice - position.entryPrice) / position.entryPrice) * 100) * sideDirection(position.side)),
    }
  })

  const realizedPnl = round(state.closedTrades.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0))
  const unrealizedPnl = round(openPositions.reduce((sum, position) => sum + (position.unrealizedPnl ?? 0), 0))
  const longValue = openPositions
    .filter(position => position.side === 'long')
    .reduce((sum, position) => sum + ((position.currentPrice ?? position.entryPrice) * position.quantity), 0)
  const shortLiability = openPositions
    .filter(position => position.side === 'short')
    .reduce((sum, position) => sum + ((position.currentPrice ?? position.entryPrice) * position.quantity), 0)
  const equity = round(state.cash + longValue - shortLiability)
  const wins = state.closedTrades.filter(trade => (trade.realizedPnl ?? 0) > 0)
  const losses = state.closedTrades.filter(trade => (trade.realizedPnl ?? 0) < 0)

  return {
    initialBalance: state.initialBalance,
    cash: round(state.cash),
    equity,
    realizedPnl,
    unrealizedPnl,
    totalReturnPct: round(((equity - state.initialBalance) / state.initialBalance) * 100),
    winRatePct: state.closedTrades.length ? round((wins.length / state.closedTrades.length) * 100) : null,
    pendingOrders: state.pendingOrders,
    openPositions,
    closedTrades: state.closedTrades.slice(0, 40),
    riskSettings: state.riskSettings,
    stats: {
      openCount: openPositions.length,
      pendingCount: state.pendingOrders.length,
      closedCount: state.closedTrades.length,
      averageWin: wins.length ? round(wins.reduce((sum, trade) => sum + trade.realizedPnl, 0) / wins.length) : null,
      averageLoss: losses.length ? round(losses.reduce((sum, trade) => sum + trade.realizedPnl, 0) / losses.length) : null,
      dailyRealizedLoss: round(currentDailyRealizedLoss(state)),
    },
    updatedAt: timestamp(),
  }
}

async function hydrateAccount() {
  const state = loadState()
  const snapshots = await processMarketState(state)
  saveState(state)
  return enrichAccountState(state, snapshots)
}

async function prepareOrderDraft(input) {
  const ticker = normalizeTicker(input.ticker)
  const side = input.side === 'short' ? 'short' : 'long'
  const orderType = ['market', 'limit', 'stop'].includes(input.orderType) ? input.orderType : 'market'
  const quantity = normalizeNumber(input.quantity)
  const entryPrice = normalizeNumber(input.entryPrice)
  const stopLoss = normalizeNumber(input.stopLoss)
  const takeProfit = normalizeNumber(input.takeProfit)
  const notes = String(input.notes ?? '').trim()

  if (!ticker || !quantity || quantity <= 0) {
    throw Object.assign(new Error('Ticker and quantity are required'), { status: 400 })
  }

  if ((orderType === 'limit' || orderType === 'stop') && (!entryPrice || entryPrice <= 0)) {
    throw Object.assign(new Error('Entry price is required for pending orders'), { status: 400 })
  }

  let snapshot = null
  if (orderType === 'market' || !entryPrice) {
    snapshot = await runtime.snapshotResolver(ticker)
  }

  const referencePrice = round(orderType === 'market' ? snapshot?.price : entryPrice)
  if (!referencePrice || referencePrice <= 0) {
    throw Object.assign(new Error('Unable to resolve a valid market price for this order'), { status: 400 })
  }

  validateProtection({ side, referencePrice, stopLoss, takeProfit })
  return { ticker, side, orderType, quantity, entryPrice: referencePrice, stopLoss, takeProfit, notes, snapshot }
}

export async function getPaperAccount() {
  return hydrateAccount()
}

export async function createPaperOrder(input) {
  const state = loadState()
  const orderDraft = await prepareOrderDraft(input)
  const snapshots = await resolveSnapshots([orderDraft.ticker, ...state.openPositions.map(position => position.ticker)])
  validateRisk({
    state,
    settings: state.riskSettings,
    side: orderDraft.side,
    ticker: orderDraft.ticker,
    quantity: orderDraft.quantity,
    referencePrice: orderDraft.entryPrice,
    stopLoss: orderDraft.stopLoss,
    snapshots,
  })

  const order = buildOrder(orderDraft)

  if (order.orderType === 'market') {
    upsertOrderHistory(state, order)
    fillOrderIntoState(
      state,
      order.id,
      applySlippage(orderDraft.snapshot?.price ?? order.entryPrice, order.side, state.riskSettings, 'market'),
      'Market order filled immediately using current demo market price with configured slippage.',
    )
  } else {
    state.pendingOrders.unshift(order)
    upsertOrderHistory(state, order)
  }

  saveState(state)
  return hydrateAccount()
}

export async function cancelPaperOrder(orderId) {
  const state = loadState()
  const index = state.pendingOrders.findIndex(order => order.id === orderId)
  if (index === -1) {
    throw Object.assign(new Error('Pending order not found'), { status: 404 })
  }

  const cancelled = {
    ...state.pendingOrders[index],
    status: 'cancelled',
    cancelledAt: timestamp(),
  }
  state.pendingOrders.splice(index, 1)
  upsertOrderHistory(state, cancelled)
  saveState(state)
  return hydrateAccount()
}

export async function closePaperPosition(positionId, exitPrice) {
  const state = loadState()
  const position = state.openPositions.find(item => item.id === positionId)
  if (!position) {
    throw Object.assign(new Error('Position not found'), { status: 404 })
  }

  let resolvedExitPrice = normalizeNumber(exitPrice)
  if (!resolvedExitPrice) {
    const snapshot = await runtime.snapshotResolver(position.ticker)
    resolvedExitPrice = snapshot.price
  }
  if (!resolvedExitPrice || resolvedExitPrice <= 0) {
    throw Object.assign(new Error('Unable to resolve an exit price for this position'), { status: 400 })
  }

  closePositionInState(state, positionId, round(resolvedExitPrice), 'manual', 'Position closed manually using the current demo market price.')
  saveState(state)
  return hydrateAccount()
}

export function updatePaperTradingSettings(input = {}) {
  const state = loadState()
  const next = { ...state.riskSettings }

  for (const key of ['riskPerTradePct', 'maxDailyLossPct', 'maxOpenPositions', 'maxSymbolExposurePct', 'commissionPerTrade', 'slippageBps']) {
    const numeric = normalizeNumber(input[key], next[key])
    next[key] = numeric
  }
  if (typeof input.shortSellingEnabled === 'boolean') {
    next.shortSellingEnabled = input.shortSellingEnabled
  }

  state.riskSettings = {
    ...DEFAULT_SETTINGS,
    ...next,
    riskPerTradePct: Math.max(0.1, next.riskPerTradePct),
    maxDailyLossPct: Math.max(0.1, next.maxDailyLossPct),
    maxOpenPositions: Math.max(1, Math.round(next.maxOpenPositions)),
    maxSymbolExposurePct: Math.max(1, next.maxSymbolExposurePct),
    commissionPerTrade: Math.max(0, next.commissionPerTrade),
    slippageBps: Math.max(0, next.slippageBps),
  }

  saveState(state)
  return hydrateAccount()
}

export async function resetPaperAccount() {
  saveState(createDefaultState())
  return hydrateAccount()
}

export async function openPaperPosition(input) {
  return createPaperOrder({ ...input, orderType: 'market' })
}

export function __setPaperTradingTestConfig(config = {}) {
  if (config.storePath) runtime.storePath = config.storePath
  if (config.snapshotResolver) runtime.snapshotResolver = config.snapshotResolver
  if (config.now) runtime.now = config.now
}

export function __resetPaperTradingTestConfig() {
  runtime.storePath = DEFAULT_STORE_PATH
  runtime.snapshotResolver = ticker => getSnapshot(ticker)
  runtime.now = () => new Date()
}

export const __test = {
  createDefaultState,
  validateProtection,
  validateRisk,
  pendingOrderShouldFill,
  pendingOrderFillPrice,
  applySlippage,
  computeCommission,
  closePositionInState,
}
