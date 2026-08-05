import { detectPivotTriangles } from './advancedTrends.js'
import { detectTrendlineBreaks } from './trendlines.js'

const PATTERN_DEFS = {
  BULLISH_FLAG: { label: 'Bull Flag', category: 'Continuation', weight: 75, direction: 'bullish', targetFactor: 1.0 },
  BEARISH_FLAG: { label: 'Bear Flag', category: 'Continuation', weight: -75, direction: 'bearish', targetFactor: 1.0 },
  BULLISH_PENNANT: { label: 'Bull Pennant', category: 'Continuation', weight: 72, direction: 'bullish', targetFactor: 0.85 },
  BEARISH_PENNANT: { label: 'Bear Pennant', category: 'Continuation', weight: -72, direction: 'bearish', targetFactor: 0.85 },
  DOUBLE_BOTTOM: { label: 'Double Bottom', category: 'Bullish Reversal', weight: 70, direction: 'bullish', targetFactor: 0.75 },
  DOUBLE_TOP: { label: 'Double Top', category: 'Bearish Reversal', weight: -70, direction: 'bearish', targetFactor: 0.75 },
  TRIPLE_BOTTOM: { label: 'Triple Bottom', category: 'Bullish Reversal', weight: 78, direction: 'bullish', targetFactor: 0.8 },
  TRIPLE_TOP: { label: 'Triple Top', category: 'Bearish Reversal', weight: -78, direction: 'bearish', targetFactor: 0.8 },
  HEAD_SHOULDERS: { label: 'Head and Shoulders', category: 'Bearish Reversal', weight: -73, direction: 'bearish', targetFactor: 1.0 },
  INVERSE_HEAD_SHOULDERS: { label: 'Inverse Head and Shoulders', category: 'Bullish Reversal', weight: 73, direction: 'bullish', targetFactor: 1.0 },
  RISING_WEDGE: { label: 'Rising Wedge', category: 'Bearish Reversal', weight: -70, direction: 'bearish', targetFactor: 0.85 },
  FALLING_WEDGE: { label: 'Falling Wedge', category: 'Bullish Reversal', weight: 70, direction: 'bullish', targetFactor: 0.85 },
  ROUNDED_BOTTOM: { label: 'Rounded Bottom', category: 'Bullish Reversal', weight: 68, direction: 'bullish', targetFactor: 0.75 },
  ROUNDED_TOP: { label: 'Rounded Top', category: 'Bearish Reversal', weight: -68, direction: 'bearish', targetFactor: 0.75 },
  ASCENDING_TRIANGLE: { label: 'Ascending Triangle', category: 'Continuation', weight: 75, direction: 'bullish', targetFactor: 0.8 },
  DESCENDING_TRIANGLE: { label: 'Descending Triangle', category: 'Continuation', weight: -75, direction: 'bearish', targetFactor: 0.8 },
  SYMMETRICAL_TRIANGLE: { label: 'Symmetrical Triangle', category: 'Continuation', weight: 35, direction: 'neutral', targetFactor: 0.65 },
  // Directional promotions of the symmetrical triangle — once the coil has
  // actually broken, "neutral" is the wrong stance and its weight jumps to
  // reflect the resolved edge.
  SYMMETRICAL_TRIANGLE_BREAK_UP:   { label: 'Symmetrical Triangle Breakout (up)',   category: 'Continuation', weight:  74, direction: 'bullish', targetFactor: 0.85 },
  SYMMETRICAL_TRIANGLE_BREAK_DOWN: { label: 'Symmetrical Triangle Breakdown',       category: 'Continuation', weight: -74, direction: 'bearish', targetFactor: 0.85 },
  // Standalone trendline breaks (not part of a triangle). Higher-lows uptrend
  // line failing = bearish; lower-highs downtrend line breaking = bullish.
  TRENDLINE_BREAK_UP:   { label: 'Downtrend Line Break',  category: 'Breakout / Breakdown', weight:  72, direction: 'bullish', targetFactor: 0.7 },
  TRENDLINE_BREAK_DOWN: { label: 'Uptrend Line Break',    category: 'Breakout / Breakdown', weight: -72, direction: 'bearish', targetFactor: 0.7 },
  EXPANDING_TRIANGLE: { label: 'Megaphone / Expanding Triangle', category: 'Continuation', weight: 0, direction: 'neutral', targetFactor: 0.75 },
  RECTANGLE_BULLISH: { label: 'Rectangle Consolidation', category: 'Continuation', weight: 62, direction: 'bullish', targetFactor: 0.7 },
  RECTANGLE_BEARISH: { label: 'Rectangle Consolidation', category: 'Continuation', weight: -62, direction: 'bearish', targetFactor: 0.7 },
  CHANNEL_UP: { label: 'Channel Up', category: 'Continuation', weight: 58, direction: 'bullish', targetFactor: 0.55 },
  CHANNEL_DOWN: { label: 'Channel Down', category: 'Continuation', weight: -58, direction: 'bearish', targetFactor: 0.55 },
  CUP_HANDLE: { label: 'Cup and Handle', category: 'Bullish Reversal', weight: 82, direction: 'bullish', targetFactor: 0.9 },
  INVERSE_CUP_HANDLE: { label: 'Inverse Cup and Handle', category: 'Bearish Reversal', weight: -82, direction: 'bearish', targetFactor: 0.9 },
  ISLAND_REVERSAL_BULL: { label: 'Bullish Island Reversal', category: 'Bullish Reversal', weight: 73, direction: 'bullish', targetFactor: 0.6 },
  RESISTANCE_BREAKOUT: { label: 'Resistance Breakout', category: 'Breakout / Breakdown', weight: 76, direction: 'bullish', targetFactor: 0.65 },
  SUPPORT_BREAKDOWN: { label: 'Support Breakdown', category: 'Breakout / Breakdown', weight: -76, direction: 'bearish', targetFactor: 0.65 },
  GAP_UP: { label: 'Gap Up', category: 'Breakout / Breakdown', weight: 58, direction: 'bullish', targetFactor: 0.45 },
  GAP_DOWN: { label: 'Gap Down', category: 'Breakout / Breakdown', weight: -58, direction: 'bearish', targetFactor: 0.45 },
  BREAKAWAY_GAP: { label: 'Breakaway Gap', category: 'Breakout / Breakdown', weight: 70, direction: 'bullish', targetFactor: 0.65 },
  EXHAUSTION_GAP: { label: 'Exhaustion Gap', category: 'Breakout / Breakdown', weight: -52, direction: 'bearish', targetFactor: 0.45 },
  VOLUME_BREAKOUT: { label: 'Volume Breakout', category: 'Breakout / Breakdown', weight: 72, direction: 'bullish', targetFactor: 0.55 },
  FAILED_BREAKOUT: { label: 'Failed Breakout', category: 'Breakout / Breakdown', weight: -68, direction: 'bearish', targetFactor: 0.55 },
  RETEST_AFTER_BREAKOUT: { label: 'Retest After Breakout', category: 'Breakout / Breakdown', weight: 66, direction: 'bullish', targetFactor: 0.5 },
  HAMMER: { label: 'Hammer', category: 'Candlestick', weight: 48, direction: 'bullish', targetFactor: 0.3 },
  INVERTED_HAMMER: { label: 'Inverted Hammer', category: 'Candlestick', weight: 44, direction: 'bullish', targetFactor: 0.3 },
  SHOOTING_STAR: { label: 'Shooting Star', category: 'Candlestick', weight: -48, direction: 'bearish', targetFactor: 0.3 },
  DOJI: { label: 'Doji', category: 'Candlestick', weight: 0, direction: 'neutral', targetFactor: 0.2 },
  DRAGONFLY_DOJI: { label: 'Dragonfly Doji', category: 'Candlestick', weight: 34, direction: 'bullish', targetFactor: 0.25 },
  GRAVESTONE_DOJI: { label: 'Gravestone Doji', category: 'Candlestick', weight: -34, direction: 'bearish', targetFactor: 0.25 },
  BULLISH_ENGULFING: { label: 'Bullish Engulfing', category: 'Candlestick', weight: 60, direction: 'bullish', targetFactor: 0.4 },
  BEARISH_ENGULFING: { label: 'Bearish Engulfing', category: 'Candlestick', weight: -60, direction: 'bearish', targetFactor: 0.4 },
  MORNING_STAR: { label: 'Morning Star', category: 'Candlestick', weight: 66, direction: 'bullish', targetFactor: 0.45 },
  EVENING_STAR: { label: 'Evening Star', category: 'Candlestick', weight: -66, direction: 'bearish', targetFactor: 0.45 },
  THREE_WHITE_SOLDIERS: { label: 'Three White Soldiers', category: 'Candlestick', weight: 70, direction: 'bullish', targetFactor: 0.5 },
  THREE_BLACK_CROWS: { label: 'Three Black Crows', category: 'Candlestick', weight: -70, direction: 'bearish', targetFactor: 0.5 },
  PIERCING_PATTERN: { label: 'Piercing Pattern', category: 'Candlestick', weight: 54, direction: 'bullish', targetFactor: 0.35 },
  DARK_CLOUD_COVER: { label: 'Dark Cloud Cover', category: 'Candlestick', weight: -54, direction: 'bearish', targetFactor: 0.35 },
  INSIDE_BAR: { label: 'Inside Bar', category: 'Candlestick', weight: 0, direction: 'neutral', targetFactor: 0.25 },
  OUTSIDE_BAR: { label: 'Outside Bar', category: 'Candlestick', weight: 0, direction: 'neutral', targetFactor: 0.25 },
  SPINNING_TOP: { label: 'Spinning Top', category: 'Candlestick', weight: 0, direction: 'neutral', targetFactor: 0.2 },
  BULLISH_MARUBOZU: { label: 'Bullish Marubozu', category: 'Candlestick', weight: 58, direction: 'bullish', targetFactor: 0.35 },
  BEARISH_MARUBOZU: { label: 'Bearish Marubozu', category: 'Candlestick', weight: -58, direction: 'bearish', targetFactor: 0.35 },
  HANGING_MAN: { label: 'Hanging Man', category: 'Candlestick', weight: -42, direction: 'bearish', targetFactor: 0.25 },
  BULLISH_HARAMI: { label: 'Bullish Harami', category: 'Candlestick', weight: 42, direction: 'bullish', targetFactor: 0.3 },
  BEARISH_HARAMI: { label: 'Bearish Harami', category: 'Candlestick', weight: -42, direction: 'bearish', targetFactor: 0.3 },
  TWEEZER_BOTTOM: { label: 'Tweezer Bottom', category: 'Candlestick', weight: 46, direction: 'bullish', targetFactor: 0.3 },
  TWEEZER_TOP: { label: 'Tweezer Top', category: 'Candlestick', weight: -46, direction: 'bearish', targetFactor: 0.3 },
  THREE_INSIDE_UP: { label: 'Three Inside Up', category: 'Candlestick', weight: 55, direction: 'bullish', targetFactor: 0.35 },
  THREE_INSIDE_DOWN: { label: 'Three Inside Down', category: 'Candlestick', weight: -55, direction: 'bearish', targetFactor: 0.35 },
  THREE_OUTSIDE_UP: { label: 'Three Outside Up', category: 'Candlestick', weight: 62, direction: 'bullish', targetFactor: 0.4 },
  THREE_OUTSIDE_DOWN: { label: 'Three Outside Down', category: 'Candlestick', weight: -62, direction: 'bearish', targetFactor: 0.4 },
}

