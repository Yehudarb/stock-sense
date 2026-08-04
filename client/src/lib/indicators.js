import {
  ADL,
  ADX,
  ATR,
  BollingerBands,
  CCI,
  EMA,
  IchimokuCloud,
  KeltnerChannels,
  MACD,
  MFI,
  OBV,
  RSI,
  SMA,
  Stochastic,
  StochasticRSI,
  WilliamsR,
  WMA,
} from 'technicalindicators'

function pad(arr, totalLen) {
  const fill = totalLen - arr.length
  return [...Array(Math.max(0, fill)).fill(null), ...arr]
}

const INTRADAY_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h'])
const SESSION_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function sessionKey(timestamp) {
  const parts = SESSION_FORMATTER.formatToParts(new Date(timestamp))
  const value = type => parts.find(part => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

function isIntradaySeries(ohlcv, interval) {
  if (INTRADAY_INTERVALS.has(interval)) return true
  if (interval) return false

  const tail = ohlcv.slice(-40)
  return tail.some((bar, index) => (
    index > 0 && sessionKey(bar.t) === sessionKey(tail[index - 1].t)
  ))
}

function aggregateSessions(ohlcv) {
  const sessions = []
  for (const bar of ohlcv) {
    const key = sessionKey(bar.t)
    const current = sessions.at(-1)
    if (!current || current.key !== key) {
      sessions.push({ key, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v ?? 0 })
      continue
    }
    current.h = Math.max(current.h, bar.h)
    current.l = Math.min(current.l, bar.l)
    current.c = bar.c
    current.v += bar.v ?? 0
  }
  return sessions
}

function shiftForward(values, periods) {
  return values.map((_value, index) => (index >= periods ? values[index - periods] : null))
}

function shiftBackward(values, periods) {
  return values.map((_value, index) => (index + periods < values.length ? values[index + periods] : null))
}

function calculateVwap(ohlcv, intraday, rollingPeriod = 20) {
  if (intraday) {
    let activeSession = null
    let cumulativeTpv = 0
    let cumulativeVolume = 0
    return ohlcv.map(bar => {
      const key = sessionKey(bar.t)
      if (key !== activeSession) {
        activeSession = key
        cumulativeTpv = 0
        cumulativeVolume = 0
      }
      const volume = bar.v ?? 0
      const typicalPrice = (bar.h + bar.l + bar.c) / 3
      cumulativeTpv += typicalPrice * volume
      cumulativeVolume += volume
      return cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null
    })
  }

  return ohlcv.map((_bar, index) => {
    const window = ohlcv.slice(Math.max(0, index - rollingPeriod + 1), index + 1)
    const volume = window.reduce((sum, bar) => sum + (bar.v ?? 0), 0)
    if (volume <= 0) return null
    const tpv = window.reduce((sum, bar) => sum + ((bar.h + bar.l + bar.c) / 3) * (bar.v ?? 0), 0)
    return tpv / volume
  })
}

function donchian(highs, lows, period, _totalLen) {
  const upper = [], lower = [], middle = []
  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); middle.push(null); continue }
    const slice_h = highs.slice(i - period + 1, i + 1)
    const slice_l = lows.slice(i - period + 1, i + 1)
    const high = Math.max(...slice_h)
    const low = Math.min(...slice_l)
    upper.push(high)
    lower.push(low)
    middle.push((high + low) / 2)
  }
  return { upper, lower, middle }
}

function momentum(values, period = 10) {
  return values.map((value, index) => (
    index < period || values[index - period] == null ? null : value - values[index - period]
  ))
}

function chaikinMoneyFlow(ohlcv, period = 20) {
  return ohlcv.map((bar, index) => {
    if (index < period - 1) return null
    const slice = ohlcv.slice(index - period + 1, index + 1)
    const moneyFlowVolume = slice.reduce((sum, item) => {
      const range = item.h - item.l
      if (!range) return sum
      const multiplier = ((item.c - item.l) - (item.h - item.c)) / range
      return sum + multiplier * (item.v ?? 0)
    }, 0)
    const volume = slice.reduce((sum, item) => sum + (item.v ?? 0), 0)
    return volume ? moneyFlowVolume / volume : null
  })
}

