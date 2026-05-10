import { RSI, MACD, BollingerBands, SMA, EMA, Stochastic, WilliamsR, ATR } from 'technicalindicators'

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
  const volumes = ohlcv.map(b => b.v)
  const n = ohlcv.length

  const sma20Raw  = SMA.calculate({ values: closes, period: 20 })
  const sma50Raw  = SMA.calculate({ values: closes, period: 50 })
  const sma200Raw = SMA.calculate({ values: closes, period: 200 })
  const ema20Raw  = EMA.calculate({ values: closes, period: 20 })
  const ema50Raw  = EMA.calculate({ values: closes, period: 50 })
  const rsi14Raw  = RSI.calculate({ values: closes, period: 14 })
  const macdRaw   = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false })
  const bb20Raw   = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 })
  const avgVolRaw = SMA.calculate({ values: volumes, period: 20 })

  const stochRaw = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 })
  const willRRaw = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const atrRaw   = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
  const dc20     = donchian(highs, lows, 20, n)

  const avgVol = pad(avgVolRaw, n)
  const volRatio = volumes.map((v, i) => avgVol[i] ? v / avgVol[i] : null)

  return {
    sma20:   pad(sma20Raw, n),
    sma50:   pad(sma50Raw, n),
    sma200:  pad(sma200Raw, n),
    ema20:   pad(ema20Raw, n),
    ema50:   pad(ema50Raw, n),
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
    donchian: { upper: dc20.upper, lower: dc20.lower },
    avgVol,
    volRatio,
  }
}
