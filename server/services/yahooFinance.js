// Direct Yahoo Finance API — no library dependency
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

const NASDAQ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://www.nasdaq.com',
  'Referer': 'https://www.nasdaq.com/market-activity/stocks',
}

const YAHOO_INTERVAL_MAP = {
  '1m':  { interval: '1m',  range: '7d'  },
  '5m':  { interval: '5m',  range: '60d' },
  '15m': { interval: '15m', range: '60d' },
  '1h':  { interval: '60m', range: '730d'},
  '4h':  { interval: '60m', range: '730d'},
  '1d':  { interval: '1d',  range: '5y'  },
  // Fetch extra daily history so month view can calculate RSI/MACD/SMA,
  // while the client still displays only the latest month by default.
  '1mo': { interval: '1d',  range: '6mo' },
  '1y':  { interval: '1d',  range: '1y'  },
  '5y':  { interval: '1wk', range: '5y'  },
}

const FETCH_TIMEOUT_MS = parseInt(process.env.MARKET_FETCH_TIMEOUT_MS ?? '8000', 10)

async function yfFetch(url) {
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw Object.assign(new Error(`Yahoo Finance HTTP ${res.status}`), { status: res.status })
  return res.json()
}

async function nasdaqFetch(url) {
  const res = await fetch(url, {
    headers: NASDAQ_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw Object.assign(new Error(`Nasdaq HTTP ${res.status}`), { status: res.status })
  return res.json()
}

function parseNumber(value) {
  if (value == null || value === '' || value === 'N/A') return null
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[$,%\s,]/g, ''))
  return Number.isFinite(numeric) ? numeric : null
}

function roundNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function parseNasdaqDate(value) {
  if (!value || value === 'N/A') return null
  const text = String(value)
  const shortDate = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (shortDate) {
    const [, month, day, year] = shortDate
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10)
  }

  const longDate = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}\b/i)
  if (longDate) {
    const parsed = Date.parse(longDate[0])
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10)
  }

  return null
}

function addDays(dateIso, days) {
  if (!dateIso) return null
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysUntil(dateIso) {
  if (!dateIso) return null
  const today = new Date()
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const target = Date.parse(`${dateIso}T00:00:00Z`)
  return Math.ceil((target - start) / 86400000)
}

function aggregateBars(bars, groupSize) {
  const aggregated = []
  for (let index = 0; index < bars.length; index += groupSize) {
    const group = bars.slice(index, index + groupSize)
    if (!group.length) continue

    aggregated.push({
      t: group[group.length - 1].t,
      o: group[0].o,
      h: Math.max(...group.map(bar => bar.h)),
      l: Math.min(...group.map(bar => bar.l)),
      c: group[group.length - 1].c,
      v: group.reduce((sum, bar) => sum + (bar.v ?? 0), 0),
    })
  }
  return aggregated
}

export async function getBars(ticker, interval, limit = 200) {
  const { interval: yInterval, range } = YAHOO_INTERVAL_MAP[interval] ?? YAHOO_INTERVAL_MAP['5m']
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${yInterval}&range=${range}&includePrePost=false`

  const data = await yfFetch(url)
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${ticker}`)

  const timestamps = result.timestamp ?? []
  const q = result.indicators?.quote?.[0] ?? {}

  const bars = timestamps.map((t, i) => ({
    t: t * 1000,
    o: q.open?.[i]   ?? null,
    h: q.high?.[i]   ?? null,
    l: q.low?.[i]    ?? null,
    c: q.close?.[i]  ?? null,
    v: q.volume?.[i] ?? 0,
  })).filter(b => b.o != null && b.c != null)

  const normalizedBars = interval === '4h' ? aggregateBars(bars, 4) : bars
  return normalizedBars.slice(-limit)
}

export async function getSnapshot(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
  const data = await yfFetch(url)
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`No snapshot for ${ticker}`)

  return {
    ticker,
    price:     meta.regularMarketPrice      ?? 0,
    change:    (meta.regularMarketPrice - meta.chartPreviousClose) ?? 0,
    changePct: meta.chartPreviousClose
      ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
      : 0,
    volume:    meta.regularMarketVolume     ?? 0,
    high:      meta.regularMarketDayHigh    ?? 0,
    low:       meta.regularMarketDayLow     ?? 0,
    open:      meta.regularMarketOpen       ?? 0,
    prevClose: meta.chartPreviousClose      ?? 0,
    name:      meta.longName ?? meta.shortName ?? ticker,
    timestamp: Date.now(),
  }
}