function pctChange(from, to) {
  return from ? (to - from) / from : 0
}

function avg(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rangeHigh(bars) {
  return Math.max(...bars.map(bar => bar.h))
}

function rangeLow(bars) {
  return Math.min(...bars.map(bar => bar.l))
}

function isFlat(values, tolerance = 0.018) {
  const high = Math.max(...values)
  const low = Math.min(...values)
  return high > 0 && (high - low) / high <= tolerance
}

function slope(values) {
  if (values.length < 2) return 0
  return (values[values.length - 1] - values[0]) / Math.max(Math.abs(values[0]), 0.0001)
}

function similarLevels(values, tolerance = 0.025) {
  if (!values.length) return false
  const average = avg(values)
  return values.every(value => Math.abs(value - average) / average <= tolerance)
}

function topIndices(values, count, type) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => type === 'high' ? b.value - a.value : a.value - b.value)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
}

function localExtremeIndex(values, type) {
  if (!values.length) return 0
  const target = type === 'high' ? Math.max(...values) : Math.min(...values)
  return values.findIndex(value => value === target)
}

function candle(bar) {
  const body = Math.abs(bar.c - bar.o)
  const range = Math.max(bar.h - bar.l, 0.0001)
  const upper = bar.h - Math.max(bar.o, bar.c)
  const lower = Math.min(bar.o, bar.c) - bar.l
  return { body, range, upper, lower, bullish: bar.c >= bar.o, bearish: bar.c < bar.o }
}

