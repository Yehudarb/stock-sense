import { TECHNICAL_METHOD_CONFIG } from './config.js'
import { analyzeLongTermTrend, analyzeShortTermTiming } from './movingAverages.js'
import { detectPriceLevels } from './levels.js'
import { analyzeFibonacci } from './fibonacci.js'
import { buildConfluence } from './confluence.js'
import { classifyMethodSetup } from './setup.js'

const round = (value, digits = 1) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

function overallStatus(score) {
  if (score == null) return 'mixed'
  if (score >= 85) return 'strong_bullish_alignment'
  if (score >= 70) return 'bullish_alignment'
  if (score >= 55) return 'mixed'
  if (score >= 40) return 'weak'
  if (score >= 20) return 'bearish'
  return 'strong_bearish'
}

/** Full deterministic Long-Term Technical Confluence Method analysis. */
export function computeTechnicalMethod(bars, indicators, patterns = null, config = TECHNICAL_METHOD_CONFIG) {
  if (!bars?.length || !indicators) return null
  const trend = analyzeLongTermTrend(bars, indicators, config)
  const timing = analyzeShortTermTiming(bars, indicators, config)
  const supportResistance = detectPriceLevels(bars, indicators, config)
  const fibonacci = analyzeFibonacci(bars, trend, config)
  const confluence = buildConfluence({ trend, timing, levels: supportResistance, fibonacci, patterns, indicators }, config)
  const setup = classifyMethodSetup({ bars, indicators, trend, timing, levels: supportResistance, fibonacci, confluence }, config)
  const completeness = [trend.available, timing.available, fibonacci.available, Boolean(supportResistance.nearestSupport || supportResistance.nearestResistance)].filter(Boolean).length / 4 * 100
  const score = confluence.score
  const conclusion = {
    overallStatus: overallStatus(score), score, confidence: round(Math.min(100, setup.confidence * 0.7 + completeness * 0.3)), dataCompletenessPercent: round(completeness),
    actionState: setup.actionState,
    summary: trend.qualified ? 'The long-term trend is qualified; timing and risk confirmation determine whether the setup is actionable.' : 'The long-term trend is not fully qualified; this method treats the setup as monitoring only.',
    currentSetup: setup.setupType,
    keyReasons: [...setup.reasonsFor, ...confluence.signals.filter(item => item.direction === 'bullish' && item.confirmed).map(item => item.title)].slice(0, 5),
    keyRisks: [...setup.reasonsAgainst, ...setup.risk.warnings, ...confluence.signals.filter(item => item.direction === 'bearish' && item.confirmed).map(item => item.title)].slice(0, 5),
    confirmationNeeded: setup.status === 'triggered' ? [] : [setup.trigger.description], invalidationConditions: [setup.invalidationCondition],
  }
  return { methodName: config.name, displayName: config.displayName, calculatedAt: new Date(bars.at(-1).t).toISOString(), score, confidence: conclusion.confidence, dataCompletenessPercent: conclusion.dataCompletenessPercent, trend, timing, supportResistance, trendlines: [], patterns: patterns?.patterns ?? [], fibonacci, confluences: confluence.signals, setup, risk: setup.risk, conclusion }
}

/** Backward-compatible scanner representation. */
export function compactTechnicalMethod(method) {
  if (!method) return null
  return { technicalMethodScore: method.score, technicalMethodStatus: method.conclusion.overallStatus, setupType: method.setup.setupType, setupStatus: method.setup.status, actionState: method.setup.actionState, confidence: method.confidence, riskLevel: method.risk.riskLevel }
}

export { TECHNICAL_METHOD_CONFIG }
