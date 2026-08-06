import { TECHNICAL_METHOD_CONFIG } from './config.js'

const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

function classifyRisk(price, stop, atr, target, config) {
  if (!Number.isFinite(price) || !Number.isFinite(stop) || stop >= price) return { riskLevel: 'high', technicalInvalidationLevel: null, stopDistancePercent: null, stopDistanceAtr: null, riskReward: null, warnings: ['No valid technical stop could be calculated.'], stopReason: null }
  const stopDistancePercent = (price - stop) / price * 100
  const stopDistanceAtr = Number.isFinite(atr) && atr > 0 ? (price - stop) / atr : null
  const riskReward = Number.isFinite(target) && target > price ? (target - price) / (price - stop) : null
  const warnings = []
  if (stopDistancePercent < config.risk.minStopPercent) warnings.push('Technical stop is very close to price.')
  if (stopDistancePercent > config.risk.maxStopPercent) warnings.push('Technical stop is wider than the configured maximum.')
  if (riskReward != null && riskReward < config.risk.minimumRiskReward) warnings.push('Risk/reward is below the configured minimum.')
  return { riskLevel: stopDistancePercent > 9 || riskReward != null && riskReward < 1 ? 'high' : stopDistancePercent > 5 ? 'medium' : 'low', technicalInvalidationLevel: round(stop), stopDistancePercent: round(stopDistancePercent), stopDistanceAtr: round(stopDistanceAtr), stopReason: 'Below the nearest validated support zone with an ATR buffer.', riskReward: round(riskReward), warnings }
}

/** Convert independent evidence into a monitorable setup; never a direct buy/sell order. */
export function classifyMethodSetup({ bars, indicators, trend, timing, levels, fibonacci, confluence }, config = TECHNICAL_METHOD_CONFIG) {
  const price = bars.at(-1)?.c
  const atr = indicators?.atr14?.at(-1)
  const support = levels?.nearestSupport
  const resistance = levels?.nearestResistance
  const strongTrend = trend?.qualified
  const healthyTiming = ['healthy_pullback_to_sma20', 'trading_near_sma20', 'reclaiming_sma20'].includes(timing?.status)
  let setupType = 'no_valid_setup'
  let status = 'not_ready'
  let actionState = 'wait'
  const reasonsFor = []
  const reasonsAgainst = []
  if (strongTrend) reasonsFor.push('Long-term trend requirements are qualified.')
  else reasonsAgainst.push('Long-term trend is not fully qualified.')
  if (support) reasonsFor.push('A validated support zone is nearby.')
  if (timing?.status === 'healthy_pullback_to_sma20') { setupType = 'pullback_to_sma20'; status = strongTrend ? 'ready_for_monitoring' : 'forming'; actionState = strongTrend ? 'prepare' : 'watch' }
  else if (fibonacci?.status === 'golden_zone_test' && strongTrend) { setupType = 'fibonacci_golden_zone_pullback'; status = 'ready_for_monitoring'; actionState = 'prepare' }
  else if (strongTrend && healthyTiming && support) { setupType = 'pullback_to_major_support'; status = 'ready_for_monitoring'; actionState = 'watch' }
  else if (strongTrend && resistance?.distanceFromPricePercent <= 2.5) { setupType = 'breakout_setup'; status = 'forming'; actionState = 'watch' }
  else if (trend?.status === 'early_recovery') { setupType = 'early_recovery'; status = 'forming'; actionState = 'watch' }
  else if (['downtrend', 'weak_structure'].includes(trend?.status)) { setupType = 'trend_breakdown'; status = 'invalidated'; actionState = 'avoid' }
  const stop = support?.lowerBound != null && Number.isFinite(atr) ? support.lowerBound - atr * config.risk.stopAtrMultiplier : null
  const target = resistance?.midpoint ?? null
  const risk = classifyRisk(price, stop, atr, target, config)
  if (risk.riskReward != null && risk.riskReward >= config.risk.minimumRiskReward && status === 'ready_for_monitoring') status = 'triggered'
  if (status === 'triggered') actionState = 'setup_valid'
  const entryZone = support ? { lower: support.lowerBound, upper: support.upperBound } : null
  return {
    setupType, status, actionState, score: confluence?.score ?? null, confidence: Math.min(100, (confluence?.confirmations ?? 0) * 16 + (trend?.available ? 22 : 0) + (timing?.available ? 14 : 0) + (fibonacci?.available ? 12 : 0)),
    entryZone, trigger: resistance ? { description: 'Wait for a closed candle above nearby resistance.', price: resistance.upperBound, confirmationType: 'close_above_level' } : { description: 'Wait for a confirmed bullish response from the support zone.', confirmationType: 'bullish_reversal' },
    invalidationCondition: stop != null ? `A close below ${round(stop)} invalidates the current technical setup.` : 'No validated technical invalidation is available.',
    technicalStopZone: stop != null ? { lower: round(stop - (atr ?? 0) * 0.15), upper: round(stop) } : null,
    possibleTargets: resistance ? [round(resistance.midpoint)] : [], risk, reasonsFor, reasonsAgainst,
  }
}
