import { findPivotsExt } from './advancedTrends'

// Market structure — the foundation of trend analysis before ANY indicator.
//
// A real analyst reads the chart as a SEQUENCE of pivots:
//
//   Bullish market: HL → HH → HL → HH → …   (higher lows, higher highs)
//   Bearish market: LH → LL → LH → LL → …   (lower highs, lower lows)
//
// Two structural events matter more than any oscillator reading:
//
//   • BOS  (Break of Structure) — a swing that continues the trend by taking
//     out the prior extreme in the SAME direction. Confirms the trend is
//     intact. Example: in an uptrend, price closes above the prior swing high.
//
//   • CHoCH (Change of Character) — the FIRST swing that violates the trend's
//     defining pivot. Example: in an uptrend, price closes below the most
//     recent higher-low. This is the first warning of a possible reversal —
//     analysts stop pressing longs at CHoCH and only go short after a BOS the
//     other way. It is what indicator-only engines miss entirely.
//
// This module returns a structure snapshot the signal pipeline uses BEFORE it
// looks at RSI, MACD, etc. — indicator readings are interpreted through the
// structural regime, not the other way around.

const PIVOT_STRENGTH = 5      // 5 bars on each side — sane default for daily
const RECENT_PIVOT_WINDOW = 6 // how many recent pivots define "current" structure

// Classify each pivot vs its previous SAME-KIND neighbor.
//   H pivot vs prior H → HH (higher high) or LH (lower high)
//   L pivot vs prior L → HL (higher low)  or LL (lower low)
function classifyPivots(pivots) {
  let lastHigh = null
  let lastLow = null
  return pivots.map(pivot => {
    if (pivot.kind === 'H') {
      const type = lastHigh == null ? 'H' : (pivot.price > lastHigh.price ? 'HH' : 'LH')
      lastHigh = pivot
      return { ...pivot, type }
    }
    const type = lastLow == null ? 'L' : (pivot.price > lastLow.price ? 'HL' : 'LL')
    lastLow = pivot
    return { ...pivot, type }
  })
}

// Return the last N classifiers, dominant direction, and "cleanness".
function summarizeRecent(classified, windowSize = RECENT_PIVOT_WINDOW) {
  const recent = classified.slice(-windowSize)
  const bullishCount = recent.filter(p => p.type === 'HH' || p.type === 'HL').length
  const bearishCount = recent.filter(p => p.type === 'LL' || p.type === 'LH').length
  let trend
  if (bullishCount >= bearishCount + 2)      trend = 'bullish'
  else if (bearishCount >= bullishCount + 2) trend = 'bearish'
  else                                       trend = 'consolidating'
  const alignedCount =
    trend === 'bullish' ? bullishCount :
    trend === 'bearish' ? bearishCount :
    recent.length // consolidating is "clean" by definition — no alignment expected
  const strength = recent.length ? Math.round((alignedCount / recent.length) * 100) : 0
  return { recent, trend, strength }
}

// BOS: current price has broken the prior structural extreme in the trend's
// direction. That's what CONFIRMS the trend is still driving.
function detectBOS(trend, price, keyLevels) {
  if (trend === 'bullish' && keyLevels.priorSwingHigh != null && price > keyLevels.priorSwingHigh) return 'up'
  if (trend === 'bearish' && keyLevels.priorSwingLow  != null && price < keyLevels.priorSwingLow)  return 'down'
  return null
}

// CHoCH: the FIRST swing that takes out the trend's defining pivot the other
// way. It doesn't mean the trend has reversed — it means we now have the
// EARLIEST evidence that the character has changed. Wait for BOS in the new
// direction to actually trade the reversal.
function detectCHoCH(trend, price, keyLevels) {
  // Uptrend: CHoCH down = price broke the most recent higher low.
  if (trend === 'bullish' && keyLevels.lastSwingLow != null && price < keyLevels.lastSwingLow) return 'down'
  // Downtrend: CHoCH up = price broke the most recent lower high.
  if (trend === 'bearish' && keyLevels.lastSwingHigh != null && price > keyLevels.lastSwingHigh) return 'up'
  return null
}

/**
 * Analyze the market structure of an OHLCV series.
 *
 * @returns {
 *   trend: 'bullish' | 'bearish' | 'consolidating',
 *   strength: 0-100                              (how consistently the recent pivots align),
 *   bosDirection: 'up' | 'down' | null           (has the current price confirmed the trend),
 *   chochDirection: 'up' | 'down' | null         (first warning of possible reversal),
 *   lastPivots: Array<{ index, price, kind, type }>,
 *   keyLevels: {
 *     lastSwingHigh, lastSwingLow,
 *     priorSwingHigh, priorSwingLow,
 *   },
 *   pivotCount: { total, highs, lows },
 * } | null
 */
export function analyzeMarketStructure(ohlcv) {
  if (!ohlcv || ohlcv.length < 30) return null

  const highs = findPivotsExt(ohlcv, 'h', 'high', PIVOT_STRENGTH).map(p => ({ ...p, kind: 'H' }))
  const lows  = findPivotsExt(ohlcv, 'l', 'low',  PIVOT_STRENGTH).map(p => ({ ...p, kind: 'L' }))
  if (highs.length + lows.length < 3) return null

  const allPivots = [...highs, ...lows].sort((a, b) => a.index - b.index)
  const classified = classifyPivots(allPivots)

  const { recent, trend, strength } = summarizeRecent(classified)

  const lastSwingHigh  = highs.length     ? highs[highs.length - 1].price     : null
  const lastSwingLow   = lows.length      ? lows[lows.length - 1].price       : null
  const priorSwingHigh = highs.length >= 2 ? highs[highs.length - 2].price    : null
  const priorSwingLow  = lows.length  >= 2 ? lows[lows.length - 2].price      : null
  const keyLevels = { lastSwingHigh, lastSwingLow, priorSwingHigh, priorSwingLow }

  const price = ohlcv[ohlcv.length - 1].c
  const bosDirection   = detectBOS(trend, price, keyLevels)
  const chochDirection = detectCHoCH(trend, price, keyLevels)

  return {
    trend,
    strength,
    bosDirection,
    chochDirection,
    lastPivots: recent,
    keyLevels,
    pivotCount: { total: allPivots.length, highs: highs.length, lows: lows.length },
  }
}

// Convenience: does the current structure allow taking a bullish setup?
//   • bullish or consolidating → yes
//   • bearish → only if a CHoCH up has appeared (early reversal)
//   • bearish without CHoCH → NO (don't fight the trend)
export function allowsBullishEntry(structure) {
  if (!structure) return true // no data — fall back to legacy behavior
  if (structure.trend === 'bearish' && !structure.chochDirection) return false
  return true
}

// Mirror for shorts / bearish setups.
export function allowsBearishEntry(structure) {
  if (!structure) return true
  if (structure.trend === 'bullish' && !structure.chochDirection) return false
  return true
}
