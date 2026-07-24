import { Router } from 'express'
import {
  fetchCompanyNews,
  fetchCompanyProfile,
  fetchQuote,
} from '../services/finnhub.js'

const router = Router()

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
