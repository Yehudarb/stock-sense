import { LRUCache } from 'lru-cache'

const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 })

export function cacheGet(key) {
  return cache.get(key) ?? null
}

export function cacheSet(key, value, ttlSeconds) {
  cache.set(key, value, { ttl: ttlSeconds * 1000 })
}
