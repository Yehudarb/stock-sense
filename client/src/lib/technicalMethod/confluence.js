import { TECHNICAL_METHOD_CONFIG } from './config.js'

const clamp = value => Math.min(100, Math.max(0, value))
const round = (value, digits = 1) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

function signal(category, direction, weight, scoreContribution, title, explanation, evidence, confirmed = true) {
  return { id: `${category}-${title}`, category, direction, weight, scoreContribution: round(scoreContribution), title, explanation, evidence, confirmed }
}

/** Keep every weighted contribution traceable to its independent technical evidence. */
export function buildConfluence({ trend, timing, levels, fibonacci, trendlines = [], patterns, indicators }, config = TECHNICAL_METHOD_CONFIG) {
  const volumeRatio = indicators?.volRatio?.at(-1)
  const bestPattern = patterns?.best ?? null
  const support = levels?.nearestSupport
  const resistance = levels?.nearestResistance
  const entries = []
  const trendScore = !trend?.available ? null : trend.qualified ? 100
    : trend.status === 'strong_uptrend' || trend.status === 'uptrend' ? 82
      : trend.status === 'early_recovery' ? 62 : trend.status === 'neutral' ? 50
        : trend.status === 'weak_structure' ? 30 : 10
  if (trendScore != null) entries.push(signal('long_term_trend', trendScore >= 60 ? 'bullish' : trendScore < 40 ? 'bearish' : 'neutral', config.weights.longTermTrend, trendScore, 'Long-term trend', `Structure is ${trend.status}.`, trend))
  const timingScore = !timing?.available ? null : ({ healthy_pullback_to_sma20: 88, trading_near_sma20: 72, reclaiming_sma20: 65, extended_above_sma20: 42, lost_sma20_support: 28, below_falling_sma20: 15, neutral: 50 })[timing.status] ?? 50
  if (timingScore != null) entries.push(signal('short_term_timing', timingScore >= 60 ? 'bullish' : timingScore < 40 ? 'bearish' : 'neutral', config.weights.shortTermTiming, timingScore, 'SMA20 timing', `Timing state is ${timing.status}.`, timing, timing.status !== 'neutral'))
  const levelScore = support?.strengthScore != null ? Math.min(92, 42 + support.strengthScore * 0.58) : resistance?.strengthScore != null ? 45 : 50
  entries.push(signal('support_resistance', support ? 'bullish' : resistance ? 'bearish' : 'neutral', config.weights.supportResistance, levelScore, 'Price structure', support ? 'Nearest support zone is active.' : resistance ? 'Nearest resistance zone is the closest reference.' : 'No high-confidence nearby zone.', { support, resistance }, Boolean(support || resistance)))
  const fibScore = !fibonacci?.available ? null : ({ golden_zone_test: 85, healthy_retracement: 70, shallow_pullback: 62, deep_retracement: 35, structure_at_risk: 20 })[fibonacci.status] ?? 50
  if (fibScore != null) entries.push(signal('fibonacci', fibScore >= 60 ? 'bullish' : fibScore < 40 ? 'bearish' : 'neutral', config.weights.fibonacci, fibScore, 'Fibonacci context', `Fibonacci state is ${fibonacci.status}.`, fibonacci, fibonacci.status !== 'not_available'))
  const patternScore = bestPattern ? clamp(50 + (bestPattern.weight ?? 0) / 2) : 50
  entries.push(signal('pattern', bestPattern?.direction ?? 'neutral', config.weights.technicalPatterns, patternScore, 'Technical pattern', bestPattern ? `Leading pattern: ${bestPattern.label}.` : 'No high-confidence pattern is active.', bestPattern ?? {}, Boolean(bestPattern)))
  const volumeScore = Number.isFinite(volumeRatio) ? clamp(50 + (volumeRatio - 1) * 35) : null
  if (volumeScore != null) entries.push(signal('volume', volumeScore >= 60 ? 'bullish' : volumeScore < 40 ? 'bearish' : 'neutral', config.weights.volumeConfirmation, volumeScore, 'Volume confirmation', `Relative volume is ${volumeRatio.toFixed(2)}x.`, { volumeRatio }, volumeRatio >= 1.1))
  const supportLine = trendlines.find(line => line.type === 'support')
  const resistanceLine = trendlines.find(line => line.type === 'resistance')
  const primaryLine = supportLine ?? resistanceLine
  const trendlineScore = !primaryLine ? 50 : primaryLine.status === 'broken' ? 20 : primaryLine.status === 'testing' ? 78 : 68
  entries.push(signal(
    'trendline',
    !primaryLine ? 'neutral' : primaryLine.status === 'broken' ? 'bearish' : primaryLine.direction,
    config.weights.trendlines,
    trendlineScore,
    'Trendline',
    !primaryLine ? 'No validated three-touch trendline is available.' : `${primaryLine.touchCount}-touch ${primaryLine.type} trendline is ${primaryLine.status}.`,
    { supportLine, resistanceLine },
    Boolean(primaryLine && primaryLine.status !== 'broken'),
  ))
  const availableWeight = entries.filter(entry => Number.isFinite(entry.scoreContribution)).reduce((sum, entry) => sum + entry.weight, 0)
  const weighted = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.scoreContribution) ? entry.scoreContribution * entry.weight : 0), 0)
  const score = availableWeight ? weighted / availableWeight : null
  const confirmations = entries.filter(entry => entry.confirmed && entry.direction === 'bullish').length
  const bearish = entries.filter(entry => entry.confirmed && entry.direction === 'bearish').length
  return { signals: entries, score: round(score), confirmations, bearishConfirmations: bearish, availableWeight }
}
