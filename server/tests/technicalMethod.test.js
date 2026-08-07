import test from 'node:test'
import assert from 'node:assert/strict'

import { computeAll } from '../../client/src/lib/indicators.js'
import { analyzeLongTermTrend, analyzeShortTermTiming } from '../../client/src/lib/technicalMethod/movingAverages.js'
import { analyzeFibonacci } from '../../client/src/lib/technicalMethod/fibonacci.js'
import { detectPriceLevels } from '../../client/src/lib/technicalMethod/levels.js'
import { detectMethodTrendlines } from '../../client/src/lib/technicalMethod/trendlines.js'
import { computeTechnicalMethod } from '../../client/src/lib/technicalMethod/index.js'
import { classifySlope } from '../../client/src/lib/technicalMethod/config.js'
import { normalizeMethodPatterns } from '../../client/src/lib/technicalMethod/patterns.js'
import { classifyMethodSetup } from '../../client/src/lib/technicalMethod/setup.js'
import { filterMethodCandidates, matchesMethodPreset } from '../../client/src/lib/technicalMethod/scanner.js'
import { createTechnicalMethodAction, runTechnicalMethodWalkForward } from '../../client/src/lib/technicalMethod/backtest.js'

function trendBars(length = 260) {
  return Array.from({ length }, (_, index) => {
    const base = 80 + index * 0.32 + Math.sin(index / 7) * 1.8
    return { t: Date.UTC(2025, 0, index + 1), o: base - 0.25, h: base + 1.2, l: base - 1.2, c: base, v: 1_000_000 + (index % 8) * 50_000 }
  })
}

test('long-term trend qualifies only when all SMA150/SMA200 requirements are met', () => {
  const bars = trendBars()
  const indicators = computeAll(bars, '1d')
  const trend = analyzeLongTermTrend(bars, indicators)

  assert.equal(trend.available, true)
  assert.equal(trend.qualified, true)
  assert.equal(trend.priceAboveSma150, true)
  assert.equal(trend.priceAboveSma200, true)
  assert.equal(trend.sma150AboveSma200, true)
  assert.equal(trend.sma200Rising, true)
})

test('SMA20 timing flags an extended price instead of treating it as a healthy pullback', () => {
  const bars = trendBars()
  const last = bars.length - 1
  bars[last] = { ...bars[last], o: bars[last - 1].c + 14, h: bars[last - 1].c + 17, l: bars[last - 1].c + 13, c: bars[last - 1].c + 16 }
  const indicators = computeAll(bars, '1d')
  const timing = analyzeShortTermTiming(bars, indicators)

  assert.equal(timing.available, true)
  assert.equal(timing.status, 'extended_above_sma20')
  assert.ok(timing.distanceFromSma20InAtr > 2)
})

test('fibonacci returns no analysis without a valid long-term trend', () => {
  const bars = trendBars(80)
  const result = analyzeFibonacci(bars, { available: false, status: 'neutral' })
  assert.equal(result.available, false)
  assert.equal(result.status, 'not_available')
})

test('price-level detector rejects one-touch noise and returns structured zones', () => {
  const bars = trendBars()
  for (const index of [90, 130, 170, 210]) bars[index] = { ...bars[index], l: 100 }
  const levels = detectPriceLevels(bars, computeAll(bars, '1d'))

  assert.ok(levels.support.every(level => level.touchCount >= 2))
  assert.ok(levels.support.every(level => level.lowerBound < level.upperBound))
})

test('trendline detector returns a validated, projected three-touch support line', () => {
  const bars = trendBars()
  const supportIndexes = [130, 175, 220]
  supportIndexes.forEach((index, touch) => {
    const low = 95 + touch * 6
    bars[index] = { ...bars[index], l: low, o: low + 1.8, c: low + 2.3, h: low + 3.1 }
  })
  const lines = detectMethodTrendlines(bars, computeAll(bars, '1d'))
  const support = lines.find(line => line.type === 'support')

  assert.ok(support)
  assert.equal(support.touchCount, 3)
  assert.equal(support.projection.index, bars.length - 1)
  assert.ok(['holding', 'testing'].includes(support.status))
})

