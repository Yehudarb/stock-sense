import { randomUUID } from 'crypto'
import { getClosedAnalysisBars } from '../../client/src/lib/analysisBars.js'
import { detectCupHandlePattern } from '../../client/src/lib/patterns.js'
import { computeAll } from '../../client/src/lib/indicators.js'
import { compactTechnicalMethod, computeTechnicalMethod } from '../../client/src/lib/technicalMethod/index.js'
import { getScannerDailyBars } from './yahooFinance.js'
import {
  DEFAULT_STRENGTH_THRESHOLD,
  discoverMarketUniverse,
  evaluateStrongAssets,
  SP500_INDEX_NAME,
} from './marketUniverse.js'

const RESULT_TTL_MS = Math.max(5 * 60_000, Number.parseInt(process.env.SCANNER_RESULT_TTL_MS ?? `${30 * 60_000}`, 10))
const VALIDATION_CONCURRENCY = Math.max(1, Number.parseInt(process.env.SCANNER_VALIDATION_CONCURRENCY ?? '5', 10))
const JOB_HISTORY_LIMIT = 6

const jobs = new Map()
let activeJobId = null
let latestCompletedJobId = null

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function percent(value) {
  return Number.isFinite(value) ? round(value * 100, 2) : null
}

function syntheticBars(history) {
  const bars = history.timestamps.map((timestamp, index) => {
    const close = history.closes[index]
    return { t: timestamp, o: close, h: close, l: close, c: close, v: 0 }
  })
  return getClosedAnalysisBars(bars, '1d').bars
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

async function fetchBarsWithRetry(symbol, retries = 3) {
  let lastError = null
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await getScannerDailyBars(symbol, 320)
    } catch (error) {
      lastError = error
      if (attempt < retries - 1) await sleep(400 * (2 ** attempt) + Math.floor(Math.random() * 150))
    }
  }
  throw lastError ?? new Error(`No scanner history for ${symbol}`)
}

/** Score the chart setup itself before blending it with market strength. */
export function scoreCupSetup(cup, currentPrice) {
  const quality = cup?.meta?.quality ?? 0
  const target = cup?.meta?.pivotTarget ?? cup?.targetPrice
  const upsidePct = target && currentPrice ? ((target - currentPrice) / currentPrice) * 100 : 0
  const distancePct = Math.abs(cup?.meta?.distanceToBreakoutPct ?? 0) * 100
  const stageBonus = cup?.meta?.stage === 'near_breakout' ? 25
    : cup?.meta?.stage === 'broken_out' ? 22
      : cup?.meta?.stage === 'in_handle' ? 12
        : 4
  const volumeRatio = cup?.meta?.breakoutVolumeRatio ?? 0
  const volumeBonus = clamp((volumeRatio - 1) * 12, 0, 14)
  const handleBonus = cup?.meta?.handleVolumeContracting ? 8 : 0
  const distancePenalty = clamp(distancePct * 0.8, 0, 15)
  return round(clamp(quality * 42 + clamp(upsidePct, 0, 15) + stageBonus + volumeBonus + handleBonus - distancePenalty, 0, 100), 1)
}