export async function searchTickers(query) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=0&quotesCount=10`
  const data = await yfFetch(url)
  return (data?.finance?.result?.[0]?.quotes ?? data?.quotes ?? [])
    .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
    .slice(0, 10)
    .map(q => ({
      ticker: q.symbol,
      name:   q.shortname ?? q.longname ?? q.symbol,
    }))
}

export async function getFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json', { headers: YF_HEADERS })
    if (res.ok) {
      const data = await res.json()
      const entry = data?.data?.[0]
      if (entry) return {
        value:          parseInt(entry.value),
        classification: entry.value_classification,
        timestamp:      Date.now(),
      }
    }
  } catch {}
  return null
}

export async function getEarnings(ticker) {
  const upper = ticker.toUpperCase()
  const symbol = encodeURIComponent(upper)

  const [dateData, surpriseData, forecastData] = await Promise.allSettled([
    nasdaqFetch(`https://api.nasdaq.com/api/analyst/${symbol}/earnings-date`),
    nasdaqFetch(`https://api.nasdaq.com/api/company/${symbol}/earnings-surprise`),
    nasdaqFetch(`https://api.nasdaq.com/api/analyst/${symbol}/earnings-forecast`),
  ])

  const datePayload = dateData.status === 'fulfilled' ? dateData.value?.data ?? null : null
  const surpriseRows = surpriseData.status === 'fulfilled'
    ? surpriseData.value?.data?.earningsSurpriseTable?.rows ?? []
    : []
  const forecastRows = forecastData.status === 'fulfilled'
    ? forecastData.value?.data?.quarterlyForecast?.rows ?? []
    : []

  const lastRow = surpriseRows[0] ?? null
  const nextForecast = forecastRows[0] ?? null
  const exactNextDate = parseNasdaqDate(`${datePayload?.announcement ?? ''} ${datePayload?.reportText ?? ''}`)
  const lastReportDate = parseNasdaqDate(lastRow?.dateReported)
  const estimatedNextDate = exactNextDate ? null : addDays(lastReportDate, 91)
  const nextDate = exactNextDate ?? estimatedNextDate
  const epsActual = parseNumber(lastRow?.eps)
  const epsEstimate = parseNumber(lastRow?.consensusForecast)
  const surprisePct = parseNumber(lastRow?.percentageSurprise)
  const surpriseAmount = epsActual != null && epsEstimate != null ? epsActual - epsEstimate : null

  return {
    ticker: upper,
    source: 'Nasdaq',
    updatedAt: Date.now(),
    nextReport: {
      date: nextDate,
      daysUntil: daysUntil(nextDate),
      isEstimated: !exactNextDate && !!estimatedNextDate,
      sourceMessage: datePayload?.reportText ?? null,
      fiscalQuarter: nextForecast?.fiscalEnd ?? null,
      consensusEPS: parseNumber(nextForecast?.consensusEPSForecast),
      highEPS: parseNumber(nextForecast?.highEPSForecast),
      lowEPS: parseNumber(nextForecast?.lowEPSForecast),
      estimates: parseNumber(nextForecast?.noOfEstimates),
      revisionsUp: parseNumber(nextForecast?.up),
      revisionsDown: parseNumber(nextForecast?.down),
    },
    lastReport: lastRow ? {
      date: lastReportDate,
      fiscalQuarter: lastRow.fiscalQtrEnd ?? null,
      epsActual,
      epsEstimate,
      surpriseAmount: roundNumber(surpriseAmount),
      surprisePct,
      result: surprisePct == null
        ? 'unknown'
        : surprisePct > 0 ? 'beat' : surprisePct < 0 ? 'miss' : 'inline',
    } : null,
    history: surpriseRows.slice(0, 6).map(row => ({
      date: parseNasdaqDate(row.dateReported),
      fiscalQuarter: row.fiscalQtrEnd ?? null,
      epsActual: parseNumber(row.eps),
      epsEstimate: parseNumber(row.consensusForecast),
      surprisePct: parseNumber(row.percentageSurprise),
    })),
    quarterlyForecast: forecastRows.slice(0, 4).map(row => ({
      fiscalQuarter: row.fiscalEnd ?? null,
      consensusEPS: parseNumber(row.consensusEPSForecast),
      highEPS: parseNumber(row.highEPSForecast),
      lowEPS: parseNumber(row.lowEPSForecast),
      estimates: parseNumber(row.noOfEstimates),
      revisionsUp: parseNumber(row.up),
      revisionsDown: parseNumber(row.down),
    })),
  }
}
