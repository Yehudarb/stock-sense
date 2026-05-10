import { Router } from 'express'
import { getBars, getSnapshot, searchTickers, getFearGreed, getEarnings } from '../services/yahooFinance.js'
import { cacheGet, cacheSet } from '../services/cache.js'

const router = Router()

const BAR_TTL = { '1m': 30, '5m': 30, '15m': 30, '1h': 3600, '4h': 3600, '1d': 3600, '1mo': 3600, '1y': 3600, '5y': 3600 }

router.get('/bars/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const interval = req.query.interval ?? '5m'
    const limit = parseInt(req.query.limit ?? '200')
    const cacheKey = `bars:${ticker}:${interval}:${limit}`

    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const bars = await getBars(ticker.toUpperCase(), interval, limit)
    const payload = { ticker: ticker.toUpperCase(), interval, bars }
    cacheSet(cacheKey, payload, BAR_TTL[interval] ?? 30)
    res.json(payload)
  } catch (err) { next(err) }
})

router.get('/snapshot/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const cacheKey = `snap:${ticker}`
    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const snap = await getSnapshot(ticker.toUpperCase())
    cacheSet(cacheKey, snap, 5)
    res.json(snap)
  } catch (err) { next(err) }
})

router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q ?? ''
    if (q.length < 1) return res.json([])
    const cacheKey = `search:${q.toLowerCase()}`
    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const results = await searchTickers(q)
    cacheSet(cacheKey, results, 300)
    res.json(results)
  } catch (err) { next(err) }
})

router.get('/feargreed', async (req, res, next) => {
  try {
    const cached = cacheGet('feargreed')
    if (cached) return res.json(cached)
    const data = await getFearGreed()
    if (data) cacheSet('feargreed', data, 300)
    res.json(data ?? { value: null, classification: 'Unknown' })
  } catch (err) { next(err) }
})

router.get('/earnings/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const upper = ticker.toUpperCase()
    const cacheKey = `earnings:${upper}`
    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const data = await getEarnings(upper)
    cacheSet(cacheKey, data, 6 * 60 * 60)
    res.json(data)
  } catch (err) { next(err) }
})

export default router
