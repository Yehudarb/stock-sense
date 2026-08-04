import { cacheGet, cacheSet } from './cache.js'

export const MIN_ASSET_SIZE_USD = 2_000_000_000
export const DEFAULT_STRENGTH_THRESHOLD = 55

const NASDAQ_STOCKS_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=5000&offset=0&download=true'
const YAHOO_ETF_URL = 'https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved'
const YAHOO_SPARK_URL = 'https://query1.finance.yahoo.com/v7/finance/spark'
const UNIVERSE_CACHE_KEY = 'scanner:market-universe:2b'
const UNIVERSE_TTL_SECONDS = 6 * 60 * 60
const SPARK_BATCH_SIZE = 20
const SPARK_CONCURRENCY = Math.max(1, Number.parseInt(process.env.SCANNER_SPARK_CONCURRENCY ?? '4', 10))
const FETCH_TIMEOUT_MS = Math.max(5_000, Number.parseInt(process.env.SCANNER_FETCH_TIMEOUT_MS ?? '15000', 10))

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json, text/plain, */*',
}

const NASDAQ_HEADERS = {
  ...YAHOO_HEADERS,
  Origin: 'https://www.nasdaq.com',
  Referer: 'https://www.nasdaq.com/market-activity/stocks',
}

const NON_COMMON_SECURITY = /\b(warrant|warrants|unit|units|right|rights|preferred|preference|notes? due|bond|debenture)\b/i

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function parseNumber(value) {
  if (value == null || value === '' || value === 'N/A') return null
  const normalized = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[$,%\s,]/g, ''))
  return Number.isFinite(normalized) ? normalized : null
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

async function fetchJson(url, headers, retries = 3) {
  let lastError = null

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (response.ok) return response.json()

      const error = Object.assign(new Error(`Market universe HTTP ${response.status}`), { status: response.status })
      if (response.status !== 429 && response.status < 500) throw error
      lastError = error
    } catch (error) {
      lastError = error
      if (attempt === retries - 1) break
    }

    await sleep(500 * (2 ** attempt) + Math.floor(Math.random() * 250))
  }

  throw lastError ?? new Error('Market universe request failed')
}

/** Normalize one Nasdaq screener row into a stock universe record. */
export function normalizeNasdaqStock(row, minimumSize = MIN_ASSET_SIZE_USD) {
  const symbol = String(row?.symbol ?? '').trim().toUpperCase()
  const name = String(row?.name ?? symbol).trim()
  const sizeValue = parseNumber(row?.marketCap)
  const price = parseNumber(row?.lastsale)
  const volume = parseNumber(row?.volume) ?? 0
  const dailyChangePct = parseNumber(row?.pctchange)

  if (!/^[A-Z][A-Z.-]{0,9}$/.test(symbol)) return null
  if (NON_COMMON_SECURITY.test(name)) return null
  if (!Number.isFinite(sizeValue) || sizeValue < minimumSize) return null
  if (!Number.isFinite(price) || price <= 2) return null

  return {
    symbol,
    name,
    assetType: 'stock',
    sizeValue,
    sizeMetric: 'marketCap',
    price,
    volume,
    averageVolume: null,
    dollarVolume: price * volume,
    dailyChangePct,
    sector: row?.sector || 'Unknown',
    industry: row?.industry || null,
    country: row?.country || null,
    source: 'Nasdaq',
  }
}

/** Normalize one Yahoo top-ETF row, using net assets as the fund size metric. */
export function normalizeYahooFund(quote, minimumSize = MIN_ASSET_SIZE_USD) {
  const symbol = String(quote?.symbol ?? '').trim().toUpperCase()
  const sizeValue = parseNumber(quote?.netAssets)
  const price = parseNumber(quote?.regularMarketPrice)
  const averageVolume = parseNumber(quote?.averageDailyVolume3Month) ?? 0

  if (!/^[A-Z][A-Z.-]{0,9}$/.test(symbol)) return null
  if (!Number.isFinite(sizeValue) || sizeValue < minimumSize) return null
  if (!Number.isFinite(price) || price <= 2) return null

  return {
    symbol,
    name: quote?.longName ?? quote?.shortName ?? symbol,
    assetType: 'etf',
    sizeValue,
    sizeMetric: 'netAssets',
    price,
    volume: parseNumber(quote?.regularMarketVolume) ?? 0,
    averageVolume,
    dollarVolume: price * averageVolume,
    dailyChangePct: parseNumber(quote?.regularMarketChangePercent),
    sector: 'ETF',
    industry: null,
    country: 'United States',
    source: 'Yahoo Finance',
  }
}