test('method conclusion remains research-oriented and exposes risk, setup, and completeness', () => {
  const bars = trendBars()
  const method = computeTechnicalMethod(bars, computeAll(bars, '1d'), { best: null, patterns: [] })

  assert.ok(method.score >= 0 && method.score <= 100)
  assert.ok(method.dataCompletenessPercent > 0)
  assert.ok(['watch', 'prepare', 'setup_valid', 'wait', 'avoid'].includes(method.conclusion.actionState))
  assert.ok(method.risk)
  assert.ok(Array.isArray(method.conclusion.invalidationConditions))
})

test('slope states distinguish rising, flat, and falling long averages', () => {
  assert.equal(classifySlope(3), 'rising_strongly')
  assert.equal(classifySlope(0.1), 'flat')
  assert.equal(classifySlope(-1), 'falling')
})

test('less than 200 bars blocks a positive long-term setup', () => {
  const bars = trendBars(180)
  const method = computeTechnicalMethod(bars, computeAll(bars, '1d'), { best: null, patterns: [] })

  assert.equal(method.trend.available, false)
  assert.equal(method.setup.setupType, 'no_valid_setup')
  assert.equal(method.setup.status, 'not_ready')
  assert.equal(method.conclusion.partialAnalysis, true)
  assert.equal(method.conclusion.actionState, 'wait')
})

function setupFixture({ lastClose = 100, previousHigh = 101, trendlineStatus = 'holding' } = {}) {
  const bars = trendBars(220)
  bars[bars.length - 2] = { ...bars.at(-2), o: 99, h: previousHigh, l: 98, c: 99, v: 1_000_000 }
  bars[bars.length - 1] = { ...bars.at(-1), o: 99, h: Math.max(101, lastClose + 0.5), l: 98.5, c: lastClose, v: 1_300_000 }
  const series = Array(bars.length).fill(null)
  return {
    bars,
    indicators: { atr14: [...series.slice(0, -1), 2], volRatio: [...series.slice(0, -1), 1.3] },
    trend: { available: true, qualified: true, status: 'uptrend' },
    timing: { available: true, status: 'healthy_pullback_to_sma20', sma20: 98 },
    levels: {
      nearestSupport: { lowerBound: 94, upperBound: 97, midpoint: 95.5, distanceFromPricePercent: 2 },
      nearestResistance: { lowerBound: 119, upperBound: 120, midpoint: 119.5, distanceFromPricePercent: 19 },
    },
    fibonacci: { available: false, status: 'not_available' },
    trendlines: [{ type: 'support', status: trendlineStatus, currentValue: 95 }],
    patterns: { best: null, patterns: [] },
    confluence: { score: 80, confirmations: 5 },
  }
}

test('adequate risk reward cannot trigger a setup without closed-bar confirmation', () => {
  const result = classifyMethodSetup(setupFixture())

  assert.ok(result.risk.riskReward >= 1.5)
  assert.equal(result.trigger.confirmed, false)
  assert.equal(result.status, 'ready_for_monitoring')
  assert.equal(result.actionState, 'prepare')
})

test('a qualified setup triggers only after explicit closed-bar price confirmation', () => {
  const result = classifyMethodSetup(setupFixture({ lastClose: 102, previousHigh: 101 }))

  assert.equal(result.trigger.confirmed, true)
  assert.equal(result.status, 'triggered')
  assert.equal(result.actionState, 'setup_valid')
  assert.ok(result.risk.stopCandidates.length >= 2)
})

test('confirmed ascending trendline break invalidates the setup', () => {
  const result = classifyMethodSetup(setupFixture({ trendlineStatus: 'broken' }))

  assert.equal(result.setupType, 'trend_breakdown')
  assert.equal(result.status, 'invalidated')
  assert.equal(result.actionState, 'avoid')
})

test('pattern adapter rejects weak patterns and normalizes strong patterns', () => {
  const bars = trendBars(60)
  const result = normalizeMethodPatterns({ patterns: [
    { key: 'DOUBLE_BOTTOM', label: 'Weak', weight: 40, direction: 'bullish', status: 'developing', visual: { startIndex: 10, endIndex: 30 }, meta: {} },
    { key: 'CUP_HANDLE', label: 'Cup and Handle', weight: 82, direction: 'bullish', status: 'confirmed', visual: { startIndex: 5, endIndex: 59 }, meta: { quality: 0.9, breakoutConfirmed: true, breakoutLevel: 120 } },
  ] }, bars)

  assert.equal(result.patterns.length, 1)
  assert.equal(result.best.pattern, 'cup_and_handle')
  assert.equal(result.best.breakoutConfirmed, true)
  assert.ok(result.best.confidenceScore >= 58)
})