function supertrend(ohlcv, atrValues, multiplier = 3) {
  const upper = []
  const lower = []
  const line = []
  const direction = []
  const flipped = []

  ohlcv.forEach((bar, index) => {
    const atr = atrValues[index]
    if (atr == null) {
      upper.push(null)
      lower.push(null)
      line.push(null)
      direction.push(null)
      flipped.push(false)
      return
    }

    const hl2 = (bar.h + bar.l) / 2
    const basicUpper = hl2 + multiplier * atr
    const basicLower = hl2 - multiplier * atr
    const prevUpper = upper[index - 1]
    const prevLower = lower[index - 1]
    const prevClose = ohlcv[index - 1]?.c
    const prevDirection = direction[index - 1]

    const finalUpper = prevUpper != null && prevClose != null && prevClose <= prevUpper
      ? Math.min(basicUpper, prevUpper)
      : basicUpper
    const finalLower = prevLower != null && prevClose != null && prevClose >= prevLower
      ? Math.max(basicLower, prevLower)
      : basicLower

    const nextDirection = prevDirection == null
      ? (bar.c >= hl2 ? 'bullish' : 'bearish')
      : prevDirection === 'bullish'
        ? (bar.c < finalLower ? 'bearish' : 'bullish')
        : (bar.c > finalUpper ? 'bullish' : 'bearish')

    upper.push(finalUpper)
    lower.push(finalLower)
    direction.push(nextDirection)
    line.push(nextDirection === 'bullish' ? finalLower : finalUpper)
    flipped.push(index > 0 && direction[index - 1] != null && direction[index - 1] !== nextDirection)
  })

  return { upper, lower, line, direction, flipped }
}

function pivotPoints(ohlcv, intraday) {
  const sessions = aggregateSessions(ohlcv)
  const previous = intraday
    ? sessions[sessions.length - 2]
    : ohlcv[ohlcv.length - 2]
  if (!previous) return null

  const pivot = (previous.h + previous.l + previous.c) / 3
  const range = previous.h - previous.l

  return {
    pivot,
    r1: 2 * pivot - previous.l,
    s1: 2 * pivot - previous.h,
    r2: pivot + range,
    s2: pivot - range,
    r3: previous.h + 2 * (pivot - previous.l),
    s3: previous.l - 2 * (previous.h - pivot),
  }
}

function priceLevels(ohlcv, intraday) {
  const recent = ohlcv.slice(-60)
  const lookback52 = intraday ? [] : ohlcv.slice(-252)
  const sessions = aggregateSessions(ohlcv)
  const previous = sessions[sessions.length - 2]

  return {
    previousHigh: previous?.h ?? null,
    previousLow: previous?.l ?? null,
    recentHigh: recent.length ? Math.max(...recent.map(bar => bar.h)) : null,
    recentLow: recent.length ? Math.min(...recent.map(bar => bar.l)) : null,
    high52Week: lookback52.length ? Math.max(...lookback52.map(bar => bar.h)) : null,
    low52Week: lookback52.length ? Math.min(...lookback52.map(bar => bar.l)) : null,
  }
}

