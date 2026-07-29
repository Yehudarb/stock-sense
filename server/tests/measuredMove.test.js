import test from 'node:test'
import assert from 'node:assert/strict'

import { measuredMoveTargets } from '../../client/src/components/charts/chartHelpers.js'

// Builds a series with an explicit deep low, then a shallower recent range, so
// the two anchors are known in advance rather than inferred from noise.
function series({ deepLow = null, recentLow = 80, recentHigh = 100, bars = 400 } = {}) {
  const out = []
  for (let i = 0; i < bars; i += 1) {
    // Oscillate inside the recent range for the last 252 bars.
    const mid = (recentLow + recentHigh) / 2
    const amp = (recentHigh - recentLow) / 2
    let c = mid + Math.sin(i / 11) * amp
    // Park an older, deeper base outside the 52-week window.
    if (deepLow != null && i > 20 && i < 40) c = deepLow + (i % 3) * 0.1
    out.push({
      t: Date.UTC(2024, 0, 1) + i * 86400000,
      o: c, h: c + 0.5, l: c - 0.5, c, v: 1_000_000,
    })
  }
  return out
}

test('refuses inputs it cannot measure', () => {
  assert.deepEqual(measuredMoveTargets(null, 100), [])
  assert.deepEqual(measuredMoveTargets(series(), NaN), [])
  assert.deepEqual(measuredMoveTargets(series(), 0), [])
  assert.deepEqual(measuredMoveTargets(series().slice(0, 10), 100), [])
})

test('projects the 52-week range height from the breakout', () => {
  const bars = series({ recentLow: 80, recentHigh: 100 })
  const [range] = measuredMoveTargets(bars, 100, 'bullish')
  assert.equal(range.key, 'range52')
  // Height is high - low of the last 252 bars; the +/-0.5 wick makes it 21.
  assert.ok(Math.abs(range.price - 121) < 1.5, `got ${range.price}`)
  assert.match(range.basis, /–/)   // the anchor is stated, not implied
})

test('adds a base anchor only when a deeper swing low exists below the 52-week low', () => {
  const withBase = measuredMoveTargets(series({ deepLow: 40 }), 100, 'bullish')
  const withoutBase = measuredMoveTargets(series({ deepLow: null }), 100, 'bullish')

  assert.ok(withBase.some(t => t.key === 'base'), 'expected a base anchor')
  // No wider structure in view means no wider target — silence is the honest
  // answer, not a fabricated deeper low.
  assert.ok(!withoutBase.some(t => t.key === 'base'))
})

test('the base anchor produces a further target than the 52-week one', () => {
  const targets = measuredMoveTargets(series({ deepLow: 40 }), 100, 'bullish')
  const range = targets.find(t => t.key === 'range52')
  const base = targets.find(t => t.key === 'base')
  assert.ok(base.price > range.price, 'a deeper base implies a taller projection')
  // Sorted nearest-first so the conservative number is read first.
  assert.equal(targets[0].key, 'range52')
})

test('bearish setups get nothing — the technique does not invert', () => {
  // Projecting a base height downward is not the measured move for a topping
  // pattern; on TSLA it asserted a 72% collapse from arithmetic alone. A
  // topping pattern already carries its own classic target.
  assert.deepEqual(measuredMoveTargets(series({ deepLow: 40 }), 100, 'bearish'), [])
})

test('never emits a non-positive price', () => {
  for (const t of measuredMoveTargets(series({ deepLow: 40 }), 5, 'bullish')) {
    assert.ok(t.price > 0)
  }
})
