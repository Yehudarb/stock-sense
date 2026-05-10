const PATTERN_DEFS = {
  BULLISH_FLAG: { label: 'דגל שורי', weight: 75, direction: 'bullish', targetFactor: 1.0 },
  BEARISH_FLAG: { label: 'דגל דובי', weight: -75, direction: 'bearish', targetFactor: 1.0 },
  BULLISH_PENNANT: { label: 'דגלון שורי', weight: 72, direction: 'bullish', targetFactor: 0.85 },
  BEARISH_PENNANT: { label: 'דגלון דובי', weight: -72, direction: 'bearish', targetFactor: 0.85 },
  DOUBLE_BOTTOM: { label: 'תחתית כפולה', weight: 70, direction: 'bullish', targetFactor: 0.75 },
  DOUBLE_TOP: { label: 'תקרה כפולה', weight: -70, direction: 'bearish', targetFactor: 0.75 },
  TRIPLE_BOTTOM: { label: 'תחתית משולשת', weight: 78, direction: 'bullish', targetFactor: 0.8 },
  TRIPLE_TOP: { label: 'תקרה משולשת', weight: -78, direction: 'bearish', targetFactor: 0.8 },
  HEAD_SHOULDERS: { label: 'ראש וכתפיים', weight: -73, direction: 'bearish', targetFactor: 1.0 },
  INVERSE_HEAD_SHOULDERS: { label: 'ראש וכתפיים הפוכים', weight: 73, direction: 'bullish', targetFactor: 1.0 },
  RISING_WEDGE: { label: 'טריז עולה', weight: -70, direction: 'bearish', targetFactor: 0.85 },
  FALLING_WEDGE: { label: 'טריז נופל', weight: 70, direction: 'bullish', targetFactor: 0.85 },
  ASCENDING_TRIANGLE: { label: 'משולש עולה', weight: 75, direction: 'bullish', targetFactor: 0.8 },
  DESCENDING_TRIANGLE: { label: 'משולש יורד', weight: -75, direction: 'bearish', targetFactor: 0.8 },
  SYMMETRICAL_TRIANGLE: { label: 'משולש סימטרי', weight: 35, direction: 'neutral', targetFactor: 0.65 },
  RECTANGLE_BULLISH: { label: 'מלבן שורי', weight: 62, direction: 'bullish', targetFactor: 0.7 },
  RECTANGLE_BEARISH: { label: 'מלבן דובי', weight: -62, direction: 'bearish', targetFactor: 0.7 },
  CUP_HANDLE: { label: 'כוס וידית', weight: 82, direction: 'bullish', targetFactor: 0.9 },
  INVERSE_CUP_HANDLE: { label: 'כוס וידית הפוכים', weight: -82, direction: 'bearish', targetFactor: 0.9 },
  ISLAND_REVERSAL_BULL: { label: 'אי היפוך שורי', weight: 73, direction: 'bullish', targetFactor: 0.6 },
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
  return (values[values.length - 1] - values[0]) / values[0]
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

function addPattern(found, key, ohlcv, strength = 1, status = 'developing', visual = null) {
  if (found.some(pattern => pattern.key === key)) return
  const def = PATTERN_DEFS[key]
  const current = ohlcv[ohlcv.length - 1].c
  const targetPrice = estimateTarget(key, ohlcv)
  const fallbackVisual = buildVisual(ohlcv, Math.max(0, ohlcv.length - 30), ohlcv.length - 1)
  found.push({
    key,
    label: def.label,
    weight: Math.round(def.weight * strength),
    direction: def.direction,
    status,
    targetPrice: Number(targetPrice.toFixed(targetPrice >= 100 ? 2 : 3)),
    potentialPct: Number((((targetPrice - current) / current) * 100).toFixed(2)),
    visual: visual ?? fallbackVisual,
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
    addPattern(found, 'DOUBLE_TOP', ohlcv, 1, 'confirmed', buildVisual(ohlcv, peaks[0].index, peaks[1].index, peaks, [
      { from: peaks[0], to: peaks[1] },
    ]))
  }
  if (low3.length >= 2 && Math.abs(low3[0].index - low3[1].index) >= 5 && similarLevels(low3.slice(0, 2).map(item => item.value))) {
    const troughs = low3.slice(0, 2).map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'DOUBLE_BOTTOM', ohlcv, 1, 'confirmed', buildVisual(ohlcv, troughs[0].index, troughs[1].index, troughs, [
      { from: troughs[0], to: troughs[1] },
    ]))
  }
  if (top3.length === 3 && similarLevels(top3.map(item => item.value), 0.03) && top3[2].index - top3[0].index >= 10) {
    const peaks = top3.map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'TRIPLE_TOP', ohlcv, 1.05, 'confirmed', buildVisual(ohlcv, peaks[0].index, peaks[2].index, peaks, [
      { from: peaks[0], to: peaks[2] },
    ]))
  }
  if (low3.length === 3 && similarLevels(low3.map(item => item.value), 0.03) && low3[2].index - low3[0].index >= 10) {
    const troughs = low3.map(item => ({ index: offset + item.index, price: item.value }))
    addPattern(found, 'TRIPLE_BOTTOM', ohlcv, 1.05, 'confirmed', buildVisual(ohlcv, troughs[0].index, troughs[2].index, troughs, [
      { from: troughs[0], to: troughs[2] },
    ]))
  }
}

