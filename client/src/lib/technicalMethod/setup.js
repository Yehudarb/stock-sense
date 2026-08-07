import { TECHNICAL_METHOD_CONFIG } from './config.js'

const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

function classifyRisk(price, stopPlan, atr, target, config) {
  const stop = stopPlan?.price
  if (!Number.isFinite(price) || !Number.isFinite(stop) || stop >= price) {
    return {
      riskLevel: 'high', technicalInvalidationLevel: null, stopDistancePercent: null,
      stopDistanceAtr: null, riskReward: null, warnings: ['No valid technical stop could be calculated.'],
      stopReason: null, stopCandidates: stopPlan?.candidates ?? [],
    }
  }
  const stopDistancePercent = (price - stop) / price * 100
  const stopDistanceAtr = Number.isFinite(atr) && atr > 0 ? (price - stop) / atr : null
  const riskReward = Number.isFinite(target) && target > price ? (target - price) / (price - stop) : null
  const warnings = []
  if (stopDistancePercent < config.risk.minStopPercent) warnings.push('Technical stop is very close to price.')
  if (stopDistancePercent > config.risk.maxStopPercent) warnings.push('Technical stop is wider than the configured maximum.')
  if (riskReward == null) warnings.push('No validated target is available for risk/reward calculation.')
  else if (riskReward < config.risk.minimumRiskReward) warnings.push('Risk/reward is below the configured minimum.')
  const riskLevel = stopDistancePercent > 9 || riskReward == null || riskReward < 1 ? 'high'
    : stopDistancePercent > 5 || riskReward < config.risk.minimumRiskReward ? 'medium' : 'low'
  return {
    riskLevel,
    technicalInvalidationLevel: round(stop),
    stopDistancePercent: round(stopDistancePercent),
    stopDistanceAtr: round(stopDistanceAtr),
    stopReason: stopPlan.reason,
    stopSource: stopPlan.source,
    stopCandidates: stopPlan.candidates,
    riskReward: round(riskReward),
    warnings,
  }
}

function recentSwingLow(bars, lookback = 20) {
  const recent = bars.slice(-lookback - 1, -1)
  if (!recent.length) return null
  return Math.min(...recent.map(bar => bar.l).filter(Number.isFinite))
}

function buildStopPlan({ bars, indicators, timing, levels, fibonacci, trendlines, setupType }, config) {
  const price = bars.at(-1)?.c
  const atr = indicators?.atr14?.at(-1)
  if (!Number.isFinite(price) || !Number.isFinite(atr) || atr <= 0) return { price: null, candidates: [] }
  const buffer = atr * config.risk.stopAtrMultiplier
  const candidates = []
  const add = (source, level, reason) => {
    const stop = Number.isFinite(level) ? level - buffer : null
    if (Number.isFinite(stop) && stop > 0 && stop < price) candidates.push({ source, referenceLevel: round(level), price: round(stop), reason })
  }
  add('horizontal_support', levels?.nearestSupport?.lowerBound, 'Below the nearest validated support zone with an ATR buffer.')
  add('recent_swing_low', recentSwingLow(bars), 'Below the recent closed-bar swing low with an ATR buffer.')
  add('ascending_trendline', trendlines.find(line => line.type === 'support' && line.status !== 'broken')?.currentValue, 'Below the validated ascending trendline with an ATR buffer.')
  if (fibonacci?.trendDirection === 'up') add('fibonacci_61_8', fibonacci.levels?.find(level => level.ratio === 0.618)?.price, 'Below the 61.8% retracement reference with an ATR buffer.')
  if (setupType === 'pullback_to_sma20' || setupType === 'long_term_uptrend') add('sma20', timing?.sma20, 'Below SMA20 because it is part of the active setup structure.')
  if (!candidates.length) return { price: null, candidates }

  const sourcePriority = setupType === 'pullback_to_sma20'
    ? ['horizontal_support', 'recent_swing_low', 'sma20', 'ascending_trendline', 'fibonacci_61_8']
    : ['horizontal_support', 'recent_swing_low', 'ascending_trendline', 'fibonacci_61_8', 'sma20']
  candidates.sort((a, b) => sourcePriority.indexOf(a.source) - sourcePriority.indexOf(b.source))
  const selected = candidates[0]
  return { ...selected, candidates }
}

