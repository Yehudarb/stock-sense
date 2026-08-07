import { TECHNICAL_METHOD_CONFIG } from './config.js'

const SUPPORTED_PATTERNS = new Set([
  'CUP_HANDLE', 'HEAD_SHOULDERS', 'INVERSE_HEAD_SHOULDERS', 'DOUBLE_TOP', 'DOUBLE_BOTTOM',
  'ASCENDING_TRIANGLE', 'DESCENDING_TRIANGLE', 'SYMMETRICAL_TRIANGLE',
  'SYMMETRICAL_TRIANGLE_BREAK_UP', 'SYMMETRICAL_TRIANGLE_BREAK_DOWN',
  'BULLISH_FLAG', 'BEARISH_FLAG', 'RECTANGLE_BULLISH', 'RECTANGLE_BEARISH',
  'RESISTANCE_BREAKOUT', 'SUPPORT_BREAKDOWN', 'FAILED_BREAKOUT', 'RETEST_AFTER_BREAKOUT',
])

const PATTERN_NAME = {
  CUP_HANDLE: 'cup_and_handle',
  HEAD_SHOULDERS: 'head_and_shoulders',
  INVERSE_HEAD_SHOULDERS: 'inverse_head_and_shoulders',
  DOUBLE_TOP: 'double_top',
  DOUBLE_BOTTOM: 'double_bottom',
  ASCENDING_TRIANGLE: 'ascending_triangle',
  DESCENDING_TRIANGLE: 'descending_triangle',
  SYMMETRICAL_TRIANGLE: 'symmetrical_triangle',
  SYMMETRICAL_TRIANGLE_BREAK_UP: 'symmetrical_triangle',
  SYMMETRICAL_TRIANGLE_BREAK_DOWN: 'symmetrical_triangle',
  BULLISH_FLAG: 'bull_flag',
  BEARISH_FLAG: 'bear_flag',
  RECTANGLE_BULLISH: 'rectangle',
  RECTANGLE_BEARISH: 'rectangle',
  RESISTANCE_BREAKOUT: 'breakout_base',
  SUPPORT_BREAKDOWN: 'breakout_base',
  FAILED_BREAKOUT: 'failed_breakout',
  RETEST_AFTER_BREAKOUT: 'breakout_retest',
}

const dateAt = (bars, index) => Number.isInteger(index) && bars[index]?.t != null
  ? new Date(bars[index].t).toISOString()
  : null

function confidence(pattern) {
  if (Number.isFinite(pattern?.confidenceScore)) return pattern.confidenceScore
  if (Number.isFinite(pattern?.meta?.quality)) return Math.min(100, Math.round(55 + pattern.meta.quality * 40))
  return Math.min(100, Math.abs(pattern?.weight ?? 0))
}

/** Normalize the shared pattern engine and reject weak or overlapping evidence. */
export function normalizeMethodPatterns(patternResult, bars, config = TECHNICAL_METHOD_CONFIG) {
  const candidates = (patternResult?.patterns ?? [])
    .filter(pattern => SUPPORTED_PATTERNS.has(pattern.key))
    .map(pattern => {
      const confidenceScore = confidence(pattern)
      const breakoutConfirmed = Boolean(
        pattern.meta?.breakoutConfirmed ||
        pattern.status === 'confirmed' && ['RESISTANCE_BREAKOUT', 'SUPPORT_BREAKDOWN', 'RETEST_AFTER_BREAKOUT'].includes(pattern.key),
      )
      const status = pattern.key === 'FAILED_BREAKOUT' ? 'invalidated'
        : breakoutConfirmed ? 'breakout_confirmed'
          : pattern.status === 'confirmed' ? 'completed'
            : pattern.meta?.stage === 'near_breakout' ? 'breakout_pending' : 'forming'
      return {
        pattern: PATTERN_NAME[pattern.key] ?? pattern.key.toLowerCase(),
        sourceKey: pattern.key,
        label: pattern.label,
        direction: pattern.direction ?? 'neutral',
        startDate: dateAt(bars, pattern.visual?.startIndex),
        endDate: dateAt(bars, pattern.visual?.endIndex ?? bars.length - 1),
        confidenceScore,
        neckline: pattern.meta?.neckline ?? null,
        breakoutLevel: pattern.meta?.breakoutLevel ?? null,
        invalidationLevel: pattern.meta?.invalidationLevel ?? null,
        projectedTarget: pattern.meta?.pivotTarget ?? pattern.targetPrice ?? null,
        breakoutConfirmed,
        volumeConfirmed: typeof pattern.meta?.volumeConfirmed === 'boolean'
          ? pattern.meta.volumeConfirmed
          : typeof pattern.meta?.breakoutVolumeRatio === 'number'
            ? pattern.meta.breakoutVolumeRatio >= config.setup.confirmationVolumeRatio
            : null,
        status,
        notes: [pattern.status, pattern.meta?.stage].filter(Boolean),
        visual: pattern.visual ?? null,
        original: pattern,
      }
    })
    .filter(pattern => pattern.confidenceScore >= config.patterns.minimumConfidence)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)

  const accepted = []
  for (const pattern of candidates) {
    const overlaps = accepted.some(existing => {
      const a = existing.original.visual
      const b = pattern.original.visual
      if (!a || !b) return existing.pattern === pattern.pattern
      const overlap = Math.min(a.endIndex, b.endIndex) - Math.max(a.startIndex, b.startIndex)
      return overlap >= config.patterns.overlapBars && existing.direction === pattern.direction
    })
    if (!overlaps) accepted.push(pattern)
  }

  const normalized = accepted.map(({ original, ...pattern }) => pattern)
  return { patterns: normalized, best: normalized[0] ?? null, rejectedCount: candidates.length - accepted.length }
}
