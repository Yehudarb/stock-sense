import test from 'node:test'
import assert from 'node:assert/strict'
import { computeAll } from '../../client/src/lib/indicators.js'

function bar(timestamp, price, volume = 1_000) {
  return {
    t: Date.parse(timestamp),
    o: price - 0.2,
    h: price + 1,
    l: price - 1,
    c: price,
    v: volume,
  }
}

function intradayFixture() {
  const bars = []
  for (let index = 0; index < 20; index += 1) {
    bars.push(bar(`2026-08-03T${String(13 + Math.floor((30 + index * 5) / 60)).padStart(2, '0')}:${String((30 + index * 5) % 60).padStart(2, '0')}:00Z`, 100 + index * 0.1))
  }
  for (let index = 0; index < 20; index += 1) {
    bars.push(bar(`2026-08-04T${String(13 + Math.floor((30 + index * 5) / 60)).padStart(2, '0')}:${String((30 + index * 5) % 60).padStart(2, '0')}:00Z`, 120 + index * 0.1))
  }
  return bars
}

function dailyFixture(length = 260) {
  return Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 2 + index))
    const cycle = Math.sin(index / 8) * 3
    return {
      t: date.getTime(),
      o: 100 + index * 0.08 + cycle - 0.4,
      h: 101 + index * 0.08 + cycle,
      l: 99 + index * 0.08 + cycle,
      c: 100 + index * 0.08 + cycle,
      v: 1_000_000 + index * 1_000,
    }
  })
}

function numericArrays(value, path = 'indicators', output = []) {
  if (Array.isArray(value)) {
    output.push([path, value])
    return output
  }
  if (!value || typeof value !== 'object') return output
  for (const [key, child] of Object.entries(value)) numericArrays(child, `${path}.${key}`, output)
  return output
}

test('every indicator series is aligned with the input bars and contains no NaN', () => {
  const bars = dailyFixture()
  const indicators = computeAll(bars, '1d')

  for (const [path, values] of numericArrays(indicators)) {
    assert.equal(values.length, bars.length, `${path} must align with OHLCV`)
    assert.equal(values.some(value => typeof value === 'number' && Number.isNaN(value)), false, `${path} contains NaN`)
  }
})

test('every chart indicator produces usable values after its warm-up period', () => {
  const indicators = computeAll(dailyFixture(), '1d')
  const expectedSeries = {
    sma20: indicators.sma20,
    sma50: indicators.sma50,
    sma100: indicators.sma100,
    sma150: indicators.sma150,
    sma200: indicators.sma200,
    ema9: indicators.ema9,
    ema10: indicators.ema10,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    ema200: indicators.ema200,
    wma20: indicators.wma20,
    wma50: indicators.wma50,
    rsi14: indicators.rsi14,
    atr14: indicators.atr14,
    macd: indicators.macd.line,
    macdSignal: indicators.macd.signal,
    stochasticK: indicators.stoch.k,
    stochasticD: indicators.stoch.d,
    stochRsiK: indicators.stochRsi.k,
    adx: indicators.adx.adx,
    bollingerUpper: indicators.bb20.upper,
    keltnerUpper: indicators.keltner.upper,
    donchianUpper: indicators.donchian.upper,
    supertrend: indicators.supertrend.line,
    vwap: indicators.vwap,
    relativeVolume: indicators.volRatio,
    obv: indicators.obv,
    cci: indicators.cci20,
    mfi: indicators.mfi14,
    cmf: indicators.cmf20,
    adl: indicators.adl,
  }

  for (const [name, values] of Object.entries(expectedSeries)) {
    assert.ok(values.some(Number.isFinite), `${name} did not produce a usable value`)
  }
})

test('Supertrend line uses the lower band in bullish mode and upper band in bearish mode', () => {
  const indicators = computeAll(dailyFixture(), '1d')
  const { direction, line, lower, upper } = indicators.supertrend

  direction.forEach((value, index) => {
    if (value === 'bullish') assert.equal(line[index], lower[index])
    if (value === 'bearish') assert.equal(line[index], upper[index])
  })
})

test('intraday VWAP resets at the start of each US trading session', () => {
  const bars = intradayFixture()
  const indicators = computeAll(bars, '5m')
  const firstSecondSession = bars[20]
  const expectedTypicalPrice = (firstSecondSession.h + firstSecondSession.l + firstSecondSession.c) / 3

  assert.equal(indicators.vwapMode, 'session')
  assert.ok(Math.abs(indicators.vwap[20] - expectedTypicalPrice) < 1e-10)
  assert.ok(indicators.vwap[20] > indicators.vwap[19] + 10, 'the prior session must not leak into the new VWAP')
})

test('intraday pivots and previous high-low use the prior session, not the prior candle', () => {
  const bars = intradayFixture()
  const indicators = computeAll(bars, '5m')
  const previousSession = bars.slice(0, 20)
  const previousHigh = Math.max(...previousSession.map(item => item.h))
  const previousLow = Math.min(...previousSession.map(item => item.l))
  const previousClose = previousSession.at(-1).c
  const expectedPivot = (previousHigh + previousLow + previousClose) / 3

  assert.ok(Math.abs(indicators.pivotPoints.pivot - expectedPivot) < 1e-10)
  assert.equal(indicators.priceLevels.previousHigh, previousHigh)
  assert.equal(indicators.priceLevels.previousLow, previousLow)
  assert.equal(indicators.priceLevels.high52Week, null)
  assert.equal(indicators.priceLevels.low52Week, null)
})

test('Ichimoku leading spans are displaced forward and Chikou is displaced backward', () => {
  const bars = dailyFixture(140)
  const indicators = computeAll(bars, '1d')
  const firstSpanA = indicators.ichimoku.spanA.findIndex(value => value != null)

  assert.ok(firstSpanA >= 76, `expected displaced cloud, first Span A was ${firstSpanA}`)
  assert.equal(indicators.ichimoku.laggingSpan[0], bars[26].c)
  assert.deepEqual(indicators.ichimoku.laggingSpan.slice(-26), Array(26).fill(null))
})

test('daily VWAP is a rolling 20-session value rather than an arbitrary full-history anchor', () => {
  const bars = dailyFixture(40)
  const indicators = computeAll(bars, '1d')
  const window = bars.slice(-20)
  const totalVolume = window.reduce((sum, item) => sum + item.v, 0)
  const expected = window.reduce((sum, item) => sum + ((item.h + item.l + item.c) / 3) * item.v, 0) / totalVolume

  assert.equal(indicators.vwapMode, 'rolling-20')
  assert.ok(Math.abs(indicators.vwap.at(-1) - expected) < 1e-10)
})
