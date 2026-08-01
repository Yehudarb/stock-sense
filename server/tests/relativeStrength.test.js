import test from 'node:test'
import assert from 'node:assert/strict'

import { relativeStrength, rangePosition } from '../../client/src/lib/relativeStrength.js'

const ramp = (from, to, n = 100) =>
  Array.from({ length: n }, (_, i) => ({ c: from + ((to - from) * i) / (n - 1) }))

test('outperformance shows as a rising ratio', () => {
  const rs = relativeStrength(ramp(100, 150), ramp(100, 110), 63)
  assert.ok(rs.outperforming)
  assert.ok(rs.changePct > 0)
  assert.ok(rs.stockPct > rs.benchmarkPct)
})

// The case price alone cannot express: both legs are losses, but one is far
// smaller, and a stock holding up through a decline is behaving differently
// from one merely falling.
test('falling less than the benchmark is outperformance', () => {
  const rs = relativeStrength(ramp(100, 95), ramp(100, 80), 63)
  assert.ok(rs.outperforming, 'down 5% against a benchmark down 20% is strength')
  assert.ok(rs.stockPct < 0 && rs.benchmarkPct < 0, 'both legs are still losses')
})

test('rising less than the benchmark is underperformance', () => {
  const rs = relativeStrength(ramp(100, 105), ramp(100, 130), 63)
  assert.equal(rs.outperforming, false)
  assert.ok(rs.stockPct > 0, 'a gain can still lag')
})

test('both series need enough history', () => {
  assert.equal(relativeStrength(ramp(100, 150, 10), ramp(100, 110, 10), 63), null)
  assert.equal(relativeStrength(ramp(100, 150), ramp(100, 110, 10), 63), null)
  assert.equal(relativeStrength(null, ramp(100, 110), 63), null)
})

test('a zero benchmark price cannot produce a ratio', () => {
  const broken = ramp(100, 110)
  broken[broken.length - 1] = { c: 0 }
  assert.equal(relativeStrength(ramp(100, 150), broken, 63), null)
})

// ── range position ───────────────────────────────────────────────────────

const band = (low, high, close) => [{ h: high, l: low, c: close }, { h: high, l: low, c: close }]

test('places the close inside the range', () => {
  assert.equal(rangePosition(band(50, 150, 150)).position, 1)
  assert.equal(rangePosition(band(50, 150, 50)).position, 0)
  assert.equal(rangePosition(band(50, 150, 100)).position, 0.5)
})

// "92% of the range" and "8% below the high" answer different questions, so
// both are reported.
test('reports distance to each extreme as well as the position', () => {
  const r = rangePosition(band(50, 150, 100))
  assert.ok(Math.abs(r.fromHighPct - (-33.33)) < 0.1)
  assert.ok(Math.abs(r.fromLowPct - 100) < 0.1)
  assert.equal(r.high, 150)
  assert.equal(r.low, 50)
})

test('a flat series has no range, and says so', () => {
  assert.equal(rangePosition(band(100, 100, 100)), null, 'better than dividing by zero and returning 0.5')
  assert.equal(rangePosition([]), null)
  assert.equal(rangePosition(null), null)
})

test('only the requested window is measured', () => {
  const bars = [
    ...Array.from({ length: 300 }, () => ({ h: 500, l: 10, c: 100 })),  // ancient extremes
    ...Array.from({ length: 252 }, () => ({ h: 120, l: 80, c: 100 })),
  ]
  const r = rangePosition(bars, 252)
  assert.equal(r.high, 120, 'a high outside the window must not widen the range')
  assert.equal(r.low, 80)
})
