const RISK_MULTIPLIER     = 1.5
const REWARD_MULTIPLIER   = 2.0
const TRAILING_MULTIPLIER = 1.2
const MIN_STOP_PCT = 0.025
const MAX_STOP_PCT = 0.08
const MIN_TARGET_PCT = 0.05
const MAX_TARGET_PCT = 0.12
const MIN_RISK_REWARD = 1.5

function roundPrice(value) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return null
  return parseFloat(value.toFixed(2))
}


function latestValue(values, index) {
  return values?.[index] ?? null
}

function stopCandidate(price, rawStop, type, reason) {
  const rounded = roundPrice(rawStop)
  if (rounded == null || rounded >= price) return null

  const distanceDollar = roundPrice(price - rounded)
  const riskPct = roundPrice(((price - rounded) / price) * 100)

  return {
    price: rounded,
    type,
    reason,
    distanceDollar,
    riskPct,
  }
}

function buildStopContext(price, atr, indicators, context = {}) {
  const lastIndex = context.lastIndex ?? 0
  const nearestSupport = context.nearestSupport ?? null
  const vwap = context.vwap ?? latestValue(indicators?.vwap, lastIndex)
  const patternInvalidation = context.patternInvalidation ?? null

  const candidates = [
    stopCandidate(price, price - Math.max(RISK_MULTIPLIER * atr, price * MIN_STOP_PCT), 'ATR', 'Uses the larger of 1.5x ATR or 2.5% below price.'),
    nearestSupport != null
      ? stopCandidate(price, nearestSupport - atr * 0.35, 'Below support', 'Sits below the nearest support shelf to protect against a support failure.')
      : null,
    vwap != null
      ? stopCandidate(price, vwap - atr * 0.5, 'Below VWAP', 'Places the stop under VWAP so a failed reclaim can exit the trade early.')
      : null,
    patternInvalidation != null
      ? stopCandidate(price, patternInvalidation, 'Pattern invalidation', 'Uses the invalidation level from the leading chart pattern.')
      : null,
  ].filter(candidate => candidate && candidate.riskPct >= MIN_STOP_PCT * 100 && candidate.riskPct <= MAX_STOP_PCT * 100)

  if (!candidates.length) return null

  const sortedByTightness = [...candidates].sort((a, b) => b.price - a.price)
  const aggressive = sortedByTightness[0]
  const conservative = sortedByTightness.at(-1)
  const supportCandidate = candidates.find(candidate => candidate.type === 'Below support')
  const atrCandidate = candidates.find(candidate => candidate.type === 'ATR')

  const balanced = supportCandidate && supportCandidate.riskPct >= 1 && supportCandidate.riskPct <= 6
    ? supportCandidate
    : atrCandidate ?? aggressive

  const breakEvenTrigger = roundPrice(price + atr * 1.1)
  const trailingActivation = roundPrice(price + atr * 1.6)
  const volatilityBand = balanced.riskPct <= 2
    ? 'Tight'
    : balanced.riskPct <= 4.5
      ? 'Balanced'
      : 'Wide'

  return {
    recommended: balanced,
    aggressive,
    conservative,
    breakEvenTrigger,
    trailingActivation,
    volatilityBand,
    comment: `${balanced.type} stop at $${balanced.price} keeps risk near ${balanced.riskPct}% while respecting current structure.`,
  }
}

export function computeRisk(ohlcv, indicators, context = {}) {
  if (!ohlcv?.length || !indicators?.atr14) return null

  const last  = ohlcv.length - 1
  const price = ohlcv[last].c
  const atr   = indicators.atr14[last]

  if (!atr || atr <= 0) return null

  const stopLoss   = price - Math.max(RISK_MULTIPLIER * atr, price * MIN_STOP_PCT)
  const rawTargetPct = (REWARD_MULTIPLIER * atr) / price
  const targetPct = Math.max(MIN_TARGET_PCT, Math.min(MAX_TARGET_PCT, rawTargetPct))
  const takeProfit = price * (1 + targetPct)
  const trailingStop = price - TRAILING_MULTIPLIER * atr
  const riskPct    = ((price - stopLoss) / price) * 100
  const rewardPct  = ((takeProfit - price) / price) * 100
  const rrRatio    = rewardPct / riskPct
  const stopContext = buildStopContext(price, atr, indicators, { ...context, lastIndex: last })
  const recommendedStop = stopContext?.recommended?.price ?? parseFloat(stopLoss.toFixed(2))
  const recommendedRiskPct = stopContext?.recommended?.riskPct ?? parseFloat(riskPct.toFixed(2))
  const recommendedRrRatio = recommendedRiskPct > 0 ? rewardPct / recommendedRiskPct : rrRatio
  const rejectionReasons = []
  if (recommendedRiskPct > MAX_STOP_PCT * 100) rejectionReasons.push('STOP_TOO_WIDE')
  if (recommendedRrRatio < MIN_RISK_REWARD) rejectionReasons.push('POOR_RISK_REWARD')

  return {
    atr:           parseFloat(atr.toFixed(2)),
    stopLoss:      recommendedStop,
    takeProfit:    parseFloat(takeProfit.toFixed(2)),
    trailingStop:  parseFloat(trailingStop.toFixed(2)),
    riskPct:       recommendedRiskPct,
    rewardPct:     parseFloat(rewardPct.toFixed(2)),
    rrRatio:       parseFloat(recommendedRrRatio.toFixed(2)),
    tradeValid:    rejectionReasons.length === 0,
    rejectionReasons,
    stopContext,
  }
}