function detectFlagsPennants(found, ohlcv) {
  const last12 = ohlcv.slice(-12)
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

function detectTrianglesAndWedges(found, ohlcv) {
  const last16 = ohlcv.slice(-16)
  const offset = ohlcv.length - last16.length
  const highs = last16.map(bar => bar.h)
  const lows = last16.map(bar => bar.l)
  const highSlope = slope(highs)
  const lowSlope = slope(lows)
  const start = offset
  const end = ohlcv.length - 1
  const highLine = {
    from: { index: start, price: highs[0] },
    to: { index: end, price: highs[highs.length - 1] },
  }
  const lowLine = {
    from: { index: start, price: lows[0] },
    to: { index: end, price: lows[lows.length - 1] },
  }
  const visual = buildVisual(ohlcv, start, end, [], [highLine, lowLine])

  if (isFlat(highs, 0.018) && lowSlope > 0.006) addPattern(found, 'ASCENDING_TRIANGLE', ohlcv, 1, 'developing', visual)
  if (isFlat(lows, 0.018) && highSlope < -0.006) addPattern(found, 'DESCENDING_TRIANGLE', ohlcv, 1, 'developing', visual)
  if (highSlope < -0.006 && lowSlope > 0.006) addPattern(found, 'SYMMETRICAL_TRIANGLE', ohlcv, 0.8, 'developing', visual)
  if (highSlope > 0.006 && lowSlope > 0.006 && lowSlope > highSlope + 0.004) addPattern(found, 'RISING_WEDGE', ohlcv, 1, 'developing', visual)
  if (highSlope < -0.006 && lowSlope < -0.006 && Math.abs(highSlope) > Math.abs(lowSlope) + 0.004) addPattern(found, 'FALLING_WEDGE', ohlcv, 1, 'developing', visual)
}

function detectRectangles(found, ohlcv) {
  const last18 = ohlcv.slice(-18)
  const offset = ohlcv.length - last18.length
  const highs = last18.map(bar => bar.h)
  const lows = last18.map(bar => bar.l)
  const width = (Math.max(...highs) - Math.min(...lows)) / avg(last18.map(bar => bar.c))
  const current = ohlcv[ohlcv.length - 1].c
  const previous = ohlcv[ohlcv.length - 18].c

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
    addPattern(found, 'HEAD_SHOULDERS', ohlcv, 1, 'confirmed', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
    ]))
  }
  if (headLow < leftLow * 0.975 && headLow < rightLow * 0.975 && Math.abs(leftLow - rightLow) / leftLow < 0.06) {
    const points = [
      { index: offset + localExtremeIndex(lows.slice(0, 10), 'low'), price: leftLow },
      { index: offset + 10 + localExtremeIndex(lows.slice(10, 20), 'low'), price: headLow },
      { index: offset + 20 + localExtremeIndex(lows.slice(20), 'low'), price: rightLow },
    ]
    addPattern(found, 'INVERSE_HEAD_SHOULDERS', ohlcv, 1, 'confirmed', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
    ]))
  }
}