function buildVisual(ohlcv, startIndex, endIndex, points = [], lines = []) {
  const safeStart = Math.max(0, startIndex)
  const safeEnd = Math.min(ohlcv.length - 1, Math.max(safeStart, endIndex))
  const bars = ohlcv.slice(safeStart, safeEnd + 1)

  return {
    startIndex: safeStart,
    endIndex: safeEnd,
    high: rangeHigh(bars),
    low: rangeLow(bars),
    points: points.filter(point => point.index >= safeStart && point.index <= safeEnd && point.price != null),
    lines: lines.filter(line =>
      line?.from?.index >= safeStart &&
      line?.from?.index <= safeEnd &&
      line?.to?.index >= safeStart &&
      line?.to?.index <= safeEnd &&
      line.from.price != null &&
      line.to.price != null
    ),
  }
}

function estimateTarget(patternKey, ohlcv) {
  const def = PATTERN_DEFS[patternKey]
  const current = ohlcv[ohlcv.length - 1].c
  const recent = ohlcv.slice(-30)
  const height = Math.max(rangeHigh(recent) - rangeLow(recent), current * 0.015)
  const move = height * def.targetFactor

  if (def.direction === 'bullish') return current + move
  if (def.direction === 'bearish') return Math.max(0.01, current - move)
  return current + (ohlcv[ohlcv.length - 1].c >= ohlcv[0].c ? move : -move)
}

function addPattern(found, key, ohlcv, strength = 1, status = 'developing', visual = null, meta = {}) {
  if (found.some(pattern => pattern.key === key)) return
  const def = PATTERN_DEFS[key]
  const current = ohlcv[ohlcv.length - 1].c
  const targetPrice = estimateTarget(key, ohlcv)
  const fallbackVisual = buildVisual(ohlcv, Math.max(0, ohlcv.length - 30), ohlcv.length - 1)
  found.push({
    key,
    label: def.label,
    category: def.category,
    weight: Math.round(def.weight * strength),
    direction: def.direction,
    status,
    targetPrice: Number(targetPrice.toFixed(targetPrice >= 100 ? 2 : 3)),
    potentialPct: Number((((targetPrice - current) / current) * 100).toFixed(2)),
    visual: visual ?? fallbackVisual,
    meta,
  })
}

function addPivotTrianglePatterns(found, ohlcv) {
  detectPivotTriangles(ohlcv).forEach(triangle => {
    // A symmetrical triangle that has already resolved (broken UP or DOWN)
    // stops being a "neutral" coil — the resolution IS the trade. Promote it
    // to a directional key so the setup override and the UI can treat it as
    // a real bullish / bearish signal with proper weight.
    let key = triangle.key
    if (triangle.key === 'SYMMETRICAL_TRIANGLE') {
      if (triangle.status === 'breakout_up')   key = 'SYMMETRICAL_TRIANGLE_BREAK_UP'
      else if (triangle.status === 'breakout_down') key = 'SYMMETRICAL_TRIANGLE_BREAK_DOWN'
    }
    if (found.some(pattern => pattern.key === key)) return
    const def = PATTERN_DEFS[key]
    if (!def) return
    const current = ohlcv[ohlcv.length - 1].c
    const isBearishKey = def.weight < 0
    const targetPrice = isBearishKey ? triangle.targetDown : triangle.targetUp
    const breakoutLevel = isBearishKey ? triangle.support : triangle.resistance
    const invalidationLevel = isBearishKey ? triangle.resistance : triangle.support

    // Map raw status → the stage vocabulary the setup override understands.
    let stage
    if (triangle.status === 'breakout_up' || triangle.status === 'breakout_down') stage = 'broken_out'
    else if (triangle.completionPct >= 70) stage = 'near_breakout'
    else stage = 'developing'

    // For directional-break variants, also record how far past the pivot we are.
    const distanceToBreakoutPct = breakoutLevel && current
      ? (isBearishKey ? (current - breakoutLevel) / breakoutLevel
                      : (breakoutLevel - current) / breakoutLevel)
      : null

    found.push({
      key,
      label: def.label,
      category: def.category,
      weight: Math.round((def.weight || 0) * (triangle.strength / 2)),
      direction: def.direction,
      status: stage === 'broken_out' ? 'confirmed' : 'developing',
      targetPrice,
      potentialPct: Number((((targetPrice - current) / current) * 100).toFixed(2)),
      visual: triangle.visual,
      meta: {
        ...triangle,
        breakoutLevel,
        invalidationLevel,
        stage,
        distanceToBreakoutPct,
        pivotTarget: targetPrice,
      },
    })
  })
}

// Standalone trendline break patterns — not a triangle, just a line that
// connected several highs / lows and finally cracked. Analysts read these as
// regime-change triggers.
function addTrendlineBreakPatterns(found, ohlcv) {
  detectTrendlineBreaks(ohlcv).forEach(hit => {
    if (found.some(p => p.key === hit.key)) return
    const def = PATTERN_DEFS[hit.key]
    if (!def) return
    const current = ohlcv[ohlcv.length - 1].c
    const target = hit.meta?.pivotTarget ?? current
    const potentialPct = Number((((target - current) / current) * 100).toFixed(2))
    const visual = buildVisual(ohlcv, hit.points?.[0]?.index ?? Math.max(0, ohlcv.length - 60), ohlcv.length - 1, hit.points, [
      // Connect the pivots that anchor the trendline plus its projection to now.
      ...hit.points.slice(0, -1).map((from, i) => ({ from, to: hit.points[i + 1] })),
    ])
    found.push({
      key: hit.key,
      label: def.label,
      category: def.category,
      weight: hit.weight, // already correctly signed by the detector
      direction: def.direction,
      status: hit.stage === 'broken_out' ? 'confirmed' : 'developing',
      targetPrice: target,
      potentialPct,
      visual,
      meta: hit.meta,
    })
  })
}

