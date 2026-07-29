import axios from 'axios'

const FINNHUB_API = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY

export function isConfigured() {
  return Boolean(API_KEY)
}

if (!API_KEY) {
  console.warn('[Finnhub] FINNHUB_API_KEY is not set — news, profile and quote will report as unavailable')
}

// A missing or rejected key is one configuration fact, not one event per
// request. Without this the production log filled with an identical 401 for
// every ticker on every page load, which buries anything that actually needs
// attention.
const warnedOnce = new Set()
function warnOnce(key, message) {
  if (warnedOnce.has(key)) return
  warnedOnce.add(key)
  console.warn(message)
}

// 401/403 means the key is absent or wrong — retrying cannot fix it, and it
// says nothing about the ticker being asked for. Anything else is a genuine
// per-request failure worth seeing each time.
function reportFailure(operation, ticker, error) {
  const status = error?.response?.status
  if (status === 401 || status === 403) {
    warnOnce(
      `auth:${status}`,
      `[Finnhub] HTTP ${status} — FINNHUB_API_KEY is missing or invalid. ` +
      'News, profile and quote will be reported as unavailable until it is set. ' +
      'This is logged once, not per request.',
    )
    return
  }
  console.warn(`[Finnhub] Error fetching ${operation} for ${ticker}:`, error.message)
}

/**
 * Finnhub Connector - Quote, News & Company Profile
 * Note: candle/indicator data is intentionally not used — it requires a paid
 * Finnhub plan, and indicators are already computed client-side from Yahoo data.
 */

/**
 * Fetch Company News from Finnhub
 * from/to are required by the API (yyyy-MM-dd); defaults to the last 7 days
 */
export async function fetchCompanyNews(ticker, limit = 10) {
  // No key means the request cannot succeed. Returning the same empty shape a
  // failure would produce keeps callers unchanged — the analysis engine already
  // records absent news as a data-quality fact rather than an error — while
  // skipping a guaranteed-401 round trip per ticker.
  if (!API_KEY) return []
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
    reportFailure('news', ticker, error)
    return []
  }
}

/**
 * Fetch Company Profile from Finnhub
 */
export async function fetchCompanyProfile(ticker) {
  if (!API_KEY) return null
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
      marketCap: response.data.marketCapitalization,
      logo: response.data.logo,
      country: response.data.country,
      industry: response.data.finnhubIndustry,
    }
  } catch (error) {
    reportFailure('profile', ticker, error)
    return null
  }
}

/**
 * Fetch Quote (real-time price data)
 */
export async function fetchQuote(ticker) {
  if (!API_KEY) return null
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
    reportFailure('quote', ticker, error)
    return null
  }
}
