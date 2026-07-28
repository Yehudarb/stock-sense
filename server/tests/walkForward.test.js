import test from 'node:test'
import assert from 'node:assert/strict'

import { runWalkForward, runSplitSample, actionFromSignal } from '../../client/src/lib/walkForward.js'

// Deterministic synthetic series — no network, no indicator library. The
// harness under test does not care what produced the bars.
function makeBars(count, { start = 100, drift = 0.05, wobble = 3 } = {}) {
  const bars = []
  let close = start
  for (let i = 0; i < count; i += 1) {
    close += drift + Math.sin(i / 9) * (wobble / 6)
    bars.push({
      t: Date.UTC(2024, 0, 1) + i * 86400000,
      o: close - 0.15,
      h: close + 0.6,
      l: close - 0.6,
      c: close,
      v: 1_000_000 + (i % 17) * 25_000,
    })
  }
  return bars
}

// Alternates purely on the length of the slice it is given, so expected
// bucketing is predictable.
const alternating = (history) => (history.length % 2 === 0 ? 'BUY' : 'SELL')

test('requires an injected decision function', () => {
  assert.throws(() => runWalkForward(makeBars(300)), TypeError)
  assert.throws(() => runWalkForward(makeBars(300), { computeAction: 'nope' }), TypeError)
})

test('returns null when there is not enough history', () => {
  assert.equal(runWalkForward(makeBars(50), { computeAction: alternating }), null)
  assert.equal(runWalkForward([], { computeAction: alternating }), null)
  assert.equal(runWalkForward(null, { computeAction: alternating }), null)
})

test('buckets forward returns by action and the buckets reconcile to the baseline', () => {
  const result = runWalkForward(makeBars(420), { computeAction: alternating, warmup: 220, horizon: 10 })
  assert.ok(result)
  assert.ok(result.baseline.n > 0)
  const bucketTotal = Object.values(result.byAction).reduce((sum, b) => sum + b.n, 0)
  assert.equal(bucketTotal, result.baseline.n)
  assert.equal(result.meta.evaluated, result.baseline.n)
})

test('skips bars where the decision function returns nothing', () => {
  const onlyEvery3rd = (history) => (history.length % 3 === 0 ? 'HOLD' : null)
  const result = runWalkForward(makeBars(500), { computeAction: onlyEvery3rd, warmup: 220, horizon: 10, overlapping: true })
  assert.ok(result.baseline.n > 0)
  assert.deepEqual(Object.keys(result.byAction), ['HOLD'])
})

test('a throwing decision function is counted, not fatal', () => {
  let calls = 0
  const flaky = () => { calls += 1; if (calls % 2 === 0) throw new Error('boom'); return 'BUY' }
  const result = runWalkForward(makeBars(500), { computeAction: flaky, warmup: 220, horizon: 10, overlapping: true })
  assert.ok(result.meta.errors > 0)
  assert.ok(result.baseline.n > 0)
})

test('non-overlapping is the default and steps a full horizon', () => {
  const bars = makeBars(500)
  const clean = runWalkForward(bars, { computeAction: alternating, warmup: 220, horizon: 10 })
  const overlapping = runWalkForward(bars, { computeAction: alternating, warmup: 220, horizon: 10, overlapping: true })

  assert.equal(clean.meta.overlapping, false)
  assert.equal(clean.meta.step, 10)
  assert.equal(overlapping.meta.step, 1)
  // Same data, ~10x the observations — precisely why overlapping t-stats
  // cannot be read at face value.
  assert.ok(overlapping.baseline.n > clean.baseline.n * 5)
})

// The property everything else rests on. If the harness ever handed the
// decision function a bar at or beyond the evaluation index, every result
// above would be hindsight.
test('the decision function never sees a bar at or beyond the evaluated index', () => {
  const bars = makeBars(420)
  const seen = []
  const recording = (history) => {
    seen.push({ len: history.length, lastT: history[history.length - 1].t })
    return 'BUY'
  }
  runWalkForward(bars, { computeAction: recording, warmup: 220, horizon: 10 })

  seen.forEach((call, k) => {
    const evaluatedIndex = 220 + k * 10
    // slice(0, i + 1) means exactly i + 1 bars, ending on bar i itself.
    assert.equal(call.len, evaluatedIndex + 1)
    assert.equal(call.lastT, bars[evaluatedIndex].t)
  })
})

test('mutating the future does not change the actions produced before it', () => {
  const bars = makeBars(420)
  const tampered = bars.map((bar, i) => (
    i > 300 ? { ...bar, o: bar.o * 3, h: bar.h * 3, l: bar.l * 3, c: bar.c * 3 } : bar
  ))
  const collect = (series) => {
    const out = []
    runWalkForward(series, {
      warmup: 220,
      horizon: 10,
      computeAction: (history) => {
        const action = history[history.length - 1].c > history[0].c ? 'BUY' : 'SELL'
        if (history.length <= 291) out.push(action)   // samples closing before bar 301
        return action
      },
    })
    return out
  }
  assert.deepEqual(collect(bars), collect(tampered))
})

test('edge and significance are measured against the baseline, not zero', () => {
  const result = runWalkForward(makeBars(500), { computeAction: alternating, warmup: 220, horizon: 10 })
  for (const bucket of Object.values(result.byAction)) {
    assert.ok(Number.isFinite(bucket.edge))
    assert.ok(Math.abs((bucket.mean - result.baseline.mean) - bucket.edge) < 1e-9)
    assert.equal(bucket.significant, Math.abs(bucket.tStat) >= 2)
  }
})

test('split sample evaluates the halves independently', () => {
  const split = runSplitSample(makeBars(700), { computeAction: alternating, warmup: 220, horizon: 10 })
  assert.ok(split)
  assert.ok(split.early.baseline.n > 0)
  assert.ok(split.late.baseline.n > 0)
  assert.ok(split.late.meta.warmup > split.early.meta.warmup)
})

test('actionFromSignal unwraps a signal object and tolerates a null signal', () => {
  assert.equal(actionFromSignal(() => ({ action: 'BUY' }))([]), 'BUY')
  assert.equal(actionFromSignal(() => null)([]), null)
  assert.equal(actionFromSignal(() => ({}))([]), null)
})
