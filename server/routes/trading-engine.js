import { Router } from 'express'
import { calculateOptimalLevels } from '../services/stopEngine.js'

const router = Router()

/**
 * GET /api/trading/calculate-stops/:ticker
 * Calculate stop loss and target levels using ATR
 *
 * Query parameters:
 * - entry: Entry price (required)
 * - atr: Average True Range (required)
 * - support: Support price (optional)
 * - volatility: Daily volatility % (default 5)
 *
 * Example:
 * GET /api/trading/calculate-stops/TSLL?entry=7.60&atr=0.38&support=7.25
 *
 * Response:
 * {
 *   "entry_price": 7.60,
 *   "atr": 0.38,
 *   "support_price": 7.25,
 *   "tight": { "stop": 7.22, "target": 9.10, "rr_ratio": 3.75, ... },
 *   "normal": { "stop": 7.03, "target": 8.74, "rr_ratio": 3.75, ... },
 *   "wide": { "stop": 6.80, "target": 8.39, "rr_ratio": 2.30, ... },
 *   "recommended": "normal",
 *   "warning": null
 * }
 */
router.get('/calculate-stops/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const { entry, atr, support, volatility = '0.05' } = req.query

    // Validate required parameters
    if (!entry || !atr) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['entry', 'atr'],
        optional: ['support', 'volatility'],
      })
    }

    const entryPrice = parseFloat(entry)
    const atrValue = parseFloat(atr)
    const supportPrice = support ? parseFloat(support) : null
    const volatilityPct = parseFloat(volatility)

    // Validate numeric values
    if (Number.isNaN(entryPrice) || entryPrice <= 0) {
      return res.status(400).json({ error: 'Entry price must be a positive number' })
    }
    if (Number.isNaN(atrValue) || atrValue < 0) {
      return res.status(400).json({ error: 'ATR must be a non-negative number' })
    }
    if (supportPrice !== null && Number.isNaN(supportPrice)) {
      return res.status(400).json({ error: 'Support price must be a valid number' })
    }

    // Calculate stops
    const decision = calculateOptimalLevels(entryPrice, atrValue, supportPrice, volatilityPct)

    res.json({
      ticker,
      timestamp: new Date().toISOString(),
      ...decision,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/trading/calculate-stops
 * Calculate stops with JSON body
 *
 * Request body:
 * {
 *   "ticker": "TSLL",
 *   "entry_price": 7.60,
 *   "atr": 0.38,
 *   "support_price": 7.25,  // optional
 *   "volatility_pct": 0.05   // optional, default 5%
 * }
 */
router.post('/calculate-stops', async (req, res, next) => {
  try {
    const {
      ticker,
      entry_price: entryPrice,
      atr,
      support_price: supportPrice = null,
      volatility_pct: volatilityPct = 0.05,
    } = req.body

    // Validate required fields
    if (!entryPrice || !atr) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['entry_price', 'atr'],
      })
    }

    // Calculate stops
    const decision = calculateOptimalLevels(entryPrice, atr, supportPrice, volatilityPct)

    res.json({
      ticker: ticker || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      ...decision,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/trading/example
 * Return example calculation for documentation
 */
router.get('/example', async (req, res) => {
  const example = {
    description: 'Example: TSLL stock trading setup',
    request: {
      ticker: 'TSLL',
      entry_price: 7.60,
      atr: 0.38,
      support_price: 7.25,
      volatility_pct: 0.05,
    },
    usage: {
      get: 'GET /api/trading/calculate-stops/TSLL?entry=7.60&atr=0.38&support=7.25',
      post: 'POST /api/trading/calculate-stops with JSON body',
    },
    response: {
      entry_price: 7.60,
      atr: 0.38,
      support_price: 7.25,
      tight: {
        stop: 7.22,
        target: 9.10,
        risk_pct: 5.0,
        reward_pct: 19.74,
        rr_ratio: 3.95,
        reason: 'atr_tight',
      },
      normal: {
        stop: 7.03,
        target: 8.74,
        risk_pct: 7.5,
        reward_pct: 15.0,
        rr_ratio: 2.0,
        reason: 'atr_normal',
      },
      wide: {
        stop: 6.84,
        target: 8.39,
        risk_pct: 10.0,
        reward_pct: 10.39,
        rr_ratio: 1.04,
        reason: 'atr_wide',
      },
      recommended: 'normal',
      warning: null,
    },
  }

  res.json(example)
})

export default router