/** Convert an exact OHLCV match into the compact API result used by the UI. */
export function buildCupCandidate(asset, cup, bars) {
  const currentPrice = bars?.[bars.length - 1]?.c
  if (!Number.isFinite(currentPrice) || !cup || asset?.indexMembership !== SP500_INDEX_NAME) return null
  const patternScore = scoreCupSetup(cup, currentPrice)
  const strengthScore = asset?.strength?.score ?? 0
  const opportunityScore = round(patternScore * 0.75 + strengthScore * 0.25, 1)
  const target = cup.meta?.pivotTarget ?? cup.targetPrice

  const indicators = computeAll(bars, '1d')
  const technicalMethod = indicators ? computeTechnicalMethod(bars, indicators, { best: cup, patterns: [cup] }) : null
  return {
    ticker: asset.symbol,
    indexSymbol: asset.indexSymbol ?? asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    indexMembership: asset.indexMembership,
    sector: asset.sector,
    sizeValue: asset.sizeValue,
    sizeMetric: asset.sizeMetric,
    currentPrice: round(currentPrice, currentPrice >= 100 ? 2 : 3),
    stage: cup.meta?.stage,
    pivot: round(cup.meta?.breakoutLevel, 3),
    target: round(target, 3),
    stopLoss: round(cup.meta?.invalidationLevel, 3),
    upsidePct: target ? round(((target - currentPrice) / currentPrice) * 100, 2) : null,
    distanceToBreakoutPct: percent(cup.meta?.distanceToBreakoutPct),
    breakoutVolumeRatio: round(cup.meta?.breakoutVolumeRatio, 2),
    handleVolumeRatio: round(cup.meta?.handleVolumeRatio, 2),
    handleVolumeContracting: Boolean(cup.meta?.handleVolumeContracting),
    breakoutConfirmed: Boolean(cup.meta?.breakoutConfirmed),
    cupBars: cup.meta?.cupBars ?? null,
    handleBars: cup.meta?.handleBars ?? null,
    quality: round(cup.meta?.quality ?? 0, 3),
    strengthScore,
    patternScore,
    opportunityScore,
    return3mPct: percent(asset.strength?.return3m),
    return6mPct: percent(asset.strength?.return6m),
    return12mPct: percent(asset.strength?.return12m),
    relative6mPct: percent(asset.strength?.relative6m),
    distanceFromHighPct: round(asset.strength?.distanceFromHighPct, 2),
    averageDollarVolume: round(asset.dollarVolume, 0),
    provider: `${asset.source} + Yahoo Finance`,
    timeframe: '1d',
    ...compactTechnicalMethod(technicalMethod),
  }
}

function updateJob(job, phase, completed, total, message) {
  job.progress = { phase, completed, total, message }
  job.updatedAt = Date.now()
}

function trimJobs() {
  if (jobs.size <= JOB_HISTORY_LIMIT) return
  const removable = [...jobs.values()]
    .filter(job => job.status === 'done' || job.status === 'error')
    .sort((a, b) => a.updatedAt - b.updatedAt)
  while (jobs.size > JOB_HISTORY_LIMIT && removable.length) jobs.delete(removable.shift().id)
}

