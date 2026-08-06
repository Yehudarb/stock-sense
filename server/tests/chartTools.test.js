import test from 'node:test'
import assert from 'node:assert/strict'

import { activeSmaKeys, buildGapMarkers, buildPatternMarkers, formatProTimeAxisLabel } from '../../client/src/components/charts/chartHelpers.js'
import { detectRecentCandlestickPatterns } from '../../client/src/lib/patterns.js'

function barsWithHammer() {
  const bars = Array.from({ length: 34 }, (_, index) => ({
    t: Date.UTC(2026, 0, index + 1),
    o: 100 + index * 0.1,
    h: 101 + index * 0.1,
    l: 99 + index * 0.1,
    c: 100.4 + index * 0.1,
    v: 1_000_000,
  }))
  bars[30] = {
    ...bars[30],
    o: 103,
    h: 104.4,
    l: 100,
    c: 104,
  }
  return bars
}

test('recent candlestick detection retains a historical Hammer marker', () => {
  const patterns = detectRecentCandlestickPatterns(barsWithHammer(), 20)
  const hammer = patterns.find(pattern => pattern.key === 'HAMMER' && pattern.visual?.endIndex === 30)

  assert.ok(hammer, 'historical Hammer was not retained for the chart')
})

test('single-point candlestick patterns become visible chart markers', () => {
  const bars = barsWithHammer()
  const pattern = {
    key: 'HAMMER',
    label: 'Hammer',
    category: 'Candlestick',
    direction: 'bullish',
    weight: 48,
    visual: { startIndex: 28, endIndex: 30, points: [{ index: 30, price: bars[30].c }] },
  }

  const markers = buildPatternMarkers(bars, { patterns: [], markers: [pattern] })

  assert.equal(markers.length, 1)
  assert.equal(markers[0].shape, 'arrowUp')
  assert.equal(markers[0].position, 'belowBar')
  assert.equal(markers[0].text, 'Hammer')
  assert.equal(markers[0].time, Math.floor(bars[30].t / 1000))
})

test('pattern markers are chronological and capped by recency', () => {
  const bars = barsWithHammer()
  const markers = buildPatternMarkers(bars, {
    markers: [10, 20, 30].map(index => ({
      key: `PATTERN_${index}`,
      label: `Pattern ${index}`,
      category: 'Candlestick',
      direction: 'neutral',
      visual: { endIndex: index },
    })),
  }, 2)

  assert.deepEqual(markers.map(marker => marker.text), ['Pattern 20', 'Pattern 30'])
  assert.ok(markers[0].time < markers[1].time)
})

test('a one-bar gap still produces a visible marker', () => {
  const bars = barsWithHammer()
  const index = bars.length - 1
  const markers = buildGapMarkers(bars, {
    gaps: [{ id: 'latest', index, endIndex: index, direction: 'down', status: 'open' }],
  }, 0, index)

  assert.equal(markers.length, 1)
  assert.equal(markers[0].shape, 'arrowDown')
  assert.match(markers[0].text, /Gap.*open/)
})

test('Micha overlay uses only the method moving averages', () => {
  assert.deepEqual(activeSmaKeys(true), ['sma20', 'sma150', 'sma200'])
  assert.deepEqual(activeSmaKeys(false), ['sma20', 'sma50', 'sma100', 'sma150', 'sma200'])
})

test('Pro chart time axis keeps dates visible for daily and intraday bars', () => {
  const timestamp = Date.UTC(2026, 7, 3, 14, 30) / 1000

  assert.equal(formatProTimeAxisLabel(timestamp, '1d', 'he'), 'ב׳ 03.08')
  assert.equal(formatProTimeAxisLabel(timestamp, '15m', 'he'), '03.08 14:30')
  assert.equal(formatProTimeAxisLabel(timestamp, '1y', 'he'), '08.26')
})