function confirmationEvidence(bars, indicators, triggerPrice, config) {
  const last = bars.at(-1)
  const previous = bars.at(-2)
  if (!last || !previous) return { confirmed: false, type: 'none', evidence: {} }
  const range = Math.max(last.h - last.l, 0.0001)
  const closeLocation = (last.c - last.l) / range
  const bullishCandle = last.c > last.o && closeLocation >= config.setup.bullishCloseLocationMinimum && last.c > previous.h
  const volumeRatio = indicators?.volRatio?.at(-1)
  const volumeConfirmed = Number.isFinite(volumeRatio) && volumeRatio >= config.setup.confirmationVolumeRatio
  const threshold = Number.isFinite(triggerPrice) ? triggerPrice * (1 + config.setup.breakoutBufferPercent / 100) : null
  const confirmation = bars.slice(-config.setup.confirmationBars)
  const closeBreakout = Number.isFinite(threshold) && confirmation.length === config.setup.confirmationBars && confirmation.every(bar => bar.c > threshold)
  return {
    confirmed: bullishCandle || (closeBreakout && volumeConfirmed),
    type: bullishCandle ? 'bullish_confirmation_candle' : closeBreakout && volumeConfirmed ? 'confirmed_close_above_trigger' : 'none',
    evidence: {
      candleClosed: true,
      bullishCandle,
      closeBreakout,
      volumeConfirmed,
      volumeRatio: round(volumeRatio),
      closeLocation: round(closeLocation),
      triggerThreshold: round(threshold),
      confirmationBars: config.setup.confirmationBars,
    },
  }
}

