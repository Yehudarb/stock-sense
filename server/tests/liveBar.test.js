import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeTickIntoBars, shouldApplyTick } from '../../client/src/lib/liveBar.js'

const DAY = Date.UTC(2026, 6, 31, 14, 0, 0)
const bars = (n = 3, lastT = DAY) => Array.from({ length: n }, (_, i) => ({
  t: lastT - (n - 1 - i) * 86400000,
  o: 100, h: 102, l: 98, c: 100, v: 1_000_000,
}))

test('folds the tick into the last bar', () => {
  const out = mergeTickIntoBars(bars(), { price: 101, volume: 1_500_000, timestamp: DAY + 3600_000 }, '1d')
  const last = out.at(-1)
  assert.equal(last.c, 101)
  assert.equal(last.v, 1_500_000)
  assert.equal(last.h, 102, 'a price inside the range must not widen it')
  assert.equal(last.l, 98)
})

test('extends the high and low when the tick trades outside them', () => {
  const up = mergeTickIntoBars(bars(), { price: 105, timestamp: DAY }, '1d').at(-1)
  assert.equal(up.h, 105)
  assert.equal(up.l, 98)
  const down = mergeTickIntoBars(bars(), { price: 95, timestamp: DAY }, '1d').at(-1)
  assert.equal(down.l, 95)
  assert.equal(down.h, 102)
})

test('does not mutate the array or the bar it was given', () => {
  const input = bars()
  const original = { ...input.at(-1) }
  const out = mergeTickIntoBars(input, { price: 111, timestamp: DAY }, '1d')
  assert.notEqual(out, input)
  assert.deepEqual(input.at(-1), original, 'the source bar must be untouched')
})

// The property that keeps this from corrupting history: a quote belongs to the
// current session, and the last loaded bar may be an earlier one — pre-market,
// or a stale page left open overnight.
test('refuses a tick from a different session than the last daily bar', () => {
  const input = bars()
  const nextDay = DAY + 86400000
  assert.equal(mergeTickIntoBars(input, { price: 130, timestamp: nextDay }, '1d'), input,
    'the same array is returned, so nothing downstream re-renders')
})

test('refuses a tick older than the last bar', () => {
  const input = bars()
  assert.equal(mergeTickIntoBars(input, { price: 130, timestamp: DAY - 86400000 }, '5m'), input)
})

// A tick carries the day's running volume. On a 5-minute bar that number
// belongs to no single bar and would inflate it enormously.
test('only applies volume on session-length intervals', () => {
  const daily = mergeTickIntoBars(bars(), { price: 101, volume: 9_000_000, timestamp: DAY }, '1d').at(-1)
  assert.equal(daily.v, 9_000_000)

  const intraday = mergeTickIntoBars(bars(), { price: 101, volume: 9_000_000, timestamp: DAY }, '5m').at(-1)
  assert.equal(intraday.v, 1_000_000, 'session volume must not be written onto a 5-minute bar')
})

test('volume never moves backwards', () => {
  const out = mergeTickIntoBars(bars(), { price: 101, volume: 500_000, timestamp: DAY }, '1d').at(-1)
  assert.equal(out.v, 1_000_000, 'a lower reported volume is a stale quote, not a correction')
})

test('returns the same reference when nothing changed', () => {
  const input = bars()
  const same = mergeTickIntoBars(input, { price: 100, volume: 1_000_000, timestamp: DAY }, '1d')
  assert.equal(same, input, 'an unchanged bar must not trigger a recompute')
})

test('rejects unusable input', () => {
  assert.equal(mergeTickIntoBars([], { price: 1 }, '1d').length, 0)
  assert.equal(mergeTickIntoBars(null, { price: 1 }, '1d'), null)
  const input = bars()
  assert.equal(mergeTickIntoBars(input, { price: 0 }, '1d'), input)
  assert.equal(mergeTickIntoBars(input, { price: NaN }, '1d'), input)
  assert.equal(mergeTickIntoBars(input, null, '1d'), input)
})

// ── throttle ─────────────────────────────────────────────────────────────

test('the first tick always applies', () => {
  assert.equal(shouldApplyTick({ lastAppliedAt: null, tickPrice: 100 }), true)
})

test('holds off inside the window when price is quiet', () => {
  assert.equal(shouldApplyTick({
    lastAppliedAt: 1000, lastAppliedPrice: 100, tickPrice: 100.01, now: 4000,
  }), false, '3 seconds later and 0.01% is not worth a full recompute')
})

test('lets a real move through before the timer', () => {
  assert.equal(shouldApplyTick({
    lastAppliedAt: 1000, lastAppliedPrice: 100, tickPrice: 100.5, now: 4000,
  }), true, '0.5% should not wait')
})

test('applies once the interval elapses regardless of movement', () => {
  assert.equal(shouldApplyTick({
    lastAppliedAt: 1000, lastAppliedPrice: 100, tickPrice: 100, now: 1000 + 15000,
  }), true)
})

test('never applies an unusable price', () => {
  assert.equal(shouldApplyTick({ lastAppliedAt: null, tickPrice: 0 }), false)
  assert.equal(shouldApplyTick({ lastAppliedAt: null, tickPrice: NaN }), false)
})
