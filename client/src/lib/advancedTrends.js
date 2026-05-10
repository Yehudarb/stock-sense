function round(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function avg(values) {
  const clean = values.filter(value => value != null && Number.isFinite(value))
  if (!clean.length) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

function standardDeviation(values) {
  const mean = avg(values)
  if (mean == null) return null
  const variance = avg(values.map(value => (value - mean) ** 2))
  return variance == null ? null : Math.sqrt(variance)
}

function fitLine(points) {
  if (points.length < 2) return null
  const n = points.length
  const sumX = points.reduce((sum, point) => sum + point.index, 0)
  const sumY = points.reduce((sum, point) => sum + point.price, 0)
  const sumXY = points.reduce((sum, point) => sum + point.index * point.price, 0)
  const sumX2 = points.reduce((sum, point) => sum + point.index ** 2, 0)
  const denominator = n * sumX2 - sumX ** 2
  if (Math.abs(denominator) < 1e-10) return null
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  const meanY = sumY / n
  const ssRes = points.reduce((sum, point) => sum + (point.price - (slope * point.index + intercept)) ** 2, 0)
  const ssTot = points.reduce((sum, point) => sum + (point.price - meanY) ** 2, 0)
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot }
}

function priceAt(line, index) {
  return line.slope * index + line.intercept
}

function classifySlope(slope, price, flatThreshold = 0.0003) {
  const normalized = slope / Math.max(price, 0.0001)
  if (normalized > flatThreshold) return 'RISING'
  if (normalized < -flatThreshold) return 'FALLING'
  return 'FLAT'
}

function findPivots(ohlcv, field, type, strength = 5) {
  const pivots = []
  for (let index = strength; index < ohlcv.length - strength; index += 1) {
    const value = ohlcv[index][field]
    const neighbors = ohlcv.slice(index - strength, index + strength + 1).map(bar => bar[field])
    const extreme = type === 'high' ? Math.max(...neighbors) : Math.min(...neighbors)
    if (value === extreme) pivots.push({ index, price: value })
  }
  return pivots
}

function detectPriorTrend(ohlcv, patternStart, lookback = 30) {
  const start = Math.max(0, patternStart - lookback)
  const prices = ohlcv.slice(start, patternStart).map((bar, index) => ({ index, price: bar.c }))
  const line = fitLine(prices)
  if (!line) return 'UNKNOWN'
  if (line.slope > 0) return 'UP'
  if (line.slope < 0) return 'DOWN'
  return 'SIDEWAYS'
}

function checkBreakout(ohlcv, upperLine, lowerLine, tolerance = 0.02, lookback = 10) {
  const start = Math.max(0, ohlcv.length - lookback)
  for (let index = start; index < ohlcv.length; index += 1) {
    const close = ohlcv[index].c
    if (close > priceAt(upperLine, index) * (1 + tolerance * 0.5)) return 'breakout_up'
    if (close < priceAt(lowerLine, index) * (1 - tolerance * 0.5)) return 'breakout_down'
  }
  return 'developing'
}

function triangleKey(type) {
  return {
    ascending: 'ASCENDING_TRIANGLE',
    descending: 'DESCENDING_TRIANGLE',
    symmetrical: 'SYMMETRICAL_TRIANGLE',
    expanding: 'EXPANDING_TRIANGLE',
  }[type]
}

export function detectPivotTriangles(ohlcv, lookback = 200) {
  if (!ohlcv || ohlcv.length < 40) return []
  const start = Math.max(0, ohlcv.length - lookback)
  const pivotHighs = findPivots(ohlcv, 'h', 'high').filter(point => point.index >= start).slice(-4)
  const pivotLows = findPivots(ohlcv, 'l', 'low').filter(point => point.index >= start).slice(-4)
  if (pivotHighs.length < 2 || pivotLows.length < 2) return []

  const upperLine = fitLine(pivotHighs)
  const lowerLine = fitLine(pivotLows)
  if (!upperLine || !lowerLine || upperLine.r2 < 0.35 || lowerLine.r2 < 0.35) return []

  const currentIndex = ohlcv.length - 1
  const currentPrice = ohlcv[currentIndex].c
  const upperDirection = classifySlope(upperLine.slope, currentPrice)
  const lowerDirection = classifySlope(lowerLine.slope, currentPrice)
  const resistance = priceAt(upperLine, currentIndex)
  const support = priceAt(lowerLine, currentIndex)
  const patternStart = Math.min(pivotHighs[0].index, pivotLows[0].index)
  const upperStart = priceAt(upperLine, patternStart)
  const lowerStart = priceAt(lowerLine, patternStart)
  const baseHeight = Math.max(Math.abs(upperStart - lowerStart), currentPrice * 0.015)
  const status = checkBreakout(ohlcv, upperLine, lowerLine)
  const targetUp = resistance + baseHeight
  const targetDown = Math.max(0.01, support - baseHeight)
  const barsForming = currentIndex - patternStart
  const apexIndex = Math.abs(upperLine.slope - lowerLine.slope) > 1e-10
    ? (lowerLine.intercept - upperLine.intercept) / (upperLine.slope - lowerLine.slope)
    : null
  const barsToApex = apexIndex == null ? null : Math.round(apexIndex - currentIndex)
  const completionPct = barsToApex && barsToApex > 0
    ? Math.min(100, Math.round((barsForming / (barsForming + barsToApex)) * 100))
    : 50

  let type = null
  let direction = 'neutral'
  if (upperDirection === 'FLAT' && lowerDirection === 'RISING') {
    type = 'ascending'
    direction = 'bullish'
  } else if (upperDirection === 'FALLING' && lowerDirection === 'FLAT') {
    type = 'descending'
    direction = 'bearish'
  } else if (upperDirection === 'FALLING' && lowerDirection === 'RISING') {
    type = 'symmetrical'
    const priorTrend = detectPriorTrend(ohlcv, patternStart)
    direction = priorTrend === 'UP' ? 'bullish' : priorTrend === 'DOWN' ? 'bearish' : 'neutral'
  } else if (upperDirection === 'RISING' && lowerDirection === 'FALLING') {
    type = 'expanding'
  }
  if (!type) return []

  return [{
    key: triangleKey(type),
    type,
    direction,
    status,
    strength: completionPct >= 70 ? 3 : type === 'expanding' ? 1 : 2,
    resistance: round(resistance),
    support: round(support),
    targetUp: round(targetUp),
    targetDown: round(targetDown),
    baseHeight: round(baseHeight),
    completionPct,
    barsForming,
    barsToApex,
    visual: {
      startIndex: patternStart,
      endIndex: currentIndex,
      high: Math.max(...ohlcv.slice(patternStart, currentIndex + 1).map(bar => bar.h)),
      low: Math.min(...ohlcv.slice(patternStart, currentIndex + 1).map(bar => bar.l)),
      points: [...pivotHighs, ...pivotLows],
      lines: [
        { from: { index: patternStart, price: upperStart }, to: { index: currentIndex, price: resistance } },
        { from: { index: patternStart, price: lowerStart }, to: { index: currentIndex, price: support } },
      ],
    },
  }]
}

function detectDivergences(ohlcv, indicators, lookback = 50) {
  const rsi = indicators?.rsi14
  if (!rsi || ohlcv.length < Math.min(lookback, 25)) return { bullish: false, bearish: false, factors: [] }
  const recent = ohlcv.slice(-lookback)
  const recentRsi = rsi.slice(-lookback)
  const lastPrice = ohlcv.at(-1).c
  const priceMean5 = avg(ohlcv.slice(-5).map(bar => bar.c))
  const rsiMean5 = avg(recentRsi.slice(-5))
  const latestRsi = recentRsi.at(-1)
  const bullish = lastPrice < priceMean5 * 0.98 && latestRsi > rsiMean5
  const bearish = lastPrice > priceMean5 * 1.02 && latestRsi < rsiMean5
  return {
    bullish,
    bearish,
    swingLow: round(Math.min(...recent.map(bar => bar.c))),
    swingHigh: round(Math.max(...recent.map(bar => bar.c))),
    rsi: round(latestRsi, 1),
  }
}

function volumeProfile(ohlcv, priceBins = 10, lookback = 100) {
  const recent = ohlcv.slice(-lookback)
  if (recent.length < 20) return { levels: [], highVolumeLevels: [], conviction: false }
  const minPrice = Math.min(...recent.map(bar => bar.c))
  const maxPrice = Math.max(...recent.map(bar => bar.c))
  const step = (maxPrice - minPrice) / priceBins
  if (!step) return { levels: [], highVolumeLevels: [], conviction: false }
  const levels = Array.from({ length: priceBins }, (_, index) => {
    const from = minPrice + step * index
    const to = index === priceBins - 1 ? maxPrice : from + step
    const volume = recent.filter(bar => bar.c >= from && bar.c <= to).reduce((sum, bar) => sum + (bar.v ?? 0), 0)
    return { from: round(from), to: round(to), volume }
  })
  const maxVolume = Math.max(...levels.map(level => level.volume), 1)
  const highVolumeLevels = levels.filter(level => level.volume >= maxVolume * 0.7)
  return { levels, highVolumeLevels, conviction: highVolumeLevels.length > 0 }
}

function detectInstitutionalActivity(ohlcv) {
  if (ohlcv.length < 30) return { institutionalBuying: false, spikeCount: 0, consolidation: false }
  const recent = ohlcv.slice(-20)
  const avgVolume = avg(ohlcv.slice(-100).map(bar => bar.v)) ?? avg(ohlcv.map(bar => bar.v))
  const spikes = recent.filter((bar, index) => index > 0 && bar.v > avgVolume * 2 && bar.c > recent[index - 1].c)
  const last10 = recent.slice(-10)
  const meanClose = avg(last10.map(bar => bar.c))
  const volatility = meanClose ? standardDeviation(last10.map(bar => bar.c)) / meanClose : null
  const consolidation = volatility != null && volatility < 0.01 && avg(last10.map(bar => bar.v)) > avgVolume
  return {
    institutionalBuying: spikes.length > 2 || consolidation,
    spikeCount: spikes.length,
    consolidation,
    avgVolume: Math.round(avgVolume ?? 0),
    currentVolume: ohlcv.at(-1).v,
  }
}

function detectMarketRegime(ohlcv, indicators) {
  const last = ohlcv.length - 1
  const rsi = indicators?.rsi14?.[last]
  const atr = avg(ohlcv.slice(-14).map(bar => bar.h - bar.l))
  const price = ohlcv[last].c
  const atrPct = atr && price ? (atr / price) * 100 : null
  let regime = 'TRANSITIONAL'
  let strength = 'MEDIUM'
  if (rsi < 30 || rsi > 70) {
    regime = 'TRENDING'
    strength = 'STRONG'
  } else if (rsi > 40 && rsi < 60) {
    regime = 'RANGING'
    strength = 'NEUTRAL'
  }
  const riskLevel = regime === 'TRENDING' && atrPct > 2
    ? 'HIGH'
    : regime === 'RANGING' && atrPct < 0.5 ? 'LOW' : 'MEDIUM'
  return { regime, strength, riskLevel, volatilityPct: round(atrPct), rsi: round(rsi, 1) }
}

function scoreTriangle(triangle) {
  if (triangle.type === 'ascending') return triangle.status === 'breakout_up' ? 3 : 1.5
  if (triangle.type === 'descending') return triangle.status === 'breakout_down' ? -3 : -1
  if (triangle.type === 'symmetrical') {
    if (triangle.status === 'breakout_up') return 2
    if (triangle.status === 'breakout_down') return -2
    return triangle.direction === 'bullish' ? 1 : triangle.direction === 'bearish' ? -1 : 0
  }
  return 0
}

export function analyzeAdvancedTrends(ohlcv, indicators) {
  if (!ohlcv?.length || !indicators) return null
  const triangles = detectPivotTriangles(ohlcv)
  const divergence = detectDivergences(ohlcv, indicators)
  const volume = volumeProfile(ohlcv)
  const institutional = detectInstitutionalActivity(ohlcv)
  const regime = detectMarketRegime(ohlcv, indicators)
  const score = round(
    triangles.reduce((sum, triangle) => sum + scoreTriangle(triangle), 0) +
    (divergence.bullish ? 1.5 : 0) -
    (divergence.bearish ? 1.5 : 0) +
    (institutional.institutionalBuying ? 1.5 : 0) +
    (volume.conviction ? 0.5 : 0),
    1
  )
  return { score, triangles, divergence, volume, institutional, regime }
}
