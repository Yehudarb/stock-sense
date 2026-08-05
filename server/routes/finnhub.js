import { Router } from 'express'
import {
  fetchCompanyNews,
  fetchCompanyProfile,
  fetchQuote,
  isConfigured,
} from '../services/finnhub.js'

const router = Router()

router.get('/status', (_req, res) => {
  res.json({ configured: isConfigured() })
})

// Without an API key every fetcher returns its empty shape, and the handlers
// below turned that into 404 "Profile not found" — which says the TICKER has no
// profile when the truth is that this deployment has no Finnhub key. A caller
// cannot tell a bad symbol from an unconfigured service, and neither can anyone
// reading the logs. 503 with the reason is the honest answer: the request was
// fine, the dependency is missing.
export function requireFinnhub(_req, res, next) {
  if (isConfigured()) return next()
  res.status(503).json({
    error: 'Finnhub is not configured',
    detail: 'FINNHUB_API_KEY is not set on this deployment, so news, profile and quote are unavailable.',
    configured: false,
  })
}

router.use(requireFinnhub)

/**
 * GET /api/finnhub/quote/:ticker
 * Real-time quote (price, high, low, change, etc.)
 */
router.get('/quote/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params

    const data = await fetchQuote(ticker)

    if (!data) {
      return res.status(404).json({ error: 'Quote not found', ticker })
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/finnhub/profile/:ticker
 * Company profile (name, sector, market cap, IPO, etc.)
 */
router.get('/profile/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params

    const data = await fetchCompanyProfile(ticker)

    if (!data) {
      return res.status(404).json({ error: 'Profile not found', ticker })
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/finnhub/news/:ticker
 * Latest company news
 */
router.get('/news/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const { limit = 10 } = req.query

    const data = await fetchCompanyNews(ticker, parseInt(limit))

    res.json({
      ticker,
      news: data,
      count: data.length,
    })
  } catch (error) {
    next(error)
  }
})

export default router