export function computeAll(ohlcv, interval = null) {
  if (!ohlcv || ohlcv.length < 30) return null

  const closes  = ohlcv.map(b => b.c)
  const highs   = ohlcv.map(b => b.h)
  const lows    = ohlcv.map(b => b.l)
  const opens   = ohlcv.map(b => b.o)
  const volumes = ohlcv.map(b => b.v)
  const n = ohlcv.length
  const intraday = isIntradaySeries(ohlcv, interval)

  const sma20Raw  = SMA.calculate({ values: closes, period: 20 })
  const sma50Raw  = SMA.calculate({ values: closes, period: 50 })
  const sma100Raw = SMA.calculate({ values: closes, period: 100 })
  // 150 is the trend filter this workflow actually uses (price above the 150
  // MA as a participation gate); it sits between the 100 and 200 already here.
  const sma150Raw = SMA.calculate({ values: closes, period: 150 })
  const sma200Raw = SMA.calculate({ values: closes, period: 200 })
  const ema9Raw   = EMA.calculate({ values: closes, period: 9 })
  const ema10Raw  = EMA.calculate({ values: closes, period: 10 })
  const ema20Raw  = EMA.calculate({ values: closes, period: 20 })
  const ema50Raw  = EMA.calculate({ values: closes, period: 50 })
  const ema200Raw = EMA.calculate({ values: closes, period: 200 })
  const wma20Raw  = WMA.calculate({ values: closes, period: 20 })
  const wma50Raw  = WMA.calculate({ values: closes, period: 50 })
  const rsi14Raw  = RSI.calculate({ values: closes, period: 14 })
  const macdRaw   = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false })
  const bb20Raw   = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 })
  const avgVolRaw = SMA.calculate({ values: volumes, period: 20 })
  const avgVol50Raw = SMA.calculate({ values: volumes, period: 50 })

  const stochRaw = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 })
  const stochRsiRaw = StochasticRSI.calculate({ values: closes, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 })
  const willRRaw = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const atrRaw   = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const obvRaw   = OBV.calculate({ close: closes, volume: volumes })
  const adxRaw   = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const cciRaw   = CCI.calculate({ open: opens, high: highs, low: lows, close: closes, period: 20 })
  const mfiRaw   = MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period: 14 })
  const keltnerRaw = KeltnerChannels.calculate({ high: highs, low: lows, close: closes, period: 20, maPeriod: 20, atrPeriod: 10, multiplier: 2, useSMA: false })
  const ichimokuRaw = IchimokuCloud.calculate({ high: highs, low: lows, conversionPeriod: 9, basePeriod: 26, spanPeriod: 52, displacement: 26 })
  const adlRaw = ADL.calculate({ high: highs, low: lows, close: closes, volume: volumes })
  const dc20     = donchian(highs, lows, 20, n)

  const avgVol = pad(avgVolRaw, n)
  const avgVol50 = pad(avgVol50Raw, n)
  const volRatio = volumes.map((v, i) => avgVol[i] ? v / avgVol[i] : null)
  const atr14 = pad(atrRaw, n)
  const bbUpper = pad(bb20Raw.map(b => b.upper), n)
  const bbMiddle = pad(bb20Raw.map(b => b.middle), n)
  const bbLower = pad(bb20Raw.map(b => b.lower), n)
  const bbWidth = bbUpper.map((upper, index) => (
    upper != null && bbLower[index] != null && bbMiddle[index] ? (upper - bbLower[index]) / bbMiddle[index] : null
  ))
  const bbPercentB = closes.map((close, index) => (
    bbUpper[index] != null && bbLower[index] != null && bbUpper[index] !== bbLower[index]
      ? (close - bbLower[index]) / (bbUpper[index] - bbLower[index])
      : null
  ))

  const vwap = calculateVwap(ohlcv, intraday)

  const bodySize = ohlcv.map((bar, index) => Math.abs(closes[index] - opens[index]))
  const averageBody = pad(SMA.calculate({ values: bodySize, period: 20 }), n)
  const supertrendResult = supertrend(ohlcv, atr14, 3)

  return {
    sma20:   pad(sma20Raw, n),
    sma50:   pad(sma50Raw, n),
    sma100:  pad(sma100Raw, n),
    sma150:  pad(sma150Raw, n),
    sma200:  pad(sma200Raw, n),
    ema9:    pad(ema9Raw, n),
    ema10:   pad(ema10Raw, n),
    ema20:   pad(ema20Raw, n),
    ema50:   pad(ema50Raw, n),
    ema200:  pad(ema200Raw, n),
    wma20:   pad(wma20Raw, n),
    wma50:   pad(wma50Raw, n),
    rsi14:   pad(rsi14Raw, n),
    macd: {
      line:      pad(macdRaw.map(m => m.MACD      ?? null), n),
      signal:    pad(macdRaw.map(m => m.signal    ?? null), n),
      histogram: pad(macdRaw.map(m => m.histogram ?? null), n),
    },
    bb20: {
      upper:  bbUpper,
      middle: bbMiddle,
      lower:  bbLower,
      width:  bbWidth,
      percentB: bbPercentB,
    },
    stoch: {
      k: pad(stochRaw.map(s => s.k ?? null), n),
      d: pad(stochRaw.map(s => s.d ?? null), n),
    },
    stochRsi: {
      value: pad(stochRsiRaw.map(s => s.stochRSI ?? null), n),
      k: pad(stochRsiRaw.map(s => s.k ?? null), n),
      d: pad(stochRsiRaw.map(s => s.d ?? null), n),
    },
    willR:    pad(willRRaw, n),
    atr14,
    obv:      pad(obvRaw, n),
    adx: {
      adx: pad(adxRaw.map(item => item.adx ?? null), n),
      pdi: pad(adxRaw.map(item => item.pdi ?? null), n),
      mdi: pad(adxRaw.map(item => item.mdi ?? null), n),
    },
    cci20: pad(cciRaw, n),
    momentum10: momentum(closes, 10),
    mfi14: pad(mfiRaw, n),
    cmf20: chaikinMoneyFlow(ohlcv, 20),
    adl: pad(adlRaw, n),
    keltner: {
      upper: pad(keltnerRaw.map(item => item.upper ?? null), n),
      middle: pad(keltnerRaw.map(item => item.middle ?? null), n),
      lower: pad(keltnerRaw.map(item => item.lower ?? null), n),
    },
    donchian: { upper: dc20.upper, middle: dc20.middle, lower: dc20.lower },
    ichimoku: (() => {
      const conversion = pad(ichimokuRaw.map(item => item.conversion ?? null), n)
      const base = pad(ichimokuRaw.map(item => item.base ?? null), n)
      return {
        conversion,
        base,
        spanA: shiftForward(pad(ichimokuRaw.map(item => item.spanA ?? null), n), 26),
        spanB: shiftForward(pad(ichimokuRaw.map(item => item.spanB ?? null), n), 26),
        laggingSpan: shiftBackward(closes, 26),
      }
    })(),
    supertrend: supertrendResult,
    vwap,
    vwapMode: intraday ? 'session' : 'rolling-20',
    pivotPoints: pivotPoints(ohlcv, intraday),
    priceLevels: priceLevels(ohlcv, intraday),
    avgVol,
    avgVol50,
    volumeMA: avgVol,
    volRatio,
    averageBody,
  }
}