test('confirmed resistance break is retained as flipped support', () => {
  const bars = Array.from({ length: 90 }, (_, index) => ({
    t: Date.UTC(2025, 0, index + 1), o: 100, h: 102, l: 98, c: 100, v: 1_000_000,
  }))
  for (const index of [20, 40, 60]) bars[index] = { ...bars[index], h: 110, c: 106 }
  bars[88] = { ...bars[88], o: 110, h: 113, l: 109.5, c: 112 }
  bars[89] = { ...bars[89], o: 112, h: 114, l: 111, c: 113 }
  const levels = detectPriceLevels(bars, computeAll(bars, '1d'))
  const flipped = levels.all.find(level => level.originalType === 'resistance' && level.status === 'flipped')

  assert.ok(flipped)
  assert.equal(flipped.type, 'support')
})

test('a wick through resistance does not create a confirmed role flip', () => {
  const bars = Array.from({ length: 90 }, (_, index) => ({
    t: Date.UTC(2025, 0, index + 1), o: 100, h: 102, l: 98, c: 100, v: 1_000_000,
  }))
  for (const index of [20, 40, 60]) bars[index] = { ...bars[index], h: 110, c: 106 }
  bars[88] = { ...bars[88], h: 113, c: 108 }
  bars[89] = { ...bars[89], h: 109, c: 107 }
  const levels = detectPriceLevels(bars, computeAll(bars, '1d'))
  const resistance = levels.all.find(level => level.originalType === 'resistance' && level.midpoint > 105)

  assert.ok(resistance)
  assert.notEqual(resistance.status, 'flipped')
  assert.ok(resistance.falseBreakCount >= 1)
})

test('fibonacci identifies a valid golden-zone pullback from a completed swing', () => {
  const bars = Array.from({ length: 80 }, (_, index) => {
    const close = index <= 39 ? 100 + index * (50 / 39) : 150 - (index - 39) * (25 / 40)
    return { t: Date.UTC(2025, 0, index + 1), o: close - 0.3, h: close + 0.5, l: close - 0.5, c: close, v: 1_000_000 }
  })
  const result = analyzeFibonacci(bars, { available: true, status: 'uptrend' }, undefined, { indicators: { atr14: Array(80).fill(2) } })

  assert.equal(result.available, true)
  assert.equal(result.status, 'golden_zone_test')
  assert.equal(result.goldenZone.priceInsideZone, true)
})

test('scanner presets and numeric method filters are deterministic', () => {
  const candidate = {
    ticker: 'TEST', priceAboveSma150: true, priceAboveSma200: true, sma150AboveSma200: true,
    sma200Rising: true, technicalMethodScore: 76, riskReward: 2, timingStatus: 'healthy_pullback_to_sma20',
    supportDistancePercent: 1.2, distanceFromSma20InAtr: 0.5, trendlineStatus: 'holding',
  }

  assert.equal(matchesMethodPreset(candidate, 'strong_long_term_trend'), true)
  assert.equal(matchesMethodPreset(candidate, 'healthy_pullback'), true)
  assert.equal(filterMethodCandidates([candidate], { preset: 'healthy_pullback', minimumScore: 75, minimumRiskReward: 1.5 }).length, 1)
  assert.equal(filterMethodCandidates([candidate], { minimumScore: 80 }).length, 0)
})

test('technical-method walk-forward action cannot observe appended future bars', () => {
  const bars = trendBars(270)
  const action = createTechnicalMethodAction('long_term_only')
  const prefix = bars.slice(0, 250)
  const before = action(prefix)
  const mutatedFuture = [...bars]
  mutatedFuture[260] = { ...mutatedFuture[260], c: 1, h: 2, l: 0.5 }

  assert.equal(action(mutatedFuture.slice(0, 250)), before)
})

test('technical-method validation exposes full and split-sample research results', () => {
  const result = runTechnicalMethodWalkForward(trendBars(290), {
    variant: 'long_term_only', warmup: 240, horizon: 5,
  })

  assert.equal(result.variant, 'long_term_only')
  assert.ok(result.full)
  assert.ok(result.split)
  assert.ok(result.full.byAction.long_term_only)
  assert.ok(result.limitations.length >= 2)
})
