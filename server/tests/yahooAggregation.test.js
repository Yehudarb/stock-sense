import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateBarsBySession } from '../services/yahooFinance.js'

function hourlyBar(timestamp, price) {
  return {
    t: Date.parse(timestamp),
    o: price,
    h: price + 1,
    l: price - 1,
    c: price + 0.5,
    v: 100,
  }
}

test('4-hour aggregation never combines bars from different US sessions', () => {
  const bars = [
    hourlyBar('2026-08-03T19:30:00Z', 100),
    hourlyBar('2026-08-04T13:30:00Z', 110),
    hourlyBar('2026-08-04T14:30:00Z', 111),
    hourlyBar('2026-08-04T15:30:00Z', 112),
    hourlyBar('2026-08-04T16:30:00Z', 113),
  ]

  const aggregated = aggregateBarsBySession(bars, 4)

  assert.equal(aggregated.length, 2)
  assert.equal(aggregated[0].o, 100)
  assert.equal(aggregated[0].c, 100.5)
  assert.equal(aggregated[1].o, 110)
  assert.equal(aggregated[1].c, 113.5)
  assert.equal(aggregated[1].v, 400)
})