function detectDoubleTriple(found, ohlcv) {
  const last30 = ohlcv.slice(-30)
  const offset = ohlcv.length - last30.length
  const highs = last30.map(bar => bar.h)
  const lows = last30.map(bar => bar.l)
  const top3 = topIndices(highs, 3, 'high')
  const low3 = topIndices(lows, 3, 'low')

  if (top3.length >= 2 && Math.abs(top3[0].index - top3[1].index) >= 5 && similarLevels(top3.slice(0, 2).map(item => item.value))) {
    const peaks = top3.slice(0, 2).map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'DOUBLE_TOP', ohlcv, 1, 'confirmed', buildVisual(ohlcv, peaks[0].index, peaks[1].index, peaks, [{ from: peaks[0], to: peaks[1] }]))
  }
  if (low3.length >= 2 && Math.abs(low3[0].index - low3[1].index) >= 5 && similarLevels(low3.slice(0, 2).map(item => item.value))) {
    const troughs = low3.slice(0, 2).map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'DOUBLE_BOTTOM', ohlcv, 1, 'confirmed', buildVisual(ohlcv, troughs[0].index, troughs[1].index, troughs, [{ from: troughs[0], to: troughs[1] }]))
  }
  if (top3.length === 3 && similarLevels(top3.map(item => item.value), 0.03) && top3[2].index - top3[0].index >= 10) {
    const peaks = top3.map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'TRIPLE_TOP', ohlcv, 1.05, 'confirmed', buildVisual(ohlcv, peaks[0].index, peaks[2].index, peaks, [{ from: peaks[0], to: peaks[2] }]))
  }
  if (low3.length === 3 && similarLevels(low3.map(item => item.value), 0.03) && low3[2].index - low3[0].index >= 10) {
    const troughs = low3.map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'TRIPLE_BOTTOM', ohlcv, 1.05, 'confirmed', buildVisual(ohlcv, troughs[0].index, troughs[2].index, troughs, [{ from: troughs[0], to: troughs[2] }]))
  }
}

function detectFlagsPennants(found, ohlcv) {
  const last12 = ohlcv.slice(-12)
  if (last12.length < 12) return
  const offset = ohlcv.length - last12.length
  const pole = last12.slice(0, 6)
  const consolidation = last12.slice(6)
  const poleUp = pctChange(rangeLow(pole), rangeHigh(pole))
  const poleDown = pctChange(rangeHigh(pole), rangeLow(pole))
  const consRange = (rangeHigh(consolidation) - rangeLow(consolidation)) / rangeHigh(consolidation)
  const highs = consolidation.map(bar => bar.h)
  const lows = consolidation.map(bar => bar.l)
  const converging = slope(highs) < -0.003 && slope(lows) > 0.003
  const start = offset
  const mid = offset + 5
  const end = ohlcv.length - 1
  const upperStart = { index: mid + 1, price: consolidation[0].h }
  const upperEnd = { index: end, price: consolidation[consolidation.length - 1].h }
  const lowerStart = { index: mid + 1, price: consolidation[0].l }
  const lowerEnd = { index: end, price: consolidation[consolidation.length - 1].l }
  const visual = buildVisual(ohlcv, start, end, [
    { index: start, price: last12[0].c },
    { index: mid, price: last12[5].c },
  ], [
    { from: { index: start, price: last12[0].c }, to: { index: mid, price: last12[5].c } },
    { from: upperStart, to: upperEnd },
    { from: lowerStart, to: lowerEnd },
  ])

  if (poleUp > 0.045 && consRange < 0.04) addPattern(found, converging ? 'BULLISH_PENNANT' : 'BULLISH_FLAG', ohlcv, 1, 'developing', visual)
  if (poleDown < -0.045 && consRange < 0.04) addPattern(found, converging ? 'BEARISH_PENNANT' : 'BEARISH_FLAG', ohlcv, 1, 'developing', visual)
}

function detectTrianglesWedgesChannels(found, ohlcv) {
  const last16 = ohlcv.slice(-16)
  const offset = ohlcv.length - last16.length
  const highs = last16.map(bar => bar.h)
  const lows = last16.map(bar => bar.l)
  const highSlope = slope(highs)
  const lowSlope = slope(lows)
  const start = offset
  const end = ohlcv.length - 1
  const highLine = { from: { index: start, price: highs[0] }, to: { index: end, price: highs[highs.length - 1] } }
  const lowLine = { from: { index: start, price: lows[0] }, to: { index: end, price: lows[lows.length - 1] } }
  const visual = buildVisual(ohlcv, start, end, [], [highLine, lowLine])

  if (isFlat(highs, 0.018) && lowSlope > 0.006) addPattern(found, 'ASCENDING_TRIANGLE', ohlcv, 1, 'developing', visual)
  if (isFlat(lows, 0.018) && highSlope < -0.006) addPattern(found, 'DESCENDING_TRIANGLE', ohlcv, 1, 'developing', visual)
  if (highSlope < -0.006 && lowSlope > 0.006) addPattern(found, 'SYMMETRICAL_TRIANGLE', ohlcv, 0.8, 'developing', visual)
  if (highSlope > 0.006 && lowSlope > 0.006 && lowSlope > highSlope + 0.004) addPattern(found, 'RISING_WEDGE', ohlcv, 1, 'developing', visual)
  if (highSlope < -0.006 && lowSlope < -0.006 && Math.abs(highSlope) > Math.abs(lowSlope) + 0.004) addPattern(found, 'FALLING_WEDGE', ohlcv, 1, 'developing', visual)
  if (highSlope > 0.008 && lowSlope > 0.008 && Math.abs(highSlope - lowSlope) < 0.008) addPattern(found, 'CHANNEL_UP', ohlcv, 0.9, 'developing', visual)
  if (highSlope < -0.008 && lowSlope < -0.008 && Math.abs(highSlope - lowSlope) < 0.008) addPattern(found, 'CHANNEL_DOWN', ohlcv, 0.9, 'developing', visual)
}

function detectRectangles(found, ohlcv) {
  const last18 = ohlcv.slice(-18)
  const offset = ohlcv.length - last18.length
  const highs = last18.map(bar => bar.h)
  const lows = last18.map(bar => bar.l)
  const width = (Math.max(...highs) - Math.min(...lows)) / avg(last18.map(bar => bar.c))
  const current = ohlcv[ohlcv.length - 1].c
  const previous = ohlcv[Math.max(0, ohlcv.length - 18)].c

  if (isFlat(highs, 0.025) && isFlat(lows, 0.025) && width > 0.025) {
    const start = offset
    const end = ohlcv.length - 1
    const top = avg(highs)
    const bottom = avg(lows)
    const visual = buildVisual(ohlcv, start, end, [], [
      { from: { index: start, price: top }, to: { index: end, price: top } },
      { from: { index: start, price: bottom }, to: { index: end, price: bottom } },
    ])
    addPattern(found, current >= previous ? 'RECTANGLE_BULLISH' : 'RECTANGLE_BEARISH', ohlcv, 0.9, 'developing', visual)
  }
}

