import axios from 'axios'

const FINNHUB_API = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY

if (!API_KEY) {
  console.warn('[Finnhub] FINNHUB_API_KEY is not set — Finnhub endpoints will fail')
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
      marketCap: response.data.marketCapitalization,
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
