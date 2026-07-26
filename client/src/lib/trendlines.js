import { findPivotsExt, fitLineExt, priceAtExt } from './advancedTrends'

// Trendline break detection.
//
// The premise
// -----------
// A trendline connects at least 3 higher lows (uptrend / support) or 3 lower
// highs (downtrend / resistance). The value of the line is that price has
// REPEATEDLY respected it. When the line finally breaks with conviction, the
// prevailing regime shifts — analysts trade the break, not the line itself.
//
//   • Uptrend line break  →  bearish signal  (support fails)
//   • Downtrend line break → bullish signal (resistance fails)
//
// This module returns pattern-shaped objects the main pipeline can consume
// alongside the existing chart-pattern detectors.

const MIN_PIVOTS = 3
const MIN_R2 = 0.65        // the line must be actually respected by the pivots
const MIN_SLOPE_PCT = 0.0002 // reject near-flat lines that are really support/resistance
const BREAK_LOOKBACK = 6   // check the most recent bars for the break event
const MAX_LOOKBACK = 220   // don't reach back so far the line is stale

function atr(ohlcv, period = 14) {
  const bars = ohlcv.slice(-period - 1)
  if (bars.length < 2) return null
  let sum = 0
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1], cur = bars[i]
    const tr = Math.max(
      cur.h - cur.l,
      Math.abs(cur.h - prev.c),
      Math.abs(cur.l - prev.c),
    )
    sum += tr
  }
  return sum / (bars.length - 1)
}

// Pick the tightest-fitting subset of pivots. We start from all recent pivots
// of the right type and, when the fit is poor, drop the earliest one and try
// again — that lets a trendline "reset" after a false-start pivot.
function bestFit(pivots) {
  let best = null
  for (let start = 0; start <= pivots.length - MIN_PIVOTS; start += 1) {
    const subset = pivots.slice(start)
    const line = fitLineExt(subset)
    if (!line) continue
    if (line.r2 < MIN_R2) continue
    // Prefer newer / higher-R² fits.
    if (!best || line.r2 > best.line.r2 + 0.02 || subset.length > best.subset.length) {
      best = { line, subset }
    }
  }
  return best
}

function classifyStage(distancePct, brokenBars) {
  if (brokenBars >= 1) return 'broken_out'
  if (Math.abs(distancePct) <= 0.015) return 'near_break'
  return 'developing'
}

/**
 * Detect trendline breaks on the current chart.
 * @returns array of { key, direction, weight, stage, meta:{ ... }, points }
 *   suitable for the pattern registry / setup override machinery.
 */
export function detectTrendlineBreaks(ohlcv) {
  if (!ohlcv || ohlcv.length < 40) return []
  const start = Math.max(0, ohlcv.length - MAX_LOOKBACK)
  const window = ohlcv.slice(start)
  const currentIndex = ohlcv.length - 1
  const price = ohlcv[currentIndex].c
  const atrValue = atr(ohlcv) ?? price * 0.01
  const noiseBuffer = Math.max(atrValue * 0.5, price * 0.003) // don't call a break on wick noise
  const results = []

  const pivotLows  = findPivotsExt(window, 'l', 'low',  5).map(p => ({ index: p.index + start, price: p.price }))
  const pivotHighs = findPivotsExt(window, 'h', 'high', 5).map(p => ({ index: p.index + start, price: p.price }))

  // ── UPTREND LINE (support): connect higher lows. Break = bearish. ───────
  const risingLows = pivotLows.filter((_, i, arr) => i === 0 || arr[i].price >= arr[i - 1].price)
  if (risingLows.length >= MIN_PIVOTS) {
    const fit = bestFit(risingLows)
    if (fit) {
      const { line, subset } = fit
      const normSlope = line.slope / Math.max(price, 0.0001)
      if (normSlope >= MIN_SLOPE_PCT) {
        const projectedSupport = priceAtExt(line, currentIndex)
        // Count how many of the most-recent BREAK_LOOKBACK closes are BELOW
        // the projected line by more than the noise buffer.
        let brokenBars = 0
        for (let i = ohlcv.length - BREAK_LOOKBACK; i < ohlcv.length; i += 1) {
          if (i < 0) continue
          const proj = priceAtExt(line, i)
          if (ohlcv[i].c < proj - noiseBuffer) brokenBars += 1
        }
        const distancePct = (price - projectedSupport) / projectedSupport
        const stage = classifyStage(distancePct, brokenBars)
        if (stage !== 'developing') {
          const startPoint = subset[0]
          const endPoint = { index: currentIndex, price: projectedSupport }
          // Measured target from a broken uptrend line: the pattern height from
          // the highest close inside the trend down to the break level.
          const rangeHigh = Math.max(...ohlcv.slice(startPoint.index, currentIndex + 1).map(b => b.h))
          const patternHeight = rangeHigh - projectedSupport
          results.push({
            key: 'TRENDLINE_BREAK_DOWN',
            direction: 'bearish',
            weight: -72,
            stage,
            meta: {
              breakoutLevel: projectedSupport,
              invalidationLevel: projectedSupport * (1 + Math.max(0.02, noiseBuffer / price)),
              pivotTarget: Math.max(0.01, projectedSupport - patternHeight),
              distanceToBreakoutPct: distancePct,
              lineType: 'uptrend',
              lineSlope: line.slope,
              lineR2: line.r2,
              pivotsUsed: subset.length,
              brokenBars,
            },
            points: [...subset, endPoint],
          })
        }
      }
    }
  }

  // ── DOWNTREND LINE (resistance): connect lower highs. Break = bullish. ──
  const fallingHighs = pivotHighs.filter((_, i, arr) => i === 0 || arr[i].price <= arr[i - 1].price)
  if (fallingHighs.length >= MIN_PIVOTS) {
    const fit = bestFit(fallingHighs)
    if (fit) {
      const { line, subset } = fit
      const normSlope = line.slope / Math.max(price, 0.0001)
      if (normSlope <= -MIN_SLOPE_PCT) {
        const projectedResistance = priceAtExt(line, currentIndex)
        let brokenBars = 0
        for (let i = ohlcv.length - BREAK_LOOKBACK; i < ohlcv.length; i += 1) {
          if (i < 0) continue
          const proj = priceAtExt(line, i)
          if (ohlcv[i].c > proj + noiseBuffer) brokenBars += 1
        }
        const distancePct = (projectedResistance - price) / projectedResistance
        const stage = classifyStage(distancePct, brokenBars)
        if (stage !== 'developing') {
          const startPoint = subset[0]
          const endPoint = { index: currentIndex, price: projectedResistance }
          const rangeLow = Math.min(...ohlcv.slice(startPoint.index, currentIndex + 1).map(b => b.l))
          const patternHeight = projectedResistance - rangeLow
          results.push({
            key: 'TRENDLINE_BREAK_UP',
            direction: 'bullish',
            weight: 72,
            stage,
            meta: {
              breakoutLevel: projectedResistance,
              invalidationLevel: projectedResistance * (1 - Math.max(0.02, noiseBuffer / price)),
              pivotTarget: projectedResistance + patternHeight,
              distanceToBreakoutPct: distancePct,
              lineType: 'downtrend',
              lineSlope: line.slope,
              lineR2: line.r2,
              pivotsUsed: subset.length,
              brokenBars,
            },
            points: [...subset, endPoint],
          })
        }
      }
    }
  }

  return results
}
