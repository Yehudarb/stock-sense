import { Router } from 'express'
import { getBars, getSnapshot, searchTickers, getFearGreed, getEarnings } from '../services/yahooFinance.js'
import { cacheGet, cacheSet } from '../services/cache.js'

const router = Router()
const inFlightRequests = new Map()

const BAR_TTL = { '1m': 30, '5m': 30, '15m': 30, '1h': 3600, '4h': 3600, '1d': 3600, '1mo': 3600, '1y': 3600, '5y': 3600 }
const BROWSER_CACHE = { '1m': 10, '5m': 15, '15m': 30, '1h': 120, '4h': 300, '1d': 600, '1mo': 900, '1y': 1800, '5y': 3600 }

function withRequestCoalescing(key, producer) {
  if (inFlightRequests.has(key)) return inFlightRequests.get(key)

  const pending = Promise.resolve()
    .then(producer)
    .finally(() => inFlightRequests.delete(key))

  inFlightRequests.set(key, pending)
  return pending
}

function setApiCacheHeaders(res, maxAgeSeconds) {
  const safeMaxAge = Math.max(0, Math.floor(maxAgeSeconds))
  const staleWhileRevalidate = Math.max(30, safeMaxAge * 2)
  res.set('Cache-Control', `public, max-age=${safeMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`)
}

function parseLimit(rawLimit, fallback, max) {
  const parsed = Number.parseInt(rawLimit ?? `${fallback}`, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 10), max)
}

router.get('/bars/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const interval = req.query.interval ?? '5m'
    const limit = parseLimit(req.query.limit, 200, 400)
    const upper = ticker.toUpperCase()
    const cacheKey = `bars:${upper}:${interval}:${limit}`
    const browserTtl = BROWSER_CACHE[interval] ?? 30

    setApiCacheHeaders(res, browserTtl)

    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const stale = cacheGet(cacheKey, { allowStale: true })
    try {
      const payload = await withRequestCoalescing(cacheKey, async () => {
        const bars = await getBars(upper, interval, limit)
        const freshPayload = { ticker: upper, interval, bars }
        cacheSet(cacheKey, freshPayload, BAR_TTL[interval] ?? 30)
        return freshPayload
      })

      return res.json(payload)
    } catch (err) {
      if (stale) {
        res.set('X-Data-Source', 'stale-cache')
        return res.json(stale)
      }
      throw err
    }
  } catch (err) { next(err) }
})

router.get('/snapshot/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const upper = ticker.toUpperCase()
    const cacheKey = `snap:${upper}`

    setApiCacheHeaders(res, 3)

    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const stale = cacheGet(cacheKey, { allowStale: true })
    try {
      const payload = await withRequestCoalescing(cacheKey, async () => {
        const snap = await getSnapshot(upper)
        cacheSet(cacheKey, snap, 5)
        return snap
      })

      return res.json(payload)
    } catch (err) {
      if (stale) {
        res.set('X-Data-Source', 'stale-cache')
        return res.json(stale)
      }
      throw err
    }
  } catch (err) { next(err) }
})

router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q ?? ''
    if (q.length < 1) return res.json([])
    const cacheKey = `search:${q.toLowerCase()}`

    setApiCacheHeaders(res, 120)

    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const payload = await withRequestCoalescing(cacheKey, async () => {
      const results = await searchTickers(q)
      cacheSet(cacheKey, results, 300)
      return results
    })

    res.json(payload)
  } catch (err) { next(err) }
})

router.get('/feargreed', async (req, res, next) => {
  try {
    setApiCacheHeaders(res, 120)

    const cached = cacheGet('feargreed')
    if (cached) return res.json(cached)

    const stale = cacheGet('feargreed', { allowStale: true })
    try {
      const payload = await withRequestCoalescing('feargreed', async () => {
        const data = await getFearGreed()
        const safePayload = data ?? { value: null, classification: 'Unknown' }
        cacheSet('feargreed', safePayload, 300)
        return safePayload
      })

      return res.json(payload)
    } catch (err) {
      if (stale) {
        res.set('X-Data-Source', 'stale-cache')
        return res.json(stale)
      }
      throw err
    }
  } catch (err) { next(err) }
})

router.get('/earnings/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params
    const upper = ticker.toUpperCase()
    const cacheKey = `earnings:${upper}`

    setApiCacheHeaders(res, 1800)

    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const stale = cacheGet(cacheKey, { allowStale: true })
    try {
      const payload = await withRequestCoalescing(cacheKey, async () => {
        const data = await getEarnings(upper)
        cacheSet(cacheKey, data, 6 * 60 * 60)
        return data
      })

      return res.json(payload)
    } catch (err) {
      if (stale) {
        res.set('X-Data-Source', 'stale-cache')
        return res.json(stale)
      }
      throw err
    }
  } catch (err) { next(err) }
})

export default router
