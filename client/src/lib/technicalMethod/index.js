import { TECHNICAL_METHOD_CONFIG } from './config.js'
import { analyzeLongTermTrend, analyzeShortTermTiming } from './movingAverages.js'
import { detectPriceLevels } from './levels.js'
import { analyzeFibonacci } from './fibonacci.js'
import { detectMethodTrendlines } from './trendlines.js'
import { normalizeMethodPatterns } from './patterns.js'
import { buildConfluence } from './confluence.js'
import { classifyMethodSetup } from './setup.js'

const round = (value, digits = 1) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

function overallStatus(score, available, config) {
  if (!available || score == null) return 'mixed'
  if (score >= config.scoreThresholds.strong) return 'strong_bullish_alignment'
  if (score >= config.scoreThresholds.good) return 'bullish_alignment'
  if (score >= config.scoreThresholds.constructive) return 'mixed'
  if (score >= config.scoreThresholds.weak) return 'weak'
  if (score >= config.scoreThresholds.bearish) return 'bearish'
  return 'strong_bearish'
}

function observedData(trend, timing, levels, trendlines, fibonacci, patterns) {
  return [
    trend.available ? `Close is ${trend.priceVsSma150Percent}% from SMA150 and ${trend.priceVsSma200Percent}% from SMA200.` : trend.reason,
    trend.available ? `SMA200 changed ${trend.sma200Slope50Percent ?? trend.sma200Slope20Percent}% over the available slope window.` : null,
    timing.available ? `Close is ${timing.distanceFromSma20Percent}% from SMA20 (${timing.distanceFromSma20InAtr ?? 'n/a'} ATR).` : null,
    levels.nearestSupport ? `Nearest support is ${levels.nearestSupport.lowerBound}-${levels.nearestSupport.upperBound} with ${levels.nearestSupport.touchCount} touches.` : 'No validated nearby support zone was detected.',
    levels.nearestResistance ? `Nearest resistance is ${levels.nearestResistance.lowerBound}-${levels.nearestResistance.upperBound}.` : 'No validated nearby resistance zone was detected.',
    trendlines.length ? `${trendlines[0].touchCount}-touch ${trendlines[0].direction} trendline is ${trendlines[0].status}.` : 'No validated three-touch trendline was detected.',
    fibonacci.available ? `Fibonacci context is ${fibonacci.status}.` : 'No sufficiently clear directional swing was available for Fibonacci.',
    patterns.best ? `${patterns.best.label} is ${patterns.best.status} at evidence quality ${patterns.best.confidenceScore}/100.` : 'No technical pattern passed the evidence-quality threshold.',
  ].filter(Boolean)
}

