import test from 'node:test'
import assert from 'node:assert/strict'

import { maTrendStructure, structureReading } from '../../client/src/lib/maStructure.js'

// Builds indicator arrays directly: this module reads the last value of each
// series and the 200's slope, so the inputs can be stated exactly rather than
// coaxed out of synthetic bars.
function indicators({ sma50, sma150, sma200, slope200 = 0 } = {}) {
  const flat = (v) => (v == null ? null : Array(60).fill(v))
  const rising = (end, pct) => {
    if (end == null) return null
    const start = end / (1 + pct / 100)
    return Array.from({ length: 60 }, (_, i) => start + (end - start) * (i / 59))
  }
  return {
    sma50: flat(sma50),
    sma150: flat(sma150),
    sma200: slope200 ? rising(sma200, slope200) : flat(sma200),
  }
}

test('returns null without the long averages', () => {
  assert.equal(maTrendStructure(null, 100), null)
  assert.equal(maTrendStructure(indicators({ sma50: 90 }), 100), null)
  assert.equal(maTrendStructure(indicators({ sma150: 90, sma200: 80 }), NaN), null)
})

test('full alignment passes every check', () => {
  const s = maTrendStructure(indicators({ sma50: 95, sma150: 90, sma200: 85, slope200: 3 }), 100)
  assert.equal(s.state, 'aligned')
  assert.equal(s.aligned, true)
  assert.equal(s.passed, s.total)
  assert.equal(s.total, 5)
})

test('price below both long averages reads as broken', () => {
  const s = maTrendStructure(indicators({ sma50: 95, sma150: 110, sma200: 115, slope200: 3 }), 100)
  assert.equal(s.state, 'broken')
  assert.ok(s.passed < s.total)
})

// The middle state is the one worth having: above a long average but not yet
// stacked is a different situation from a downtrend, and a pass count alone
// cannot express that.
test('above a long average but unstacked reads as repairing, not broken', () => {
  const s = maTrendStructure(indicators({ sma50: 80, sma150: 95, sma200: 90, slope200: 3 }), 100)
  assert.equal(s.state, 'repairing')
  assert.notEqual(s.state, 'aligned')
})

test('a barely-drifting 200 does not count as rising', () => {
  const crawling = maTrendStructure(indicators({ sma50: 95, sma150: 90, sma200: 85, slope200: 0.1 }), 100)
  const rising = maTrendStructure(indicators({ sma50: 95, sma150: 90, sma200: 85, slope200: 3 }), 100)
  assert.equal(crawling.checks.find(c => c.key === 'ma200Rising').pass, false)
  assert.equal(rising.checks.find(c => c.key === 'ma200Rising').pass, true)
  assert.equal(crawling.aligned, false)
})

// An unavailable input is not a failed test. Grading a stock down for data we
// never had would misreport a young listing as a broken trend.
test('an unknown check is excluded from the count rather than failed', () => {
  const s = maTrendStructure(indicators({ sma50: null, sma150: 90, sma200: 85, slope200: 3 }), 100)
  assert.equal(s.checks.find(c => c.key === 'ma50Above150').pass, null)
  assert.equal(s.total, 4, 'the unknown check should not be counted')
  assert.equal(s.aligned, true, 'the known checks all pass')
})

test('distances are reported relative to each average', () => {
  const s = maTrendStructure(indicators({ sma50: 95, sma150: 90, sma200: 80, slope200: 3 }), 100)
  assert.ok(Math.abs(s.distances.to150Pct - 11.11) < 0.1)
  assert.ok(Math.abs(s.distances.to200Pct - 25) < 0.1)
})

test('the reading names the state and never implies an entry', () => {
  const aligned = maTrendStructure(indicators({ sma50: 95, sma150: 90, sma200: 85, slope200: 3 }), 100)
  const text = structureReading(aligned, 'en')
  assert.match(text, /participation filter/)
  assert.match(text, /not an entry/)
  assert.match(structureReading(null, 'en'), /Not enough history/)
})

// ── ladder order ─────────────────────────────────────────────────────────
import { maStackOrder } from '../../client/src/lib/maStructure.js'

const ladder = (o) => ({
  sma20: Array(60).fill(o[0]), sma50: Array(60).fill(o[1]), sma100: Array(60).fill(o[2]),
  sma150: Array(60).fill(o[3]), sma200: Array(60).fill(o[4]),
})

test('a fully descending ladder reads bullish', () => {
  const s = maStackOrder(ladder([120, 110, 100, 90, 80]))
  assert.equal(s.order, 'bullish')
  assert.equal(s.monotonic, true)
  assert.deepEqual(s.breaks, [], 'a monotonic ladder has nothing to report')
})

test('a fully ascending ladder reads bearish', () => {
  const s = maStackOrder(ladder([80, 90, 100, 110, 120]))
  assert.equal(s.order, 'bearish')
  assert.equal(s.monotonic, true)
})

// The case that prompted the ladder: TSLA had sma100 below sma50 while every
// template condition failed identically, so the template could not see it.
test('names the pair where the ladder breaks', () => {
  const s = maStackOrder(ladder([368, 393, 390, 403, 412]))
  assert.equal(s.order, 'mixed')
  assert.equal(s.monotonic, false)
  assert.ok(s.breaks.length > 0)
  assert.ok(s.breaks.some(b => b.faster === 'sma50' && b.slower === 'sma100'))
})

test('needs at least three known averages to say anything', () => {
  assert.equal(maStackOrder({ sma20: [10], sma50: [9] }), null)
  assert.equal(maStackOrder(null), null)
  assert.equal(maStackOrder({}), null)
})

test('an equal pair is not monotonic in either direction', () => {
  const s = maStackOrder(ladder([100, 100, 90, 80, 70]))
  assert.equal(s.order, 'mixed', 'a tie breaks a strict ordering')
})
