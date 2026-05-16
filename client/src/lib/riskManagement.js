const RISK_MULTIPLIER     = 1.5
const REWARD_MULTIPLIER   = 2.0
const TRAILING_MULTIPLIER = 1.2

function roundPrice(value) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return null
  return parseFloat(value.toFixed(2))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
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
    stopCandidate(price, price - RISK_MULTIPLIER * atr, 'ATR', 'Uses 1.5x ATR below price to reflect current volatility.'),
    nearestSupport != null
      ? stopCandidate(price, nearestSupport - atr * 0.35, 'Below support', 'Sits below the nearest support shelf to protect against a support failure.')
      : null,
    vwap != null
      ? stopCandidate(price, vwap - atr * 0.5, 'Below VWAP', 'Places the stop under VWAP so a failed reclaim can exit the trade early.')
      : null,
    patternInvalidation != null
      ? stopCandidate(price, patternInvalidation, 'Pattern invalidation', 'Uses the invalidation level from the leading chart pattern.')
      : null,
  ].filter(Boolean)

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

  const stopLoss   = price - RISK_MULTIPLIER * atr
  const takeProfit = price + REWARD_MULTIPLIER * atr
  const trailingStop = price - TRAILING_MULTIPLIER * atr
  const riskPct    = ((price - stopLoss) / price) * 100
  const rewardPct  = ((takeProfit - price) / price) * 100
  const rrRatio    = rewardPct / riskPct
  const stopContext = buildStopContext(price, atr, indicators, { ...context, lastIndex: last })
  const recommendedStop = stopContext?.recommended?.price ?? parseFloat(stopLoss.toFixed(2))
  const recommendedRiskPct = stopContext?.recommended?.riskPct ?? parseFloat(riskPct.toFixed(2))
  const recommendedRrRatio = recommendedRiskPct > 0 ? rewardPct / recommendedRiskPct : rrRatio

  return {
    atr:           parseFloat(atr.toFixed(2)),
    stopLoss:      recommendedStop,
    takeProfit:    parseFloat(takeProfit.toFixed(2)),
    trailingStop:  parseFloat(trailingStop.toFixed(2)),
    riskPct:       recommendedRiskPct,
    rewardPct:     parseFloat(rewardPct.toFixed(2)),
    rrRatio:       parseFloat(recommendedRrRatio.toFixed(2)),
    stopContext,
  }
}