/** Full deterministic Long-Term Technical Confluence Method analysis. */
export function computeTechnicalMethod(bars, indicators, patternResult = null, config = TECHNICAL_METHOD_CONFIG) {
  if (!bars?.length || !indicators) return null
  const trend = analyzeLongTermTrend(bars, indicators, config)
  const timing = analyzeShortTermTiming(bars, indicators, config)
  const supportResistance = detectPriceLevels(bars, indicators, config)
  const trendlines = detectMethodTrendlines(bars, indicators, config)
  const fibonacci = analyzeFibonacci(bars, trend, config, { indicators, levels: supportResistance, trendlines })
  const patterns = normalizeMethodPatterns(patternResult, bars, config)
  const confluence = buildConfluence({ trend, timing, levels: supportResistance, fibonacci, trendlines, patterns, indicators }, config)
  const setup = classifyMethodSetup({ bars, indicators, trend, timing, levels: supportResistance, fibonacci, trendlines, patterns, confluence }, config)
  const availability = {
    longTermTrend: trend.available,
    shortTermTiming: timing.available,
    supportResistance: Boolean(supportResistance.nearestSupport || supportResistance.nearestResistance),
    trendline: trendlines.length > 0,
    fibonacci: fibonacci.available,
    pattern: patterns.patterns.length > 0,
    volume: Number.isFinite(indicators?.volRatio?.at(-1)),
  }
  const completeness = Object.values(availability).filter(Boolean).length / Object.keys(availability).length * 100
  const score = confluence.score
  const analysisAvailable = trend.available && completeness >= 40
  const status = overallStatus(score, analysisAvailable, config)
  const confidence = round(Math.min(100, setup.confidence * 0.7 + completeness * 0.3))
  const observations = observedData(trend, timing, supportResistance, trendlines, fibonacci, patterns)
  const summary = !trend.available
    ? `Analysis is partial: at least ${config.minimumBars} closed bars are required. No positive setup can be issued.`
    : trend.qualified
      ? 'The long-term structure is qualified. Timing, closed-bar confirmation, and risk gates determine whether the setup becomes technically valid.'
      : 'The long-term structure is not fully qualified. The method keeps the candidate in monitoring or avoidance state rather than issuing a positive setup.'
  const conclusion = {
    overallStatus: status,
    score,
    confidence,
    evidenceQuality: confidence,
    dataCompletenessPercent: round(completeness),
    partialAnalysis: !analysisAvailable,
    actionState: trend.available ? setup.actionState : 'wait',
    summary,
    currentSetup: setup.setupType,
    observedData: observations,
    interpretation: [summary, ...setup.reasonsFor].slice(0, 5),
    riskNotes: [...setup.reasonsAgainst, ...setup.risk.warnings].slice(0, 6),
    keyReasons: [...setup.reasonsFor, ...confluence.signals.filter(item => item.direction === 'bullish' && item.confirmed).map(item => item.title)].slice(0, 5),
    keyRisks: [...setup.reasonsAgainst, ...setup.risk.warnings, ...confluence.signals.filter(item => item.direction === 'bearish' && item.confirmed).map(item => item.title)].slice(0, 5),
    confirmationNeeded: setup.status === 'triggered' ? [] : [setup.trigger.description],
    invalidationConditions: [setup.invalidationCondition],
  }
  return {
    methodName: config.name,
    displayName: config.displayName,
    version: '2.0.0',
    calculatedAt: new Date(bars.at(-1).t).toISOString(),
    context: { barCount: bars.length, lastClosedBarAt: new Date(bars.at(-1).t).toISOString(), calculationsUseClosedBars: true },
    score,
    confidence,
    evidenceQuality: confidence,
    dataCompletenessPercent: conclusion.dataCompletenessPercent,
    availability,
    trend,
    timing,
    supportResistance,
    trendlines,
    patterns: patterns.patterns,
    patternSummary: patterns,
    fibonacci,
    confluences: confluence.signals,
    setup,
    risk: setup.risk,
    conclusion,
  }
}

/** Backward-compatible scanner representation with deterministic filter fields. */
export function compactTechnicalMethod(method) {
  if (!method) return null
  const support = method.supportResistance.nearestSupport
  const resistance = method.supportResistance.nearestResistance
  const primaryTrendline = method.trendlines[0]
  const bestPattern = method.patternSummary.best
  return {
    technicalMethodScore: method.score,
    technicalMethodStatus: method.conclusion.overallStatus,
    setupType: method.setup.setupType,
    setupStatus: method.setup.status,
    actionState: method.setup.actionState,
    confidence: method.confidence,
    evidenceQuality: method.evidenceQuality,
    riskLevel: method.risk.riskLevel,
    riskReward: method.risk.riskReward,
    priceAboveSma150: method.trend.priceAboveSma150 ?? false,
    priceAboveSma200: method.trend.priceAboveSma200 ?? false,
    sma150AboveSma200: method.trend.sma150AboveSma200 ?? false,
    sma150Rising: method.trend.sma150Rising ?? false,
    sma200Rising: method.trend.sma200Rising ?? false,
    longTermTrendStatus: method.trend.status,
    priceVsSma150Percent: method.trend.priceVsSma150Percent ?? null,
    priceVsSma200Percent: method.trend.priceVsSma200Percent ?? null,
    sma200SlopePercent: method.trend.sma200Slope50Percent ?? method.trend.sma200Slope20Percent ?? null,
    distanceFromSma20Percent: method.timing.distanceFromSma20Percent ?? null,
    distanceFromSma20InAtr: method.timing.distanceFromSma20InAtr ?? null,
    timingStatus: method.timing.status,
    nearestSupport: support?.midpoint ?? null,
    supportDistancePercent: support?.distanceFromPricePercent ?? null,
    nearestResistance: resistance?.midpoint ?? null,
    resistanceDistancePercent: resistance?.distanceFromPricePercent ?? null,
    trendlineStatus: primaryTrendline?.status ?? 'not_available',
    fibonacciStatus: method.fibonacci.status,
    fibonacciGoldenZone: method.fibonacci.goldenZone?.priceInsideZone ?? false,
    pattern: bestPattern?.pattern ?? null,
    patternStatus: bestPattern?.status ?? 'not_available',
    patternConfirmed: bestPattern?.breakoutConfirmed ?? false,
    volumeConfirmed: method.setup.trigger.evidence.volumeConfirmed ?? false,
    lastUpdated: method.calculatedAt,
  }
}

export { TECHNICAL_METHOD_CONFIG }
