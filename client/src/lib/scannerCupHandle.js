import axios from 'axios'
import { detectPatterns } from './patterns'

// Cup & Handle screener.
//
// Approach
// --------
// Client-side scan: fetch daily bars for each ticker in the universe (limited
// concurrency so we don't melt Yahoo), reuse detectPatterns() from the main
// engine, then keep only rows where a Cup & Handle is at the actionable stage
// and rank by an "opportunity score" that rewards quality + upside + proximity.
//
// The score is intentionally simple and transparent — screener output should
// give the trader a shortlist to eyeball, not a black box:
//
//   opportunityScore = (quality × 40)      // O'Neil-style proportions match
//                    + (upsidePct × 2)     // % from current price to target
//                    + stageBonus          // near_breakout > broken_out > in_handle
//                    − distanceToBreakoutPenalty
//
// Ties broken by shorter time-to-breakout (the trade-ready ones surface first).

const CONCURRENCY_LIMIT = 6
const BARS_LIMIT = 160 // ~7 months of daily bars — long enough to hold any cup

async function fetchBars(ticker) {
  try {
    const res = await axios.get(
      `/api/market/bars/${encodeURIComponent(ticker)}?interval=1d&limit=${Math.max(BARS_LIMIT, 260)}`,
      { timeout: 15000 },
    )
    const bars = Array.isArray(res.data) ? res.data
      : Array.isArray(res.data?.bars) ? res.data.bars
      : Array.isArray(res.data?.data) ? res.data.data
      : []
    // Bars may already be in {t,o,h,l,c,v} form — some server variants nest under
    // "candles" or return timestamps as seconds. Normalize defensively so a data
    // shape mismatch on one ticker doesn't tank the whole scan.
    const normalized = bars
      .map(b => ({
        t: typeof b.t === 'number' ? (b.t < 2e10 ? b.t * 1000 : b.t) : new Date(b.t).getTime(),
        o: Number(b.o), h: Number(b.h), l: Number(b.l), c: Number(b.c), v: Number(b.v || 0),
      }))
      .filter(b => (
        Number.isFinite(b.t) && Number.isFinite(b.o) && Number.isFinite(b.c) &&
        Number.isFinite(b.h) && Number.isFinite(b.l) && b.o > 0 && b.c > 0 &&
        b.h >= Math.max(b.o, b.c, b.l) && b.l <= Math.min(b.o, b.c) && b.v >= 0
      ))
      .sort((a, b) => a.t - b.t)

    return normalized.filter((bar, index, rows) => index === 0 || bar.t !== rows[index - 1].t)
  } catch {
    return []
  }
}

// Bounded-concurrency Promise.all. Native Promise.all is unbounded, and hitting
// Yahoo Finance with 80 simultaneous requests reliably starts 429-ing us; 8 at
// a time keeps the wall clock modest without triggering the rate limiter.
async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}

function scoreCandidate(cup, currentPrice) {
  const quality      = cup.meta?.quality ?? 0.5
  const target       = cup.meta?.pivotTarget ?? cup.targetPrice
  const upsidePct    = target && currentPrice ? ((target - currentPrice) / currentPrice) * 100 : 0
  const distancePct  = cup.meta?.distanceToBreakoutPct ?? 0
  const stageBonus =
    cup.meta?.stage === 'near_breakout' ? 25 :
    cup.meta?.stage === 'broken_out'    ? 20 :
    cup.meta?.stage === 'in_handle'     ? 10 :
    0
  const distancePenalty = distancePct > 0 ? Math.min(15, distancePct * 100) : 0
  const volumeBonus = Math.min(15, Math.max(0, (cup.meta?.breakoutVolumeRatio ?? 0) - 1) * 12)
  const handleBonus = cup.meta?.handleVolumeContracting ? 8 : 0
  const score = (quality * 42) + Math.min(15, Math.max(0, upsidePct)) +
    stageBonus + volumeBonus + handleBonus - distancePenalty
  return Number(Math.max(0, Math.min(100, score)).toFixed(1))
}

/**
 * Run the Cup & Handle scan.
 * @param {string[]} tickers  — universe to scan (uppercase)
 * @param {object}   options
 *   onProgress: (done, total, ticker) => void  — call after each ticker completes
 *   minQuality: number (0..1)                  — filter out shakier patterns
 *   stages: string[]                           — which stages to include
 * @returns Array of candidates sorted by opportunityScore desc.
 */
export async function scanCupAndHandle(tickers, options = {}) {
  const {
    onProgress = () => {},
    minQuality = 0.35,
    stages = ['near_breakout', 'broken_out', 'in_handle'],
  } = options

  const stageSet = new Set(stages)
  const candidates = []
  let done = 0

  await mapWithLimit(tickers, CONCURRENCY_LIMIT, async (ticker) => {
    const bars = await fetchBars(ticker)
    if (bars.length >= 45) {
      const result = detectPatterns(bars)
      const cup = result.patterns.find(p => p.key === 'CUP_HANDLE')
      if (cup && stageSet.has(cup.meta?.stage) && (cup.meta?.quality ?? 0) >= minQuality) {
        const currentPrice = bars[bars.length - 1].c
        candidates.push({
          ticker,
          currentPrice,
          stage: cup.meta?.stage,
          pivot: cup.meta?.breakoutLevel,
          target: cup.meta?.pivotTarget ?? cup.targetPrice,
          stopLoss: cup.meta?.invalidationLevel,
          upsidePct: cup.meta?.pivotTarget
            ? ((cup.meta.pivotTarget - currentPrice) / currentPrice) * 100
            : (cup.potentialPct ?? 0),
          distanceToBreakoutPct: cup.meta?.distanceToBreakoutPct ?? 0,
          breakoutVolumeRatio: cup.meta?.breakoutVolumeRatio ?? 0,
          handleVolumeRatio: cup.meta?.handleVolumeRatio ?? null,
          handleVolumeContracting: cup.meta?.handleVolumeContracting ?? false,
          breakoutConfirmed: cup.meta?.breakoutConfirmed ?? false,
          cupBars: cup.meta?.cupBars ?? null,
          handleBars: cup.meta?.handleBars ?? null,
          quality: cup.meta?.quality ?? 0,
          opportunityScore: scoreCandidate(cup, currentPrice),
        })
      }
    }
    done++
    onProgress(done, tickers.length, ticker)
  })

  candidates.sort((a, b) => b.opportunityScore - a.opportunityScore)
  return candidates
}