async function executeScan(job, options) {
  try {
    job.status = 'running'
    updateJob(job, 'discovery', 0, 1, 'טוען ומאמת את רשימת חברות S&P 500')
    const universe = await discoverMarketUniverse({ force: options.refreshUniverse })
    job.stats = { ...job.stats, ...universe.stats }
    updateJob(job, 'discovery', 1, 1, `${universe.stats.eligibleTotal} מניות מאומתות במדד S&P 500`)

    updateJob(job, 'strength', 0, universe.assets.length, 'מחשב מגמה וחוזק יחסי מול SPY')
    const strengthResult = await evaluateStrongAssets(universe.assets, {
      threshold: options.strengthThreshold,
      onProgress: (completed, total) => updateJob(job, 'strength', completed, total, 'מחשב מגמה וחוזק יחסי מול SPY'),
    })
    job.stats = { ...job.stats, ...strengthResult.stats }

    const structural = []
    updateJob(job, 'structure', 0, strengthResult.assets.length, 'מחפש מבנה Cup במניות S&P 500 החזקות')
    strengthResult.assets.forEach((asset, index) => {
      const cup = detectCupHandlePattern(syntheticBars(asset.history))
      if (cup) structural.push({ asset, preCup: cup })
      if ((index + 1) % 25 === 0 || index === strengthResult.assets.length - 1) {
        updateJob(job, 'structure', index + 1, strengthResult.assets.length, 'מחפש מבנה Cup במניות S&P 500 החזקות')
      }
    })

    structural.sort((a, b) => (
      (b.preCup.meta?.quality ?? 0) * 70 + b.asset.strength.score * 0.3 -
      ((a.preCup.meta?.quality ?? 0) * 70 + a.asset.strength.score * 0.3)
    ))
    // The full OHLCV pass must cover every strong S&P 500 asset. Capping this
    // pool can hide a valid breakout simply because it ranked below the first
    // batch of pre-scan matches.
    const validationPool = strengthResult.assets
    job.stats.preScanMatches = structural.length
    job.stats.validationPool = validationPool.length
    job.stats.validationScope = 'all strong S&P 500 constituents'
    job.stats.validatedAssets = 0
    job.stats.validationFailed = 0

    updateJob(job, 'validation', 0, validationPool.length, 'מאמת OHLCV, נפח, Pivot וידית')
    let completed = 0
    await mapWithLimit(validationPool, VALIDATION_CONCURRENCY, async asset => {
      try {
        const fetchedBars = await fetchBarsWithRetry(asset.symbol)
        const bars = getClosedAnalysisBars(fetchedBars, '1d').bars
        const cup = detectCupHandlePattern(bars)
        if (cup && (cup.meta?.quality ?? 0) >= options.minimumQuality) {
          const candidate = buildCupCandidate(asset, cup, bars)
          if (candidate) {
            job.results.push(candidate)
            job.results.sort((a, b) => b.opportunityScore - a.opportunityScore)
          }
        }
      } catch {
        job.stats.validationFailed += 1
      } finally {
        completed += 1
        job.stats.validatedAssets = completed
        updateJob(job, 'validation', completed, validationPool.length, 'מאמת OHLCV, נפח, Pivot וידית')
        await sleep(40)
      }
    })

    job.status = 'done'
    job.stats.matches = job.results.length
    job.stats.stageCounts = job.results.reduce((counts, candidate) => {
      counts[candidate.stage] = (counts[candidate.stage] ?? 0) + 1
      return counts
    }, {})
    job.completedAt = Date.now()
    latestCompletedJobId = job.id
    updateJob(job, 'done', validationPool.length, validationPool.length, `נמצאו ${job.results.length} תבניות מאומתות`)
  } catch (error) {
    job.status = 'error'
    job.error = error?.message ?? 'S&P 500 scan failed'
    updateJob(job, 'error', job.progress?.completed ?? 0, job.progress?.total ?? 0, 'הסריקה נעצרה עקב שגיאת נתונים')
  } finally {
    if (activeJobId === job.id) activeJobId = null
    trimJobs()
  }
}

function publicJob(job) {
  if (!job) return null
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    stats: job.stats,
    results: job.results,
    error: job.error,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    parameters: job.parameters,
    cached: job.status === 'done' && Date.now() - job.completedAt < RESULT_TTL_MS,
  }
}

/** Start or reuse the shared S&P 500 Cup & Handle scan. */
export function startCupHandleScan({
  force = false,
  strengthThreshold = DEFAULT_STRENGTH_THRESHOLD,
  minimumQuality = 0.2,
} = {}) {
  const active = activeJobId ? jobs.get(activeJobId) : null
  if (active) return publicJob(active)

  const latest = latestCompletedJobId ? jobs.get(latestCompletedJobId) : null
  if (!force && latest && Date.now() - latest.completedAt < RESULT_TTL_MS) return publicJob(latest)

  const parameters = {
    universe: SP500_INDEX_NAME,
    refreshUniverse: force,
    strengthThreshold: clamp(Number(strengthThreshold) || DEFAULT_STRENGTH_THRESHOLD, 40, 90),
    minimumQuality: clamp(Number(minimumQuality) || 0.2, 0.1, 0.8),
  }
  const job = {
    id: randomUUID(),
    status: 'queued',
    progress: { phase: 'queued', completed: 0, total: 1, message: 'הסריקה ממתינה להתחלה' },
    stats: {},
    results: [],
    error: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    parameters,
  }
  jobs.set(job.id, job)
  activeJobId = job.id
  void executeScan(job, parameters)
  return publicJob(job)
}

/** Return one scanner job without exposing internal price-history arrays. */
export function getCupHandleScan(jobId) {
  return publicJob(jobs.get(jobId))
}

/** Return the active job, otherwise the latest completed scan. */
export function getLatestCupHandleScan() {
  return publicJob((activeJobId && jobs.get(activeJobId)) || (latestCompletedJobId && jobs.get(latestCompletedJobId)))
}