function detectHeadShoulders(found, ohlcv) {
  const last30 = ohlcv.slice(-30)
  const offset = ohlcv.length - last30.length
  const highs = last30.map(bar => bar.h)
  const lows = last30.map(bar => bar.l)
  const leftHigh = Math.max(...highs.slice(0, 10))
  const headHigh = Math.max(...highs.slice(10, 20))
  const rightHigh = Math.max(...highs.slice(20))
  const leftLow = Math.min(...lows.slice(0, 10))
  const headLow = Math.min(...lows.slice(10, 20))
  const rightLow = Math.min(...lows.slice(20))

  if (headHigh > leftHigh * 1.025 && headHigh > rightHigh * 1.025 && Math.abs(leftHigh - rightHigh) / leftHigh < 0.06) {
    const points = [
      { index: offset + localExtremeIndex(highs.slice(0, 10), 'high'), price: leftHigh },
      { index: offset + 10 + localExtremeIndex(highs.slice(10, 20), 'high'), price: headHigh },
      { index: offset + 20 + localExtremeIndex(highs.slice(20), 'high'), price: rightHigh },
    ]
    const neckline = Math.min(...lows.slice(7, 24))
    addPattern(found, 'HEAD_SHOULDERS', ohlcv, 1, 'confirmed', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
      { from: { index: offset + 7, price: neckline }, to: { index: offset + 24, price: neckline } },
    ]), { invalidationLevel: rightHigh, breakoutLevel: neckline })
  }
  if (headLow < leftLow * 0.975 && headLow < rightLow * 0.975 && Math.abs(leftLow - rightLow) / leftLow < 0.06) {
    const points = [
      { index: offset + localExtremeIndex(lows.slice(0, 10), 'low'), price: leftLow },
      { index: offset + 10 + localExtremeIndex(lows.slice(10, 20), 'low'), price: headLow },
      { index: offset + 20 + localExtremeIndex(lows.slice(20), 'low'), price: rightLow },
    ]
    const neckline = Math.max(...highs.slice(7, 24))
    addPattern(found, 'INVERSE_HEAD_SHOULDERS', ohlcv, 1, 'confirmed', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
      { from: { index: offset + 7, price: neckline }, to: { index: offset + 24, price: neckline } },
    ]), { invalidationLevel: rightLow, breakoutLevel: neckline })
  }
}

function detectRoundedStructures(found, ohlcv) {
  const last45 = ohlcv.slice(-45)
  if (last45.length < 40) return
  const offset = ohlcv.length - last45.length
  const left = last45.slice(0, 15)
  const middle = last45.slice(15, 30)
  const right = last45.slice(30)
  const leftAvg = avg(left.map(bar => bar.c))
  const midAvg = avg(middle.map(bar => bar.c))
  const rightAvg = avg(right.map(bar => bar.c))
  const midLow = rangeLow(middle)
  const midHigh = rangeHigh(middle)

  if (midAvg < leftAvg * 0.97 && rightAvg > midAvg * 1.03 && Math.abs(leftAvg - rightAvg) / leftAvg < 0.08) {
    const points = [
      { index: offset, price: left[0].c },
      { index: offset + 15 + localExtremeIndex(middle.map(bar => bar.l), 'low'), price: midLow },
      { index: ohlcv.length - 1, price: right[right.length - 1].c },
    ]
    addPattern(found, 'ROUNDED_BOTTOM', ohlcv, 0.9, 'developing', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
    ]))
  }
  if (midAvg > leftAvg * 1.03 && rightAvg < midAvg * 0.97 && Math.abs(leftAvg - rightAvg) / leftAvg < 0.08) {
    const points = [
      { index: offset, price: left[0].c },
      { index: offset + 15 + localExtremeIndex(middle.map(bar => bar.h), 'high'), price: midHigh },
      { index: ohlcv.length - 1, price: right[right.length - 1].c },
    ]
    addPattern(found, 'ROUNDED_TOP', ohlcv, 0.9, 'developing', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
    ]))
  }
}