async function fetchStockUniverse(minimumSize) {
  const payload = await fetchJson(NASDAQ_STOCKS_URL, NASDAQ_HEADERS)
  const rows = payload?.data?.rows ?? []
  return {
    discovered: rows.length,
    assets: rows.map(row => normalizeNasdaqStock(row, minimumSize)).filter(Boolean),
  }
}

async function fetchFundUniverse(minimumSize) {
  const fetchPage = start => {
    const params = new URLSearchParams({ scrIds: 'top_etfs_us', count: '250', start: String(start) })
    return fetchJson(`${YAHOO_ETF_URL}?${params}`, YAHOO_HEADERS)
  }
  const pages = await Promise.all([fetchPage(0), fetchPage(250)])
  const results = pages.map(page => page?.finance?.result?.[0]).filter(Boolean)
  const quotes = results.flatMap(result => result.quotes ?? [])
  const total = Math.max(...results.map(result => result.total ?? 0), quotes.length)

  return {
    discovered: total,
    assets: quotes.map(quote => normalizeYahooFund(quote, minimumSize)).filter(Boolean),
  }
}

/** Discover all eligible stocks and large US ETFs from the upstream screeners. */
export async function discoverMarketUniverse({ minimumSize = MIN_ASSET_SIZE_USD, force = false } = {}) {
  const safeMinimum = Math.max(MIN_ASSET_SIZE_USD, Number(minimumSize) || MIN_ASSET_SIZE_USD)
  if (!force && safeMinimum === MIN_ASSET_SIZE_USD) {
    const cached = cacheGet(UNIVERSE_CACHE_KEY)
    if (cached) return cached
  }

  const [stocks, funds] = await Promise.all([
    fetchStockUniverse(safeMinimum),
    fetchFundUniverse(safeMinimum),
  ])
  const unique = new Map()
  for (const asset of [...stocks.assets, ...funds.assets]) unique.set(asset.symbol, asset)

  const result = {
    assets: [...unique.values()].sort((a, b) => b.sizeValue - a.sizeValue),
    stats: {
      discoveredStocks: stocks.discovered,
      discoveredFunds: funds.discovered,
      eligibleStocks: stocks.assets.length,
      eligibleFunds: funds.assets.length,
      eligibleTotal: unique.size,
      minimumSize: safeMinimum,
    },
    provider: 'Nasdaq + Yahoo Finance',
    createdAt: Date.now(),
  }

  if (safeMinimum === MIN_ASSET_SIZE_USD) cacheSet(UNIVERSE_CACHE_KEY, result, UNIVERSE_TTL_SECONDS)
  return result
}

