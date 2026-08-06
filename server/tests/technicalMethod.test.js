import test from 'node:test'
import assert from 'node:assert/strict'

import { computeAll } from '../../client/src/lib/indicators.js'
import { analyzeLongTermTrend, analyzeShortTermTiming } from '../../client/src/lib/technicalMethod/movingAverages.js'
import { analyzeFibonacci } from '../../client/src/lib/technicalMethod/fibonacci.js'
import { detectPriceLevels } from '../../client/src/lib/technicalMethod/levels.js'
import { computeTechnicalMethod } from '../../client/src/lib/technicalMethod/index.js'

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

test('method conclusion remains research-oriented and exposes risk, setup, and completeness', () => {
  const bars = trendBars()
  const method = computeTechnicalMethod(bars, computeAll(bars, '1d'), { best: null, patterns: [] })

  assert.ok(method.score >= 0 && method.score <= 100)
  assert.ok(method.dataCompletenessPercent > 0)
  assert.ok(['watch', 'prepare', 'setup_valid', 'wait', 'avoid'].includes(method.conclusion.actionState))
  assert.ok(method.risk)
  assert.ok(Array.isArray(method.conclusion.invalidationConditions))
})
