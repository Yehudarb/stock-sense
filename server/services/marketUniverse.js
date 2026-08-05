import { cacheGet, cacheSet } from './cache.js'

export const MIN_ASSET_SIZE_USD = 2_000_000_000
export const DEFAULT_STRENGTH_THRESHOLD = 55
export const SP500_INDEX_NAME = 'S&P 500'

const NASDAQ_STOCKS_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=5000&offset=0&download=true'
const SP500_CONSTITUENTS_URL = process.env.SP500_CONSTITUENTS_URL ?? 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'
const YAHOO_SPARK_URL = 'https://query1.finance.yahoo.com/v7/finance/spark'
const UNIVERSE_CACHE_KEY = 'scanner:sp500-universe:v1'
const UNIVERSE_TTL_SECONDS = 12 * 60 * 60
const MIN_EXPECTED_CONSTITUENTS = 490
const MAX_EXPECTED_CONSTITUENTS = 520
const REQUIRED_INDEX_ANCHORS = ['AAPL', 'JPM', 'MSFT', 'SPGI', 'XOM']
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

async function fetchText(url, headers, retries = 3) {
  let lastError = null

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (response.ok) return response.text()

      const error = Object.assign(new Error(`S&P 500 constituents HTTP ${response.status}`), { status: response.status })
      if (response.status !== 429 && response.status < 500) throw error
      lastError = error
    } catch (error) {
      lastError = error
      if (attempt === retries - 1) break
    }

    await sleep(500 * (2 ** attempt) + Math.floor(Math.random() * 250))
  }

  throw lastError ?? new Error('S&P 500 constituents request failed')
}

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

/** Normalize provider-specific share-class separators into the index symbol. */
export function normalizeIndexSymbol(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[/-]/g, '.')
}

/** Convert an S&P share-class symbol to the form accepted by Yahoo Finance. */
export function toYahooSymbol(value) {
  return normalizeIndexSymbol(value).replace(/\./g, '-')
}

/** Parse the maintained S&P 500 constituent CSV into normalized index records. */
export function parseSp500ConstituentsCsv(csv) {
  const lines = String(csv ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) throw new Error('S&P 500 constituent CSV is empty')

  const headers = parseCsvLine(lines[0])
  const column = name => headers.indexOf(name)
  const symbolColumn = column('Symbol')
  const nameColumn = column('Security')
  const sectorColumn = column('GICS Sector')
  const industryColumn = column('GICS Sub-Industry')
  if ([symbolColumn, nameColumn, sectorColumn].some(index => index < 0)) {
    throw new Error('S&P 500 constituent CSV has an unexpected schema')
  }

  const unique = new Map()
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line)
    const indexSymbol = normalizeIndexSymbol(values[symbolColumn])
    if (!/^[A-Z][A-Z.]{0,9}$/.test(indexSymbol)) continue
    unique.set(indexSymbol, {
      indexSymbol,
      symbol: toYahooSymbol(indexSymbol),
      name: String(values[nameColumn] ?? indexSymbol).trim(),
      sector: String(values[sectorColumn] ?? 'Unknown').trim() || 'Unknown',
      industry: industryColumn >= 0 ? String(values[industryColumn] ?? '').trim() || null : null,
    })
  }
  return [...unique.values()]
}

/** Reject incomplete or malformed lists rather than widening the scanner universe. */
export function validateSp500Constituents(constituents) {
  const count = Array.isArray(constituents) ? constituents.length : 0
  if (count < MIN_EXPECTED_CONSTITUENTS || count > MAX_EXPECTED_CONSTITUENTS) {
    throw new Error(`S&P 500 constituent count ${count} is outside the safe range`)
  }
  if (!constituents.every(item => item.indexSymbol && item.symbol && item.name)) {
    throw new Error('S&P 500 constituent list contains invalid records')
  }
  const symbols = new Set(constituents.map(item => item.indexSymbol))
  const missingAnchors = REQUIRED_INDEX_ANCHORS.filter(symbol => !symbols.has(symbol))
  if (missingAnchors.length) {
    throw new Error(`S&P 500 constituent list is missing required anchors: ${missingAnchors.join(', ')}`)
  }
  return constituents
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

async function fetchNasdaqStockMetadata() {
  const payload = await fetchJson(NASDAQ_STOCKS_URL, NASDAQ_HEADERS)
  const rows = payload?.data?.rows ?? []
  return {
    discovered: rows.length,
    rows,
  }
}

function buildSp500Asset(constituent, row) {
  const price = parseNumber(row?.lastsale)
  const volume = parseNumber(row?.volume) ?? 0
  const sizeValue = parseNumber(row?.marketCap)
  const validPrice = Number.isFinite(price) && price > 0 ? price : null

  return {
    symbol: constituent.symbol,
    indexSymbol: constituent.indexSymbol,
    name: constituent.name,
    assetType: 'stock',
    indexMembership: SP500_INDEX_NAME,
    sizeValue: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : null,
    sizeMetric: 'marketCap',
    price: validPrice,
    volume,
    averageVolume: null,
    dollarVolume: validPrice ? validPrice * volume : 0,
    dailyChangePct: parseNumber(row?.pctchange),
    sector: constituent.sector,
    industry: constituent.industry,
    country: null,
    source: row ? 'S&P 500 constituents + Nasdaq' : 'S&P 500 constituents',
  }
}

/** Build a scanner universe containing current S&P 500 constituents only. */
export async function discoverMarketUniverse({ force = false } = {}) {
  if (!force) {
    const cached = cacheGet(UNIVERSE_CACHE_KEY)
    if (cached) return cached
  }

  const csv = await fetchText(SP500_CONSTITUENTS_URL, YAHOO_HEADERS)
  const constituents = validateSp500Constituents(parseSp500ConstituentsCsv(csv))

  let stocks = { discovered: 0, rows: [], available: false }
  try {
    const metadata = await fetchNasdaqStockMetadata()
    stocks = { ...metadata, available: true }
  } catch {
    // Membership remains authoritative; Nasdaq enrichment is optional.
  }

  const metadataBySymbol = new Map(
    stocks.rows.map(row => [normalizeIndexSymbol(row?.symbol), row]),
  )
  const assets = constituents.map(constituent => (
    buildSp500Asset(constituent, metadataBySymbol.get(constituent.indexSymbol))
  ))
  const marketDataMatched = assets.filter(asset => Number.isFinite(asset.sizeValue)).length

  const result = {
    assets: assets.sort((a, b) => (b.sizeValue ?? 0) - (a.sizeValue ?? 0)),
    stats: {
      discoveredStocks: stocks.discovered,
      indexConstituents: constituents.length,
      eligibleStocks: assets.length,
      eligibleFunds: 0,
      eligibleTotal: assets.length,
      marketDataMatched,
      marketDataMissing: assets.length - marketDataMatched,
      indexName: SP500_INDEX_NAME,
      membershipSource: 'datasets/s-and-p-500-companies',
      membershipCheckedAt: Date.now(),
      metadataProviderAvailable: stocks.available,
    },
    provider: 'S&P 500 constituents + Nasdaq',
    createdAt: Date.now(),
  }

  cacheSet(UNIVERSE_CACHE_KEY, result, UNIVERSE_TTL_SECONDS)
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
