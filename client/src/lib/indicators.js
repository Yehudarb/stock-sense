import { RSI, MACD, BollingerBands, SMA, EMA, Stochastic, WilliamsR, ATR, OBV } from 'technicalindicators'

function pad(arr, totalLen) {
  const fill = totalLen - arr.length
  return [...Array(Math.max(0, fill)).fill(null), ...arr]
}

function donchian(highs, lows, period, totalLen) {
  const upper = [], lower = []
  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue }
    const slice_h = highs.slice(i - period + 1, i + 1)
    const slice_l = lows.slice(i - period + 1, i + 1)
    upper.push(Math.max(...slice_h))
    lower.push(Math.min(...slice_l))
  }
  return { upper, lower }
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
  const rsi14Raw  = RSI.calculate({ values: closes, period: 14 })
  const macdRaw   = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false })
  const bb20Raw   = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 })
  const avgVolRaw = SMA.calculate({ values: volumes, period: 20 })
  const avgVol50Raw = SMA.calculate({ values: volumes, period: 50 })

  const stochRaw = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 })
  const willRRaw = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const atrRaw   = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const obvRaw   = OBV.calculate({ close: closes, volume: volumes })
  const dc20     = donchian(highs, lows, 20, n)

  const avgVol = pad(avgVolRaw, n)
  const avgVol50 = pad(avgVol50Raw, n)
  const volRatio = volumes.map((v, i) => avgVol[i] ? v / avgVol[i] : null)

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

  return {
    sma20:   pad(sma20Raw, n),
    sma50:   pad(sma50Raw, n),
    sma100:  pad(sma100Raw, n),
    sma200:  pad(sma200Raw, n),
    ema20:   pad(ema20Raw, n),
    ema50:   pad(ema50Raw, n),
    ema200:  pad(ema200Raw, n),
    rsi14:   pad(rsi14Raw, n),
    macd: {
      line:      pad(macdRaw.map(m => m.MACD      ?? null), n),
      signal:    pad(macdRaw.map(m => m.signal    ?? null), n),
      histogram: pad(macdRaw.map(m => m.histogram ?? null), n),
    },
    bb20: {
      upper:  pad(bb20Raw.map(b => b.upper),  n),
      middle: pad(bb20Raw.map(b => b.middle), n),
      lower:  pad(bb20Raw.map(b => b.lower),  n),
    },
    stoch: {
      k: pad(stochRaw.map(s => s.k ?? null), n),
      d: pad(stochRaw.map(s => s.d ?? null), n),
    },
    willR:    pad(willRRaw, n),
    atr14:    pad(atrRaw, n),
    obv:      pad(obvRaw, n),
    vwap,
    donchian: { upper: dc20.upper, lower: dc20.lower },
    avgVol,
    avgVol50,
    volRatio,
    averageBody,
  }
}