function detectCupHandle(found, ohlcv) {
  const last40 = ohlcv.slice(-40)
  if (last40.length < 35) return
  const offset = ohlcv.length - last40.length
  const left = last40.slice(0, 12)
  const middle = last40.slice(12, 28)
  const handle = last40.slice(28)
  const leftRim = rangeHigh(left)
  const cupLow = rangeLow(middle)
  const rightRim = rangeHigh(last40.slice(22, 32))
  const handleLow = rangeLow(handle)
  const cupDepth = (leftRim - cupLow) / leftRim
  const rimAligned = Math.abs(leftRim - rightRim) / leftRim < 0.045
  const handleHealthy = handleLow > cupLow * 1.04 && handleLow < rightRim * 0.99

  if (cupDepth > 0.06 && cupDepth < 0.35 && rimAligned && handleHealthy) {
    const points = [
      { index: offset + localExtremeIndex(left.map(bar => bar.h), 'high'), price: leftRim },
      { index: offset + 12 + localExtremeIndex(middle.map(bar => bar.l), 'low'), price: cupLow },
      { index: offset + 22 + localExtremeIndex(last40.slice(22, 32).map(bar => bar.h), 'high'), price: rightRim },
      { index: offset + 28 + localExtremeIndex(handle.map(bar => bar.l), 'low'), price: handleLow },
    ]
    addPattern(found, 'CUP_HANDLE', ohlcv, 1.1, 'developing', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
      { from: points[2], to: points[3] },
    ]))
  }

  const leftFloor = rangeLow(left)
  const cupHigh = rangeHigh(middle)
  const rightFloor = rangeLow(last40.slice(22, 32))
  const handleHigh = rangeHigh(handle)
  const inverseDepth = (cupHigh - leftFloor) / leftFloor
  const floorAligned = Math.abs(leftFloor - rightFloor) / leftFloor < 0.045
  const inverseHandle = handleHigh < cupHigh * 0.96 && handleHigh > rightFloor * 1.01

  if (inverseDepth > 0.06 && inverseDepth < 0.35 && floorAligned && inverseHandle) {
    const points = [
      { index: offset + localExtremeIndex(left.map(bar => bar.l), 'low'), price: leftFloor },
      { index: offset + 12 + localExtremeIndex(middle.map(bar => bar.h), 'high'), price: cupHigh },
      { index: offset + 22 + localExtremeIndex(last40.slice(22, 32).map(bar => bar.l), 'low'), price: rightFloor },
      { index: offset + 28 + localExtremeIndex(handle.map(bar => bar.h), 'high'), price: handleHigh },
    ]
    addPattern(found, 'INVERSE_CUP_HANDLE', ohlcv, 1.1, 'developing', buildVisual(ohlcv, offset, ohlcv.length - 1, points, [
      { from: points[0], to: points[1] },
      { from: points[1], to: points[2] },
      { from: points[2], to: points[3] },
    ]))
  }
}

function detectIslandReversal(found, ohlcv) {
  const n = ohlcv.length
  if (n < 3) return
  const gapDown = ohlcv[n - 3].l > ohlcv[n - 2].h
  const gapUp = ohlcv[n - 2].h < ohlcv[n - 1].l
  if (gapDown && gapUp && pctChange(ohlcv[n - 3].c, ohlcv[n - 1].c) > 0.03) {
    addPattern(found, 'ISLAND_REVERSAL_BULL', ohlcv, 1, 'confirmed', buildVisual(ohlcv, n - 3, n - 1, [
      { index: n - 3, price: ohlcv[n - 3].c },
      { index: n - 2, price: ohlcv[n - 2].c },
      { index: n - 1, price: ohlcv[n - 1].c },
    ], [
      { from: { index: n - 3, price: ohlcv[n - 3].c }, to: { index: n - 1, price: ohlcv[n - 1].c } },
    ]))
  }
}

export function detectPatterns(ohlcv) {
  const patterns = []
  if (!ohlcv || ohlcv.length < 25) return { patterns, score: 0, best: null }

  detectFlagsPennants(patterns, ohlcv)
  detectDoubleTriple(patterns, ohlcv)
  detectTrianglesAndWedges(patterns, ohlcv)
  detectRectangles(patterns, ohlcv)
  detectHeadShoulders(patterns, ohlcv)
  detectCupHandle(patterns, ohlcv)
  detectIslandReversal(patterns, ohlcv)

  const score = patterns.reduce((sum, pattern) => sum + pattern.weight, 0)
  const best = [...patterns].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0] ?? null

  return { patterns, score, best }
}
