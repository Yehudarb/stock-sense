export const METHOD_PRESETS = Object.freeze({
  all: { label: 'ללא סינון שיטת מיכו' },
  strong_long_term_trend: { label: 'מגמה ארוכת טווח חזקה' },
  healthy_pullback: { label: 'Pullback בריא' },
  golden_zone_pullback: { label: 'Golden Zone Pullback' },
  breakout_watch: { label: 'מעקב פריצה' },
  trend_breakdown_warning: { label: 'אזהרת שבירת מגמה' },
})

/** Match a compact scanner result against a documented method preset. */
export function matchesMethodPreset(candidate, preset = 'all') {
  if (preset === 'all') return true
  if (preset === 'strong_long_term_trend') return Boolean(
    candidate.priceAboveSma150 && candidate.priceAboveSma200 && candidate.sma150AboveSma200 &&
    candidate.sma200Rising && candidate.technicalMethodScore >= 70,
  )
  if (preset === 'healthy_pullback') return Boolean(
    candidate.priceAboveSma150 && candidate.priceAboveSma200 && candidate.sma150AboveSma200 && candidate.sma200Rising &&
    ['healthy_pullback_to_sma20', 'trading_near_sma20', 'reclaiming_sma20'].includes(candidate.timingStatus) &&
    candidate.supportDistancePercent <= 2.5 && candidate.distanceFromSma20InAtr <= 2 &&
    candidate.trendlineStatus !== 'broken',
  )
  if (preset === 'golden_zone_pullback') return Boolean(
    candidate.priceAboveSma150 && candidate.priceAboveSma200 && candidate.sma150AboveSma200 && candidate.sma200Rising &&
    candidate.fibonacciGoldenZone && candidate.supportDistancePercent <= 2.5 && candidate.technicalMethodScore >= 55,
  )
  if (preset === 'breakout_watch') return Boolean(
    candidate.resistanceDistancePercent <= 2.5 && ['forming', 'breakout_pending', 'breakout_confirmed'].includes(candidate.patternStatus) &&
    candidate.priceAboveSma200 && candidate.technicalMethodScore >= 55,
  )
  if (preset === 'trend_breakdown_warning') return Boolean(
    candidate.trendlineStatus === 'broken' || candidate.longTermTrendStatus === 'downtrend' ||
    (!candidate.priceAboveSma150 && !candidate.priceAboveSma200) || candidate.setupStatus === 'invalidated',
  )
  return false
}

/** Apply method filters without mutating or recomputing server scanner results. */
export function filterMethodCandidates(candidates, filters = {}) {
  const {
    preset = 'all',
    minimumScore = 0,
    minimumRiskReward = 0,
    setupStatus = 'all',
    maximumSma20Distance = null,
    maximumSupportDistance = null,
    requireVolumeConfirmation = false,
  } = filters
  return (candidates ?? []).filter(candidate => {
    if (!matchesMethodPreset(candidate, preset)) return false
    if ((candidate.technicalMethodScore ?? -1) < minimumScore) return false
    if (minimumRiskReward > 0 && (candidate.riskReward ?? -1) < minimumRiskReward) return false
    if (setupStatus !== 'all' && candidate.setupStatus !== setupStatus) return false
    if (Number.isFinite(maximumSma20Distance) && Math.abs(candidate.distanceFromSma20Percent ?? Infinity) > maximumSma20Distance) return false
    if (Number.isFinite(maximumSupportDistance) && (candidate.supportDistancePercent ?? Infinity) > maximumSupportDistance) return false
    if (requireVolumeConfirmation && !candidate.volumeConfirmed) return false
    return true
  })
}
