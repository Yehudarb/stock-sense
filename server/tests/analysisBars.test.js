import test from 'node:test'
import assert from 'node:assert/strict'
import { getClosedAnalysisBars, isLastBarClosed } from '../../client/src/lib/analysisBars.js'

test('excludes an intraday candle until its interval has closed', () => {
  const openedAt = Date.parse('2026-08-04T14:00:00Z')
  const bars = [{ t: openedAt - 300_000, c: 99 }, { t: openedAt, c: 100 }]

  const active = getClosedAnalysisBars(bars, '5m', openedAt + 120_000)
  assert.equal(active.excludedLiveBar, true)
  assert.equal(active.bars.length, 1)

  const closed = getClosedAnalysisBars(bars, '5m', openedAt + 300_000)
  assert.equal(closed.excludedLiveBar, false)
  assert.equal(closed.bars.length, 2)
})

test('treats the current US daily candle as open before 16:00 Eastern', () => {
  const bar = { t: Date.parse('2026-08-04T13:30:00Z'), c: 100 }
  assert.equal(isLastBarClosed(bar, '1d', Date.parse('2026-08-04T19:00:00Z')), false)
  assert.equal(isLastBarClosed(bar, '1d', Date.parse('2026-08-04T20:01:00Z')), true)
})

test('keeps a previous-session daily candle during the next pre-market', () => {
  const bar = { t: Date.parse('2026-08-03T13:30:00Z'), c: 100 }
  assert.equal(isLastBarClosed(bar, '1d', Date.parse('2026-08-04T12:00:00Z')), true)
})