// Cup & Handle: a bullish continuation base. Prior code assumed a rigid 40-bar
// window with a 12/16/12 split — real cups form over widely varying lengths
// (a daily cup can be 60–130 bars, weekly larger) and the "quality" comes from
// PROPORTION between cup and handle, not fixed slots. We now search multiple
// (window, handleLen) pairs, accept the tightest well-formed match, and expose:
//   • stage:  cup_forming / in_handle / near_breakout / broken_out
//   • breakoutLevel (the pivot the pattern trades off)
//   • invalidationLevel (below handle = pattern is done)
//   • pivotTarget (the price target on breakout)
//   • distanceToBreakoutPct (how far the current price is under the pivot)
// This is what lets the signal engine treat handle-pullback indicator weakness
// as PATTERN feature, not a SELL setup.
function detectCupHandle(found, ohlcv) {
  const n = ohlcv.length
  if (n < 45) return
  const current = ohlcv[n - 1].c

  // Try several sizes so real-world cups (short and long) both surface.
  const configs = []
  for (const windowSize of [60, 80, 100, 130]) {
    if (windowSize > n) continue
    for (const handleLen of [8, 12, 18, 25, 34]) {
      if (handleLen >= windowSize * 0.4) continue // handle must be << cup
      configs.push({ windowSize, handleLen })
    }
  }

  let best = null
  for (const { windowSize, handleLen } of configs) {
    const window = ohlcv.slice(-windowSize)
    const offset = n - windowSize
    const cupBars = window.slice(0, windowSize - handleLen)
    const handleBars = window.slice(windowSize - handleLen)
    const leftRimBars = cupBars.slice(0, Math.max(3, Math.round(cupBars.length * 0.18)))
    const rightRimBars = cupBars.slice(-Math.max(3, Math.round(cupBars.length * 0.18)))
    const bottomBars = cupBars.slice(
      Math.round(cupBars.length * 0.30),
      Math.round(cupBars.length * 0.70),
    )
    if (!leftRimBars.length || !rightRimBars.length || !bottomBars.length) continue

    const leftRim = rangeHigh(leftRimBars)
    const rightRim = rangeHigh(rightRimBars)
    const leftRimClose = rangeHigh(leftRimBars.map(bar => ({ h: bar.c })))
    const rightRimClose = rangeHigh(rightRimBars.map(bar => ({ h: bar.c })))
    const cupLow = rangeLow(bottomBars)
    const rim = Math.max(leftRim, rightRim)
    const handleHigh = rangeHigh(handleBars)
    const handleLow = rangeLow(handleBars)
    // A breakout candle is part of the input handle window, but its high must
    // not invalidate the handle before we classify that same candle as a
    // confirmed breakout.
    const breakoutCandle = current >= rim * 1.005
    const setupHandleBars = breakoutCandle && handleBars.length > 1
      ? handleBars.slice(0, -1)
      : handleBars
    const setupHandleHigh = rangeHigh(setupHandleBars)
    const setupHandleLow = rangeLow(setupHandleBars)

    if (rim <= 0) continue
    const cupDepth = (rim - cupLow) / rim
    const rimAsym = Math.abs(leftRim - rightRim) / rim
    const handlePullback = (rightRim - setupHandleLow) / rightRim
    const handleShallowerThanCup = (rightRim - setupHandleLow) < (rightRim - cupLow) * 0.55
    const rimRecovery = leftRimClose > 0 ? rightRimClose / leftRimClose : 0
    const cupVolume = avg(cupBars.map(bar => bar.v ?? 0))
    const handleVolume = avg(handleBars.map(bar => bar.v ?? 0))
    const handleReferenceVolume = avg(cupBars.slice(-Math.min(20, cupBars.length)).map(bar => bar.v ?? 0))
    const handleVolumeRatio = handleReferenceVolume > 0 ? handleVolume / handleReferenceVolume : 1

    // Cup low should live near the middle of the cup — a V (early low) or a
    // slope (late low) both disqualify a proper rounded base.
    const cupLowIdxInBottom = localExtremeIndex(bottomBars.map(b => b.l), 'low')
    const cupLowGlobalIdx = Math.round(cupBars.length * 0.30) + cupLowIdxInBottom
    const cupLowPosition = cupLowGlobalIdx / cupBars.length // 0..1

    // Structural validity — these are relatively generous so real charts pass.
    const ok =
      cupDepth >= 0.08 && cupDepth <= 0.50 &&
      rimAsym <= 0.08 &&
      handlePullback >= 0.005 && handlePullback <= 0.20 &&
      handleShallowerThanCup &&
      cupLowPosition >= 0.30 && cupLowPosition <= 0.75 &&
      setupHandleHigh <= rim * 1.005 &&
      rimRecovery >= 0.92

    if (!ok) continue

    // Quality score — closer to the classic O'Neil proportions = higher.
    // Reward moderate depth (~15–30%), tight handles (~3–10%), tight rims.
    const depthScore   = 1 - Math.abs(cupDepth   - 0.20) / 0.30
    const handleScore  = 1 - Math.abs(handlePullback - 0.06) / 0.15
    const rimScore     = 1 - (rimAsym / 0.08)
    const volumeScore = handleVolumeRatio <= 0.9 ? 1 : handleVolumeRatio <= 1.1 ? 0.65 : 0.25
    const recoveryScore = clamp01((rimRecovery - 0.92) / 0.08)
    const quality = clamp01((depthScore + handleScore + rimScore + volumeScore + recoveryScore) / 5)
    if (best && quality <= best.quality) continue

    best = {
      quality, offset, window, cupBars, handleBars,
      leftRim, rightRim, cupLow, rim, handleHigh: setupHandleHigh, handleLow: setupHandleLow,
      cupDepth, rimAsym, handlePullback, handleLen, windowSize,
      rimRecovery, cupVolume, handleVolume, handleVolumeRatio,
    }
  }

  if (!best) return

  // Where is the price relative to the pivot? That decides the STAGE.
  const pivot = best.rim
  const cupDollarDepth = pivot - best.cupLow
  const pivotTarget = pivot + cupDollarDepth * (PATTERN_DEFS.CUP_HANDLE.targetFactor || 0.9)
  const distToBreakoutPct = (pivot - current) / pivot
  const recentVolume = avg(ohlcv.slice(-20).map(bar => bar.v ?? 0))
  const lastVolume = ohlcv[n - 1]?.v ?? 0
  const breakoutVolumeRatio = recentVolume > 0 ? lastVolume / recentVolume : 0
  const priceBreakout = current >= pivot * 1.005
  const breakoutConfirmed = priceBreakout && breakoutVolumeRatio >= 1.2
  let stage
  if (breakoutConfirmed) stage = 'broken_out'
  else if (priceBreakout) stage = 'near_breakout'
  else if (distToBreakoutPct <= 0.02) stage = 'near_breakout'
  else if (current <= best.handleHigh) stage = 'in_handle'
  else stage = 'cup_forming'

  const strength = 1 + (best.quality * 0.3) // 1.0–1.3 based on quality
  const cupLowIdx = best.offset + Math.round(best.cupBars.length * 0.30) +
    localExtremeIndex(best.cupBars.slice(
      Math.round(best.cupBars.length * 0.30),
      Math.round(best.cupBars.length * 0.70),
    ).map(bar => bar.l), 'low')
  const rightRimIdx = best.offset + best.cupBars.length -
    Math.max(3, Math.round(best.cupBars.length * 0.18)) +
    localExtremeIndex(best.cupBars.slice(-Math.max(3, Math.round(best.cupBars.length * 0.18))).map(bar => bar.h), 'high')
  const handleLowIdx = best.offset + best.cupBars.length +
    localExtremeIndex(best.handleBars.map(bar => bar.l), 'low')
  const points = [
    { index: best.offset, price: best.leftRim },
    { index: cupLowIdx, price: best.cupLow },
    { index: rightRimIdx, price: best.rightRim },
    { index: handleLowIdx, price: best.handleLow },
  ]

  addPattern(
    found,
    'CUP_HANDLE',
    ohlcv,
    strength,
    stage === 'broken_out' ? 'confirmed' : 'developing',
    buildVisual(ohlcv, best.offset, n - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
      { from: points[2], to: points[3] },
    ]),
    {
      breakoutLevel: pivot,
      invalidationLevel: best.handleLow,
      pivotTarget,
      cupDepth: best.cupDepth,
      handlePullback: best.handlePullback,
      distanceToBreakoutPct: distToBreakoutPct,
      stage,
      quality: best.quality,
      breakoutConfirmed,
      breakoutVolumeRatio,
      handleVolumeRatio: best.handleVolumeRatio,
      handleVolumeContracting: best.handleVolumeRatio <= 0.9,
      cupBars: best.windowSize - best.handleLen,
      handleBars: best.handleLen,
      rimRecovery: best.rimRecovery,
    },
  )
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

