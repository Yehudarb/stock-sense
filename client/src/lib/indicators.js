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

function donchian(highs, lows, period, totalLen) {
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
    const prevDirection = direction[index - 1] ?? 'bullish'

    const finalUpper = prevUpper != null && prevClose != null && prevClose <= prevUpper
      ? Math.min(basicUpper, prevUpper)
      : basicUpper
    const finalLower = prevLower != null && prevClose != null && prevClose >= prevLower
      ? Math.max(basicLower, prevLower)
      : basicLower

    const nextDirection = bar.c > finalUpper
      ? 'bullish'
      : bar.c < finalLower
        ? 'bearish'
        : prevDirection

    upper.push(finalUpper)
    lower.push(finalLower)
    direction.push(nextDirection)
    line.push(nextDirection === 'bullish' ? finalLower : finalUpper)
    flipped.push(index > 0 && direction[index - 1] != null && direction[index - 1] !== nextDirection)
  })

  return { upper, lower, line, direction, flipped }
}

function pivotPoints(ohlcv) {
  const previous = ohlcv[ohlcv.length - 2] ?? ohlcv[ohlcv.length - 1]
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

function priceLevels(ohlcv) {
  const recent = ohlcv.slice(-60)
  const lookback52 = ohlcv.slice(-252)
  const previous = ohlcv[ohlcv.length - 2]

  return {
    previousHigh: previous?.h ?? null,
    previousLow: previous?.l ?? null,
    recentHigh: recent.length ? Math.max(...recent.map(bar => bar.h)) : null,
    recentLow: recent.length ? Math.min(...recent.map(bar => bar.l)) : null,
    high52Week: lookback52.length ? Math.max(...lookback52.map(bar => bar.h)) : null,
    low52Week: lookback52.length ? Math.min(...lookback52.map(bar => bar.l)) : null,
  }
}

export function computeAll(ohlcv) {
  if (!ohlcv || ohlcv.length < 30) return null

  const closes  = ohlcv.map(b => b.c)
  const highs   = ohlcv.map(b => b.h)
  const lows    = ohlcv.map(b => b.l)
  const opens   = ohlcv.map(b => b.o)
  const volumes = ohlcv.map(b => b.v)
  const n = ohlcv.length

  const sma20Raw  = SMA.calculate({ values: closes, period: 20 })
  const sma50Raw  = SMA.calculate({ values: closes, period: 50 })
  const sma100Raw = SMA.calculate({ values: closes, period: 100 })
  const sma200Raw = SMA.calculate({ values: closes, period: 200 })
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

  let cumulativeTpv = 0
  let cumulativeVolume = 0
  const vwap = ohlcv.map((bar, index) => {
    const typicalPrice = ((highs[index] ?? bar.h) + (lows[index] ?? bar.l) + closes[index]) / 3
    cumulativeTpv += typicalPrice * (volumes[index] ?? 0)
    cumulativeVolume += volumes[index] ?? 0
    return cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null
  })

  const bodySize = ohlcv.map((bar, index) => Math.abs(closes[index] - opens[index]))
  const averageBody = pad(SMA.calculate({ values: bodySize, period: 20 }), n)
  const supertrendResult = supertrend(ohlcv, atr14, 3)

  return {
    sma20:   pad(sma20Raw, n),
    sma50:   pad(sma50Raw, n),
    sma100:  pad(sma100Raw, n),
    sma200:  pad(sma200Raw, n),
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
    ichimoku: {
      conversion: pad(ichimokuRaw.map(item => item.conversion ?? null), n),
      base: pad(ichimokuRaw.map(item => item.base ?? null), n),
      spanA: pad(ichimokuRaw.map(item => item.spanA ?? null), n),
      spanB: pad(ichimokuRaw.map(item => item.spanB ?? null), n),
    },
    supertrend: supertrendResult,
    vwap,
    pivotPoints: pivotPoints(ohlcv),
    priceLevels: priceLevels(ohlcv),
    avgVol,
    avgVol50,
    volumeMA: avgVol,
    volRatio,
    averageBody,
  }
}
