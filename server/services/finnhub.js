import axios from 'axios'

const FINNHUB_API = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY

if (!API_KEY) {
  console.warn('[Finnhub] FINNHUB_API_KEY is not set — Finnhub endpoints will fail')
}

/**
 * Finnhub Connector - Technical Indicators & Signals
 */

/**
 * Fetch Technical Indicators from Finnhub
 * @param {string} ticker - סמל המניה
 * @param {string} resolution - 1, 5, 15, 30, 60, D, W, M
 * @returns {object} indicators (RSI, MACD, SMA, etc.)
 */
export async function fetchTechnicalIndicators(ticker, resolution = 'D') {
  try {
    const now = Math.floor(Date.now() / 1000)
    const oneYearAgo = now - 365 * 24 * 60 * 60

    // Fetch OHLC data
    const ohlcResponse = await axios.get(`${FINNHUB_API}/stock/candle`, {
      params: {
        symbol: ticker,
        resolution,
        from: oneYearAgo,
        to: now,
        token: API_KEY,
      },
      timeout: 10000,
    })

    if (ohlcResponse.data.s === 'no_data') {
      return { error: 'No data available', ticker }
    }

    const bars = ohlcResponse.data
    if (!bars.c || bars.c.length === 0) {
      return { error: 'Invalid OHLC data', ticker }
    }

    // Calculate indicators locally (Finnhub doesn't provide them directly)
    const indicators = calculateIndicators(bars)

    return {
      ticker,
      resolution,
      timestamp: Date.now(),
      ohlc: {
        dates: bars.t,
        opens: bars.o,
        highs: bars.h,
        lows: bars.l,
        closes: bars.c,
        volumes: bars.v,
      },
      indicators,
    }
  } catch (error) {
    console.error(`[Finnhub] Error fetching indicators for ${ticker}:`, error.message)
    return { error: error.message, ticker }
  }
}

/**
 * Calculate Technical Indicators from OHLC
 */
function calculateIndicators(bars) {
  const closes = bars.c
  const n = closes.length

  return {
    rsi14: calculateRSI(closes, 14),
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
    macd: calculateMACD(closes),
    bbands20: calculateBollingerBands(closes, 20),
    atr14: calculateATR(bars, 14),
    stochastic: calculateStochastic(bars, 14),
    lastCandle: {
      open: bars.o[n - 1],
      high: bars.h[n - 1],
      low: bars.l[n - 1],
      close: closes[n - 1],
      volume: bars.v[n - 1],
    },
  }
}

/**
 * RSI Calculation (14 period default)
 */
function calculateRSI(closes, period = 14) {
  const rsi = []
  let gains = 0,
    losses = 0

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)

    if (i < period) continue

    if (i === period) {
      gains /= period
      losses /= period
    } else {
      gains = (gains * (period - 1) + (diff > 0 ? diff : 0)) / period
      losses = (losses * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period
    }

    if (losses === 0) {
      rsi.push(100)
      continue
    }

    const rs = gains / losses
    rsi.push(100 - 100 / (1 + rs))
  }

  // Pad array to match length
  return new Array(period).fill(null).concat(rsi)
}

/**
 * SMA Calculation
 */
function calculateSMA(closes, period) {
  const sma = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      sma.push(null)
      continue
    }
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }
  return sma
}

/**
 * MACD Calculation
 */
function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const macdLine = ema12.map((v, i) => (v && ema26[i] ? v - ema26[i] : null))
  const signal = calculateEMA(macdLine.filter(v => v !== null), 9)

  return {
    line: macdLine,
    signal: new Array(closes.length - signal.length).fill(null).concat(signal),
  }
}

/**
 * EMA Calculation (helper for MACD)
 */
function calculateEMA(values, period) {
  const ema = []
  const k = 2 / (period + 1)
  let sma = null

  for (let i = 0; i < values.length; i++) {
    const val = values[i]
    if (val === null || val === undefined) {
      ema.push(null)
      continue
    }

    if (sma === null && i >= period - 1) {
      sma = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      ema.push(sma)
    } else if (sma !== null) {
      sma = val * k + sma * (1 - k)
      ema.push(sma)
    } else {
      ema.push(null)
    }
  }

  return ema
}

/**
 * Bollinger Bands
 */