function detectBreakoutsAndGaps(found, ohlcv) {
  const n = ohlcv.length
  const last = ohlcv[n - 1]
  const prev = ohlcv[n - 2]
  if (!last || !prev) return
  const previous20 = ohlcv.slice(Math.max(0, n - 21), n - 1)
  const resistance = rangeHigh(previous20)
  const support = rangeLow(previous20)
  const avgVolume = avg(previous20.map(bar => bar.v ?? 0)) || 0
  const highVolume = avgVolume > 0 && (last.v ?? 0) >= avgVolume * 1.4
  const start = Math.max(0, n - 22)
  const visual = buildVisual(ohlcv, start, n - 1, [
    { index: n - 1, price: last.c },
  ], [
    { from: { index: start, price: resistance }, to: { index: n - 1, price: resistance } },
    { from: { index: start, price: support }, to: { index: n - 1, price: support } },
  ])

  if (last.c > resistance * 1.002) addPattern(found, 'RESISTANCE_BREAKOUT', ohlcv, highVolume ? 1.1 : 0.85, highVolume ? 'confirmed' : 'near breakout', visual, { breakoutLevel: resistance, invalidationLevel: resistance * 0.985, volumeConfirmed: highVolume })
  if (last.c < support * 0.998) addPattern(found, 'SUPPORT_BREAKDOWN', ohlcv, highVolume ? 1.1 : 0.85, highVolume ? 'confirmed' : 'near breakdown', visual, { breakoutLevel: support, invalidationLevel: support * 1.015, volumeConfirmed: highVolume })
  if (last.h > resistance * 1.003 && last.c < resistance) addPattern(found, 'FAILED_BREAKOUT', ohlcv, 1, 'confirmed', visual, { breakoutLevel: resistance, invalidationLevel: last.h, volumeConfirmed: highVolume })
  if (Math.abs(last.l - resistance) / resistance < 0.006 && last.c > resistance) addPattern(found, 'RETEST_AFTER_BREAKOUT', ohlcv, 1, 'confirmed', visual, { breakoutLevel: resistance, invalidationLevel: support, volumeConfirmed: highVolume })
  if (highVolume && last.c > last.o && Math.abs(last.c - last.o) / Math.max(last.c, 0.01) > 0.012) addPattern(found, 'VOLUME_BREAKOUT', ohlcv, 1, 'confirmed', visual, { breakoutLevel: resistance, invalidationLevel: support, volumeConfirmed: true })

  if (last.l > prev.h * 1.002) addPattern(found, highVolume ? 'BREAKAWAY_GAP' : 'GAP_UP', ohlcv, 1, highVolume ? 'confirmed' : 'developing', buildVisual(ohlcv, n - 2, n - 1, [
    { index: n - 2, price: prev.h },
    { index: n - 1, price: last.l },
  ]), { breakoutLevel: last.l, invalidationLevel: prev.h, volumeConfirmed: highVolume })
  if (last.h < prev.l * 0.998) addPattern(found, 'GAP_DOWN', ohlcv, highVolume ? 1.1 : 1, highVolume ? 'confirmed' : 'developing', buildVisual(ohlcv, n - 2, n - 1, [
    { index: n - 2, price: prev.l },
    { index: n - 1, price: last.h },
  ]), { breakoutLevel: last.h, invalidationLevel: prev.l, volumeConfirmed: highVolume })
  if (last.l > prev.h * 1.002 && last.c < last.o && highVolume) addPattern(found, 'EXHAUSTION_GAP', ohlcv, 1, 'confirmed', null, { breakoutLevel: last.l, invalidationLevel: last.h, volumeConfirmed: true })
}