/** Convert independent evidence into a monitorable setup; never a direct buy/sell order. */
export function classifyMethodSetup({ bars, indicators, trend, timing, levels, fibonacci, trendlines = [], patterns, confluence }, config = TECHNICAL_METHOD_CONFIG) {
  const price = bars.at(-1)?.c
  const atr = indicators?.atr14?.at(-1)
  const support = levels?.nearestSupport
  const resistance = levels?.nearestResistance
  const strongTrend = trend?.qualified === true
  const healthyTiming = ['healthy_pullback_to_sma20', 'trading_near_sma20', 'reclaiming_sma20'].includes(timing?.status)
  const supportTrendline = trendlines.find(line => line.type === 'support')
  const failedBreakout = patterns?.patterns?.find(pattern => pattern.pattern === 'failed_breakout')
  const breakoutRetest = patterns?.patterns?.find(pattern => pattern.pattern === 'breakout_retest')
  const bullishPattern = patterns?.patterns?.find(pattern => pattern.direction === 'bullish')
  const bearishConfirmedPattern = patterns?.patterns?.find(pattern => pattern.direction === 'bearish' && ['completed', 'breakout_confirmed'].includes(pattern.status))
  let setupType = 'no_valid_setup'
  let status = 'not_ready'
  let actionState = 'wait'
  const reasonsFor = []
  const reasonsAgainst = []

  if (!trend?.available) reasonsAgainst.push('Insufficient closed-bar history for SMA200 and long-term trend qualification.')
  else if (strongTrend) reasonsFor.push('Long-term trend requirements are qualified.')
  else reasonsAgainst.push('Long-term trend is not fully qualified.')
  if (support) reasonsFor.push(`Validated support is ${support.distanceFromPricePercent}% from price.`)
  if (bullishPattern) reasonsFor.push(`${bullishPattern.label} is ${bullishPattern.status} with evidence quality ${bullishPattern.confidenceScore}/100.`)
  if (bearishConfirmedPattern) reasonsAgainst.push(`Confirmed bearish pattern: ${bearishConfirmedPattern.label}.`)

  if (!trend?.available) {
    setupType = 'no_valid_setup'
  } else if (failedBreakout) {
    setupType = 'failed_breakout'; status = 'invalidated'; actionState = 'avoid'
  } else if (supportTrendline?.status === 'broken') {
    setupType = 'trend_breakdown'; status = 'invalidated'; actionState = 'avoid'; reasonsAgainst.push('The ascending support trendline has a confirmed close-based break.')
  } else if (bearishConfirmedPattern && !strongTrend) {
    setupType = 'trend_breakdown'; status = 'invalidated'; actionState = 'avoid'
  } else if (breakoutRetest && strongTrend) {
    setupType = 'breakout_retest'; status = 'ready_for_monitoring'; actionState = 'prepare'
  } else if (supportTrendline?.status === 'testing' && strongTrend) {
    setupType = 'trendline_support_test'; status = 'ready_for_monitoring'; actionState = 'prepare'
  } else if (timing?.status === 'healthy_pullback_to_sma20' && strongTrend) {
    setupType = 'pullback_to_sma20'; status = 'ready_for_monitoring'; actionState = 'prepare'
  } else if (fibonacci?.status === 'golden_zone_test' && strongTrend) {
    setupType = 'fibonacci_golden_zone_pullback'; status = 'ready_for_monitoring'; actionState = 'prepare'
  } else if (strongTrend && healthyTiming && support) {
    setupType = 'pullback_to_major_support'; status = 'ready_for_monitoring'; actionState = 'watch'
  } else if (strongTrend && resistance?.distanceFromPricePercent <= config.levels.nearPricePercent) {
    setupType = 'breakout_setup'; status = 'forming'; actionState = 'watch'
  } else if (strongTrend) {
    setupType = 'long_term_uptrend'; status = 'forming'; actionState = 'watch'
  } else if (trend?.status === 'early_recovery') {
    setupType = 'early_recovery'; status = 'forming'; actionState = 'watch'
  } else if (['downtrend', 'weak_structure'].includes(trend?.status)) {
    setupType = 'trend_breakdown'; status = 'invalidated'; actionState = 'avoid'
  }

  const triggerPrice = resistance?.upperBound ?? bullishPattern?.breakoutLevel ?? bars.at(-2)?.h ?? null
  const confirmation = confirmationEvidence(bars, indicators, triggerPrice, config)
  const stopPlan = buildStopPlan({ bars, indicators, timing, levels, fibonacci, trendlines, setupType }, config)
  const possibleTargets = [resistance?.midpoint, bullishPattern?.projectedTarget]
    .filter(target => Number.isFinite(target) && target > price)
    .sort((a, b) => a - b)
    .map(value => round(value))
  const risk = classifyRisk(price, stopPlan, atr, possibleTargets[0] ?? null, config)
  const riskEligible = risk.stopDistancePercent != null && risk.stopDistancePercent <= config.risk.maxStopPercent &&
    risk.riskReward != null && risk.riskReward >= config.risk.minimumRiskReward
  const pullbackConfirmationAllowed = ['pullback_to_sma20', 'pullback_to_major_support', 'fibonacci_golden_zone_pullback', 'trendline_support_test', 'breakout_retest'].includes(setupType)
  const confirmationMatchesSetup = pullbackConfirmationAllowed
    ? confirmation.evidence.bullishCandle || confirmation.evidence.closeBreakout && confirmation.evidence.volumeConfirmed
    : setupType === 'breakout_setup' && confirmation.evidence.closeBreakout && confirmation.evidence.volumeConfirmed
  confirmation.confirmed = Boolean(confirmationMatchesSetup)
  const setupCanTrigger = (status === 'ready_for_monitoring' || setupType === 'breakout_setup' && status === 'forming') && strongTrend &&
    (confluence?.score ?? 0) >= config.scoreThresholds.constructive && riskEligible && !bearishConfirmedPattern
  if (setupCanTrigger && confirmation.confirmed) {
    status = 'triggered'
    actionState = 'setup_valid'
    reasonsFor.push(`Closed-bar confirmation received: ${confirmation.type}.`)
  } else if (['ready_for_monitoring', 'forming'].includes(status) && !riskEligible) {
    reasonsAgainst.push('The current technical stop and target do not meet the configured risk gate.')
  }

  const entryZone = support ? { lower: support.lowerBound, upper: support.upperBound } : null
  const trigger = {
    description: Number.isFinite(triggerPrice)
      ? `Wait for ${config.setup.confirmationBars} closed candles above ${round(triggerPrice)} with supporting volume, or a bullish confirmation candle from support.`
      : 'Wait for a closed bullish confirmation candle from validated support.',
    price: round(triggerPrice),
    confirmationType: 'closed_bar_price_confirmation',
    confirmed: confirmation.confirmed,
    evidence: confirmation.evidence,
  }
  return {
    setupType,
    status,
    actionState,
    score: confluence?.score ?? null,
    confidence: Math.min(100, (confluence?.confirmations ?? 0) * 14 + (trend?.available ? 22 : 0) + (timing?.available ? 14 : 0) + (fibonacci?.available ? 10 : 0) + (patterns?.best ? 12 : 0)),
    entryZone,
    trigger,
    invalidationCondition: stopPlan.price != null ? `A closed candle below ${round(stopPlan.price)} invalidates the current technical setup.` : 'No validated technical invalidation is available.',
    technicalStopZone: stopPlan.price != null ? { lower: round(stopPlan.price - (atr ?? 0) * 0.15), upper: round(stopPlan.price) } : null,
    possibleTargets,
    riskReward: risk.riskReward,
    risk,
    reasonsFor,
    reasonsAgainst,
  }
}
