import { LRUCache } from 'lru-cache'

const cache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60,
  allowStale: true,
  updateAgeOnGet: false,
})

export function cacheGet(key, { allowStale = false } = {}) {
  return cache.get(key, { allowStale }) ?? null
}

export function cacheSet(key, value, ttlSeconds) {
  cache.set(key, value, { ttl: ttlSeconds * 1000 })
}

export function cacheDelete(key) {
  cache.delete(key)
}