function detectCandlesticks(found, ohlcv) {
  const n = ohlcv.length
  const last = ohlcv[n - 1]
  const prev = ohlcv[n - 2]
  const third = ohlcv[n - 3]
  if (!last || !prev) return
  const c = candle(last)
  const p = candle(prev)
  const visual = buildVisual(ohlcv, Math.max(0, n - 3), n - 1, [{ index: n - 1, price: last.c }])

  if (c.body / c.range <= 0.1 && c.lower > c.range * 0.55) addPattern(found, 'DRAGONFLY_DOJI', ohlcv, 1, 'confirmed', visual)
  else if (c.body / c.range <= 0.1 && c.upper > c.range * 0.55) addPattern(found, 'GRAVESTONE_DOJI', ohlcv, 1, 'confirmed', visual)
  else if (c.body / c.range <= 0.1) addPattern(found, 'DOJI', ohlcv, 1, 'confirmed', visual)

  if (c.lower >= c.body * 2.2 && c.upper <= c.body * 0.9 && c.body / c.range < 0.42) addPattern(found, 'HAMMER', ohlcv, 1, 'confirmed', visual)
  if (c.upper >= c.body * 2.2 && c.lower <= c.body * 0.9 && c.body / c.range < 0.42 && c.bullish) addPattern(found, 'INVERTED_HAMMER', ohlcv, 1, 'confirmed', visual)
  if (c.upper >= c.body * 2.2 && c.lower <= c.body * 0.9 && c.body / c.range < 0.42 && c.bearish) addPattern(found, 'SHOOTING_STAR', ohlcv, 1, 'confirmed', visual)
  if (c.body / c.range <= 0.3 && c.upper > c.body && c.lower > c.body) addPattern(found, 'SPINNING_TOP', ohlcv, 1, 'confirmed', visual)
  if (c.body / c.range >= 0.85 && c.bullish && c.upper <= c.range * 0.08 && c.lower <= c.range * 0.08) addPattern(found, 'BULLISH_MARUBOZU', ohlcv, 1, 'confirmed', visual)
  if (c.body / c.range >= 0.85 && c.bearish && c.upper <= c.range * 0.08 && c.lower <= c.range * 0.08) addPattern(found, 'BEARISH_MARUBOZU', ohlcv, 1, 'confirmed', visual)
  const recentBars = ohlcv.slice(-5, -1)
  const priorUp = recentBars.length >= 3 && recentBars.every((bar, index, bars) => index === 0 || bar.c >= bars[index - 1].c)
  if (priorUp && c.lower >= c.body * 2.2 && c.upper <= c.body * 0.9 && c.body / c.range < 0.42) addPattern(found, 'HANGING_MAN', ohlcv, 1, 'confirmed', visual)
  if (p.bearish && c.bullish && last.o <= prev.c && last.c >= prev.o) addPattern(found, 'BULLISH_ENGULFING', ohlcv, 1, 'confirmed', visual)
  if (p.bullish && c.bearish && last.o >= prev.c && last.c <= prev.o) addPattern(found, 'BEARISH_ENGULFING', ohlcv, 1, 'confirmed', visual)
  if (p.bearish && c.bullish && last.o >= prev.c && last.c <= prev.o) addPattern(found, 'BULLISH_HARAMI', ohlcv, 1, 'confirmed', visual)
  if (p.bullish && c.bearish && last.o <= prev.c && last.c >= prev.o) addPattern(found, 'BEARISH_HARAMI', ohlcv, 1, 'confirmed', visual)
  if (Math.abs(last.l - prev.l) / Math.max(prev.l, 0.01) <= 0.002 && p.bearish && c.bullish) addPattern(found, 'TWEEZER_BOTTOM', ohlcv, 1, 'confirmed', visual)
  if (Math.abs(last.h - prev.h) / Math.max(prev.h, 0.01) <= 0.002 && p.bullish && c.bearish) addPattern(found, 'TWEEZER_TOP', ohlcv, 1, 'confirmed', visual)
  if (p.bearish && c.bullish && last.o < prev.l && last.c > prev.o - p.body * 0.5) addPattern(found, 'PIERCING_PATTERN', ohlcv, 1, 'confirmed', visual)
  if (p.bullish && c.bearish && last.o > prev.h && last.c < prev.o + p.body * 0.5) addPattern(found, 'DARK_CLOUD_COVER', ohlcv, 1, 'confirmed', visual)
  if (last.h < prev.h && last.l > prev.l) addPattern(found, 'INSIDE_BAR', ohlcv, 1, 'developing', visual)
  if (last.h > prev.h && last.l < prev.l) addPattern(found, 'OUTSIDE_BAR', ohlcv, 1, 'developing', visual)

  if (third) {
    const t = candle(third)
    if (t.bearish && Math.abs(prev.c - prev.o) / Math.max(prev.h - prev.l, 0.0001) < 0.35 && c.bullish && last.c > (third.o + third.c) / 2) addPattern(found, 'MORNING_STAR', ohlcv, 1, 'confirmed', visual)
    if (t.bullish && Math.abs(prev.c - prev.o) / Math.max(prev.h - prev.l, 0.0001) < 0.35 && c.bearish && last.c < (third.o + third.c) / 2) addPattern(found, 'EVENING_STAR', ohlcv, 1, 'confirmed', visual)
    if (t.bearish && p.bullish && c.bullish && prev.o > third.o && prev.c < third.o && last.c > third.o) addPattern(found, 'THREE_INSIDE_UP', ohlcv, 1, 'confirmed', visual)
    if (t.bullish && p.bearish && c.bearish && prev.o < third.o && prev.c > third.o && last.c < third.o) addPattern(found, 'THREE_INSIDE_DOWN', ohlcv, 1, 'confirmed', visual)
    if (t.bearish && p.bullish && c.bullish && prev.o <= third.c && prev.c >= third.o && last.c > prev.c) addPattern(found, 'THREE_OUTSIDE_UP', ohlcv, 1, 'confirmed', visual)
    if (t.bullish && p.bearish && c.bearish && prev.o >= third.c && prev.c <= third.o && last.c < prev.c) addPattern(found, 'THREE_OUTSIDE_DOWN', ohlcv, 1, 'confirmed', visual)
  }

  const last3 = ohlcv.slice(-3)
  if (last3.length === 3 && last3.every(bar => bar.c > bar.o) && last3[2].c > last3[1].c && last3[1].c > last3[0].c) addPattern(found, 'THREE_WHITE_SOLDIERS', ohlcv, 1, 'confirmed', visual)
  if (last3.length === 3 && last3.every(bar => bar.c < bar.o) && last3[2].c < last3[1].c && last3[1].c < last3[0].c) addPattern(found, 'THREE_BLACK_CROWS', ohlcv, 1, 'confirmed', visual)
}

/** Return only the best current Cup & Handle setup for efficient screeners. */
export function detectCupHandlePattern(ohlcv) {
  if (!Array.isArray(ohlcv) || ohlcv.length < 45) return null
  const found = []
  detectCupHandle(found, ohlcv)
  return found.find(pattern => pattern.key === 'CUP_HANDLE') ?? null
}

/**
 * Detects candlestick patterns on recent closed bars for chart markers.
 * The primary detector describes the latest setup; a marker layer must also
 * retain earlier signals or the chart appears empty as soon as a new bar opens.
 */
export function detectRecentCandlestickPatterns(ohlcv, lookback = 80) {
  if (!Array.isArray(ohlcv) || ohlcv.length < 3) return []

  const detected = new Map()
  const firstEndIndex = Math.max(2, ohlcv.length - Math.max(1, lookback))

  for (let endIndex = firstEndIndex; endIndex < ohlcv.length; endIndex += 1) {
    const found = []
    detectCandlesticks(found, ohlcv.slice(0, endIndex + 1))
    found
      .filter(pattern => pattern.category === 'Candlestick')
      .forEach(pattern => detected.set(`${pattern.key}:${endIndex}`, pattern))
  }

  return [...detected.values()].sort((a, b) => (
    (a.visual?.endIndex ?? 0) - (b.visual?.endIndex ?? 0) ||
    Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0)
  ))
}

export function detectPatterns(ohlcv, { includeMarkers = true } = {}) {
  const patterns = []
  if (!ohlcv || ohlcv.length < 25) return { patterns, markers: [], score: 0, best: null }

  detectFlagsPennants(patterns, ohlcv)
  detectDoubleTriple(patterns, ohlcv)
  detectTrianglesWedgesChannels(patterns, ohlcv)
  addPivotTrianglePatterns(patterns, ohlcv)
  detectRectangles(patterns, ohlcv)
  detectHeadShoulders(patterns, ohlcv)
  detectRoundedStructures(patterns, ohlcv)
  detectCupHandle(patterns, ohlcv)
  detectBreakoutsAndGaps(patterns, ohlcv)
  addTrendlineBreakPatterns(patterns, ohlcv)
  detectCandlesticks(patterns, ohlcv)

  const score = patterns.reduce((sum, pattern) => sum + pattern.weight, 0)
  const best = [...patterns].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0] ?? null
  const markers = includeMarkers ? detectRecentCandlestickPatterns(ohlcv) : []

  return { patterns, markers, score, best }
}