function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  const sma = calculateSMA(closes, period)
  const upper = []
  const lower = []

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    const std = Math.sqrt(variance)

    upper.push(mean + stdDev * std)
    lower.push(mean - stdDev * std)
  }

  return {
    upper: new Array(period - 1).fill(null).concat(upper),
    middle: sma,
    lower: new Array(period - 1).fill(null).concat(lower),
  }
}

/**
 * ATR (Average True Range)
 */
function calculateATR(bars, period = 14) {
  const h = bars.h
  const l = bars.l
  const c = bars.c
  const tr = []

  for (let i = 1; i < h.length; i++) {
    const trueRange = Math.max(
      h[i] - l[i],
      Math.abs(h[i] - c[i - 1]),
      Math.abs(l[i] - c[i - 1])
    )
    tr.push(trueRange)
  }

  const atr = []
  let sum = 0

  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) {
      atr.push(null)
      sum += tr[i]
    } else if (i === period - 1) {
      atr.push((sum + tr[i]) / period)
    } else {
      const lastATR = atr[i - 1]
      atr.push((lastATR * (period - 1) + tr[i]) / period)
    }
  }

  return atr
}

/**
 * Stochastic Oscillator
 */
function calculateStochastic(bars, period = 14) {
  const h = bars.h
  const l = bars.l
  const c = bars.c
  const k = []
  const d = []

  for (let i = period - 1; i < h.length; i++) {
    const highestHigh = Math.max(...h.slice(i - period + 1, i + 1))
    const lowestLow = Math.min(...l.slice(i - period + 1, i + 1))

    const stoch = ((c[i] - lowestLow) / (highestHigh - lowestLow)) * 100
    k.push(stoch)
  }

  // D = 3-period SMA of K
  for (let i = 0; i < k.length; i++) {
    if (i < 2) {
      d.push(null)
    } else {
      d.push((k[i] + k[i - 1] + k[i - 2]) / 3)
    }
  }

  return {
    k: new Array(period - 1).fill(null).concat(k),
    d: new Array(period - 1).fill(null).concat(d),
  }
}

/**
 * Fetch Company News from Finnhub
 * from/to are required by the API (yyyy-MM-dd); defaults to the last 7 days
 */
export async function fetchCompanyNews(ticker, limit = 10) {
  try {
    const toDate = new Date()
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fmt = d => d.toISOString().slice(0, 10)

    const response = await axios.get(`${FINNHUB_API}/company-news`, {
      params: {
        symbol: ticker,
        from: fmt(fromDate),
        to: fmt(toDate),
        token: API_KEY,
      },
      timeout: 10000,
    })

    if (!response.data || response.data.length === 0) {
      return []
    }

    return response.data.slice(0, limit).map(item => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      datetime: new Date(item.datetime * 1000).toISOString(),
      sentiment: item.sentiment || 'neutral',
    }))
  } catch (error) {
    console.warn(`[Finnhub] Error fetching news for ${ticker}:`, error.message)
    return []
  }
}

/**
 * Fetch Company Profile from Finnhub
 */
export async function fetchCompanyProfile(ticker) {
  try {
    const response = await axios.get(`${FINNHUB_API}/stock/profile2`, {
      params: {
        symbol: ticker,
        token: API_KEY,
      },
      timeout: 10000,
    })

    return {
      name: response.data.name,
      ticker: response.data.ticker,
      exchange: response.data.exchange,
      ipo: response.data.ipo,
      marketCap: response.data.marketCap,
      logo: response.data.logo,
      country: response.data.country,
      industry: response.data.finnhubIndustry,
    }
  } catch (error) {
    console.warn(`[Finnhub] Error fetching profile for ${ticker}:`, error.message)
    return null
  }
}

/**
 * Fetch Quote (real-time price data)
 */
export async function fetchQuote(ticker) {
  try {
    const response = await axios.get(`${FINNHUB_API}/quote`, {
      params: {
        symbol: ticker,
        token: API_KEY,
      },
      timeout: 10000,
    })

    return {
      ticker,
      price: response.data.c,
      high: response.data.h,
      low: response.data.l,
      open: response.data.o,
      previousClose: response.data.pc,
      change: response.data.d,
      changePct: response.data.dp,
      timestamp: response.data.t * 1000,
    }
  } catch (error) {
    console.warn(`[Finnhub] Error fetching quote for ${ticker}:`, error.message)
    return null
  }
}