function average(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function periodReturn(closes, sessions) {
  if (closes.length <= sessions) return null
  const current = closes[closes.length - 1]
  const prior = closes[closes.length - 1 - sessions]
  return prior > 0 ? (current - prior) / prior : null
}

/** Calculate a transparent 0-100 trend and relative-strength score. */
export function calculateStrength(history, benchmark = null, asset = null) {
  const closes = history?.closes?.filter(Number.isFinite) ?? []
  if (closes.length < 200) return null

  const current = closes[closes.length - 1]
  const sma50 = average(closes.slice(-50))
  const sma200 = average(closes.slice(-200))
  const return3m = periodReturn(closes, 63)
  const return6m = periodReturn(closes, 126)
  const return12m = periodReturn(closes, 252)
  const high52 = Math.max(...closes.slice(-252))
  const distanceFromHighPct = high52 > 0 ? ((current - high52) / high52) * 100 : null
  const benchmark6m = benchmark?.return6m ?? 0
  const relative6m = return6m == null ? null : return6m - benchmark6m
  const dollarVolume = Number(asset?.dollarVolume) || 0

  let score = 0
  if (current > sma200) score += 18
  if (sma50 > sma200) score += 16
  if (current > sma50) score += 12
  if (return3m != null) score += clamp(5 + return3m * 50, 0, 12)
  if (return6m != null) score += clamp(7 + return6m * 45, 0, 14)
  if (return12m != null) score += clamp(5 + return12m * 30, 0, 10)
  if (relative6m != null) score += clamp(5 + relative6m * 50, 0, 10)
  if (distanceFromHighPct != null) score += clamp(10 + distanceFromHighPct * 0.35, 0, 10)
  score += dollarVolume >= 50_000_000 ? 6 : dollarVolume >= 10_000_000 ? 4 : dollarVolume >= 2_000_000 ? 2 : 0

  return {
    score: Number(clamp(score, 0, 100).toFixed(1)),
    current,
    sma50,
    sma200,
    return3m,
    return6m,
    return12m,
    relative6m,
    distanceFromHighPct,
    above50: current > sma50,
    above200: current > sma200,
    aligned: current > sma50 && sma50 > sma200,
  }
}

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

function parseSparkPayload(payload) {
  const histories = new Map()
  for (const item of payload?.spark?.result ?? []) {
    const response = item?.response?.[0]
    const timestamps = response?.timestamp ?? []
    const closes = response?.indicators?.quote?.[0]?.close ?? []
    const points = timestamps
      .map((timestamp, index) => ({ timestamp: timestamp * 1000, close: Number(closes[index]) }))
      .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.close) && point.close > 0)
    if (points.length) {
      histories.set(item.symbol, {
        timestamps: points.map(point => point.timestamp),
        closes: points.map(point => point.close),
      })
    }
  }
  return histories
}

async function fetchSparkHistories(symbols) {
  const params = new URLSearchParams({ symbols: symbols.join(','), range: '2y', interval: '1d' })
  return parseSparkPayload(await fetchJson(`${YAHOO_SPARK_URL}?${params}`, YAHOO_HEADERS))
}

/**
 * Score every eligible asset using batched two-year close history. The returned
 * history is intentionally internal to the scan job and is never sent to the UI.
 */
export async function evaluateStrongAssets(assets, {
  threshold = DEFAULT_STRENGTH_THRESHOLD,
  onProgress = () => {},
} = {}) {
  const safeThreshold = clamp(Number(threshold) || DEFAULT_STRENGTH_THRESHOLD, 40, 90)
  const benchmarkHistory = (await fetchSparkHistories(['SPY'])).get('SPY')
  const benchmark = benchmarkHistory ? calculateStrength(benchmarkHistory) : null
  const batches = chunk(assets, SPARK_BATCH_SIZE)
  let completedAssets = 0
  let failedAssets = 0

  const batchResults = await mapWithLimit(batches, SPARK_CONCURRENCY, async symbolsBatch => {
    try {
      const histories = await fetchSparkHistories(symbolsBatch.map(asset => asset.symbol))
      return symbolsBatch.map(asset => {
        const history = histories.get(asset.symbol)
        const strength = history ? calculateStrength(history, benchmark, asset) : null
        if (!history || !strength) failedAssets += 1
        return history && strength ? { ...asset, history, strength } : null
      }).filter(Boolean)
    } catch {
      failedAssets += symbolsBatch.length
      return []
    } finally {
      completedAssets += symbolsBatch.length
      onProgress(Math.min(completedAssets, assets.length), assets.length)
    }
  })

  const evaluated = batchResults.flat()
  const strong = evaluated.filter(asset => (
    asset.strength.score >= safeThreshold &&
    asset.strength.above200 &&
    (asset.strength.return6m ?? -1) >= -0.05 &&
    ((asset.strength.return12m ?? 0) > 0 || (asset.strength.relative6m ?? -1) >= 0)
  )).sort((a, b) => b.strength.score - a.strength.score || b.dollarVolume - a.dollarVolume)

  return {
    assets: strong,
    stats: {
      historyEvaluated: evaluated.length,
      historyFailed: failedAssets,
      strongAssets: strong.length,
      strengthThreshold: safeThreshold,
      benchmarkReturn6m: benchmark?.return6m ?? null,
    },
  }
}
