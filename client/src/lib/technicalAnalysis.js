import { computeAll } from './indicators'
import { detectPatterns } from './patterns'
import { computeRisk } from './riskManagement'

const PATTERN_NAMES = {
  BULLISH_FLAG: 'Bull Flag',
  BEARISH_FLAG: 'Bear Flag',
  BULLISH_PENNANT: 'Bull Pennant',
  BEARISH_PENNANT: 'Bear Pennant',
  DOUBLE_BOTTOM: 'Double Bottom',
  DOUBLE_TOP: 'Double Top',
  TRIPLE_BOTTOM: 'Triple Bottom',
  TRIPLE_TOP: 'Triple Top',
  HEAD_SHOULDERS: 'Head and Shoulders',
  INVERSE_HEAD_SHOULDERS: 'Inverse Head and Shoulders',
  RISING_WEDGE: 'Rising Wedge',
  FALLING_WEDGE: 'Falling Wedge',
  ASCENDING_TRIANGLE: 'Ascending Triangle',
  DESCENDING_TRIANGLE: 'Descending Triangle',
  SYMMETRICAL_TRIANGLE: 'Symmetrical Triangle',
  EXPANDING_TRIANGLE: 'Expanding Triangle',
  RECTANGLE_BULLISH: 'Bullish Rectangle',
  RECTANGLE_BEARISH: 'Bearish Rectangle',
  CUP_HANDLE: 'Cup and Handle',
  INVERSE_CUP_HANDLE: 'Inverse Cup and Handle',
  ISLAND_REVERSAL_BULL: 'Bullish Island Reversal',
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function latest(values, index) {
  return values?.[index] ?? null
}

function normalizePrice(value) {
  return value >= 100 ? round(value, 2) : round(value, 3)
}

function uniqueRounded(values) {
  return [...new Set(values.filter(value => value != null).map(value => normalizePrice(value)))]
}

function aggregateBarsByMonth(bars) {
  if (!bars?.length) return []
  const grouped = new Map()

  bars.forEach(bar => {
    const date = new Date(bar.t)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...bar })
      return
    }

    existing.h = Math.max(existing.h, bar.h)
    existing.l = Math.min(existing.l, bar.l)
    existing.c = bar.c
    existing.v = (existing.v ?? 0) + (bar.v ?? 0)
    existing.t = bar.t
  })

  return [...grouped.values()]
}

function trendLabel(score) {
  if (score >= 65) return 'Bullish'
  if (score <= 40) return 'Bearish'
  return 'Neutral'
}

function momentumLabel(score) {
  if (score >= 62) return 'Bullish'
  if (score <= 38) return 'Bearish'
  return 'Neutral'
}

function computeSlope(values, lookback = 8) {
  const slice = values.filter(value => value != null).slice(-lookback)
  if (slice.length < 2) return 0
  return (slice[slice.length - 1] - slice[0]) / Math.max(Math.abs(slice[0]), 0.0001)
}

function findLocalLevels(ohlcv, key, comparator, window = 4) {
  const levels = []
  for (let index = window; index < ohlcv.length - window; index += 1) {
    const value = ohlcv[index][key]
    const neighbors = ohlcv.slice(index - window, index + window + 1).map(bar => bar[key])
    if (neighbors.every(other => comparator(value, other))) levels.push({ index, price: value })
  }
  return levels
}

function clusterLevels(levels, tolerancePct = 0.012) {
  const clusters = []
  levels.forEach(level => {
    const cluster = clusters.find(item => Math.abs(level.price - item.price) / item.price <= tolerancePct)
    if (cluster) {
      cluster.price = (cluster.price * cluster.hits + level.price) / (cluster.hits + 1)
      cluster.hits += 1
      cluster.index = Math.max(cluster.index, level.index)
    } else {
      clusters.push({ price: level.price, hits: 1, index: level.index })
    }
  })
  return clusters
}

function deriveSupportResistance(ohlcv, indicators) {
  const price = ohlcv.at(-1)?.c
  const supports = clusterLevels(findLocalLevels(ohlcv, 'l', (value, other) => value <= other))
    .filter(level => level.price <= price * 1.01)
    .sort((a, b) => (b.hits - a.hits) || (b.index - a.index))
    .slice(0, 4)
    .map(level => normalizePrice(level.price))
  const resistances = clusterLevels(findLocalLevels(ohlcv, 'h', (value, other) => value >= other))
    .filter(level => level.price >= price * 0.99)
    .sort((a, b) => (b.hits - a.hits) || (b.index - a.index))
    .slice(0, 4)
    .map(level => normalizePrice(level.price))

  const dynamicLevels = uniqueRounded([
    latest(indicators.sma20, ohlcv.length - 1),
    latest(indicators.sma50, ohlcv.length - 1),
    latest(indicators.sma100, ohlcv.length - 1),
    latest(indicators.sma200, ohlcv.length - 1),
    latest(indicators.ema20, ohlcv.length - 1),
    latest(indicators.ema50, ohlcv.length - 1),
    latest(indicators.ema200, ohlcv.length - 1),
  ])

  const recent = ohlcv.slice(-25)
  const breakoutLevel = recent.length ? Math.max(...recent.map(bar => bar.h)) : null
  const breakdownLevel = recent.length ? Math.min(...recent.map(bar => bar.l)) : null
  const stopLossZone = supports[0] != null ? normalizePrice(supports[0] * 0.985) : breakdownLevel != null ? normalizePrice(breakdownLevel * 0.99) : null

  return {
    support: supports,
    resistance: resistances,
    dynamicSupportResistance: dynamicLevels,
    breakoutZones: breakoutLevel != null ? [normalizePrice(breakoutLevel)] : [],
    breakdownZones: breakdownLevel != null ? [normalizePrice(breakdownLevel)] : [],
    stopLossDangerZones: stopLossZone != null ? [stopLossZone] : [],
  }
}

function deriveVolumeAnalysis(ohlcv, indicators, levels) {
  const lastIndex = ohlcv.length - 1
  const price = ohlcv[lastIndex]?.c
  const currentVolume = ohlcv[lastIndex]?.v ?? 0
  const averageVolume = latest(indicators.avgVol, lastIndex)
  const volumeRatio = latest(indicators.volRatio, lastIndex)
  const obvSlope = computeSlope(indicators.obv ?? [], 8)
  const currentVsAverage = volumeRatio == null
    ? 'Unknown'
    : volumeRatio >= 1.35
      ? 'Above average'
      : volumeRatio <= 0.75
        ? 'Below average'
        : 'Near average'

  const breakoutLevel = levels.breakoutZones?.[0]
  const breakdownLevel = levels.breakdownZones?.[0]
  const breakoutWithHighVolume = breakoutLevel != null && price > breakoutLevel && (volumeRatio ?? 0) >= 1.3
  const breakdownWithHighVolume = breakdownLevel != null && price < breakdownLevel && (volumeRatio ?? 0) >= 1.3
  const weakMoveWithLowVolume = Math.abs((ohlcv[lastIndex]?.c ?? 0) - (ohlcv[lastIndex]?.o ?? 0)) / Math.max(price, 0.01) > 0.01 && (volumeRatio ?? 0) < 0.85
  const volumeDivergence = (price > (ohlcv[lastIndex - 6]?.c ?? price) && obvSlope < 0) || (price < (ohlcv[lastIndex - 6]?.c ?? price) && obvSlope > 0)
  const accumulation = obvSlope > 0.02 && (volumeRatio ?? 0) >= 1
  const distribution = obvSlope < -0.02 && (volumeRatio ?? 0) >= 1

  const comment = breakoutWithHighVolume
    ? 'The latest breakout is supported by above-average participation.'
    : breakdownWithHighVolume
      ? 'The latest breakdown is confirmed by heavy volume.'
      : weakMoveWithLowVolume
        ? 'Price moved, but the move is not strongly confirmed by participation.'
        : accumulation
          ? 'OBV and volume suggest accumulation under the surface.'
          : distribution
            ? 'OBV and turnover suggest distribution pressure.'
            : 'Volume is not providing a strong confirmation signal right now.'

  return {
    currentVolume: round(currentVolume, 0),
    averageVolume: round(averageVolume, 0),
    currentVsAverage,
    confirmation: breakoutWithHighVolume || breakdownWithHighVolume || accumulation,
    breakoutWithHighVolume,
    breakdownWithHighVolume,
    weakMoveWithLowVolume,
    volumeDivergence,
    accumulation,
    distribution,
    obvSlope: round(obvSlope, 4),
    comment,
  }
}

function summarizePattern(pattern, bars, levels) {
  const lastPrice = bars.at(-1)?.c ?? 0
  const zoneLow = pattern.visual?.low ?? Math.min(...bars.slice(-12).map(bar => bar.l))
  const zoneHigh = pattern.visual?.high ?? Math.max(...bars.slice(-12).map(bar => bar.h))
  const direction = pattern.weight > 0 ? 'Bullish' : pattern.weight < 0 ? 'Bearish' : 'Neutral'
  const baseConfidence = clamp(55 + Math.abs(pattern.weight) * 0.4 + (pattern.status === 'confirmed' ? 12 : 0), 40, 96)
  const invalidatedBelow = direction === 'Bullish'
    ? levels.support?.[0] ?? normalizePrice(zoneLow * 0.985)
    : null
  const invalidatedAbove = direction === 'Bearish'
    ? levels.resistance?.[0] ?? normalizePrice(zoneHigh * 1.015)
    : null

  return {
    name: PATTERN_NAMES[pattern.key] ?? pattern.label,
    direction,
    confidence: Math.round(baseConfidence),
    priceZone: `${normalizePrice(zoneLow)}-${normalizePrice(zoneHigh)}`,
    explanation: `${pattern.label} is shaping between ${normalizePrice(zoneLow)} and ${normalizePrice(zoneHigh)} while price trades near ${normalizePrice(lastPrice)}.`,
    invalidatedBelow,
    invalidatedAbove,
    targetPrice: pattern.targetPrice != null ? normalizePrice(pattern.targetPrice) : null,
    status: pattern.status,
  }
}

function deriveAdditionalPatterns(ohlcv, indicators, levels, volumeAnalysis) {
  const patterns = []
  const lastIndex = ohlcv.length - 1
  const price = ohlcv[lastIndex].c
  const recent = ohlcv.slice(-20)
  const highSlope = computeSlope(recent.map(bar => bar.h), 12)
  const lowSlope = computeSlope(recent.map(bar => bar.l), 12)
  const recentRange = Math.max(...recent.map(bar => bar.h)) - Math.min(...recent.map(bar => bar.l))

  if (highSlope > 0.015 && lowSlope > 0.015) {
    patterns.push({
      name: 'Channel Up',
      direction: 'Bullish',
      confidence: 68,
      priceZone: `${normalizePrice(Math.min(...recent.map(bar => bar.l)))}-${normalizePrice(Math.max(...recent.map(bar => bar.h)))}`,
      explanation: 'Highs and lows are advancing together inside a rising channel.',
      invalidatedBelow: levels.support?.[0] ?? normalizePrice(price * 0.97),
    })
  }

  if (highSlope < -0.015 && lowSlope < -0.015) {
    patterns.push({
      name: 'Channel Down',
      direction: 'Bearish',
      confidence: 68,
      priceZone: `${normalizePrice(Math.min(...recent.map(bar => bar.l)))}-${normalizePrice(Math.max(...recent.map(bar => bar.h)))}`,
      explanation: 'Highs and lows are declining together inside a downward channel.',
      invalidatedAbove: levels.resistance?.[0] ?? normalizePrice(price * 1.03),
    })
  }

  if (levels.breakoutZones?.[0] != null && price > levels.breakoutZones[0]) {
    patterns.push({
      name: 'Breakout',
      direction: 'Bullish',
      confidence: volumeAnalysis.breakoutWithHighVolume ? 84 : 66,
      priceZone: `${levels.breakoutZones[0]}`,
      explanation: volumeAnalysis.breakoutWithHighVolume
        ? 'Price is trading above a recent breakout level with strong volume confirmation.'
        : 'Price is trading above a recent breakout level, but volume confirmation is only moderate.',
      invalidatedBelow: levels.support?.[0] ?? normalizePrice(levels.breakoutZones[0] * 0.985),
    })
  }

  if (levels.breakdownZones?.[0] != null && price < levels.breakdownZones[0]) {
    patterns.push({
      name: 'Breakdown',
      direction: 'Bearish',
      confidence: volumeAnalysis.breakdownWithHighVolume ? 84 : 66,
      priceZone: `${levels.breakdownZones[0]}`,
      explanation: volumeAnalysis.breakdownWithHighVolume
        ? 'Price is trading below a recent support shelf with heavy volume.'
        : 'Price slipped below support, though participation is not decisive yet.',
      invalidatedAbove: levels.resistance?.[0] ?? normalizePrice(levels.breakdownZones[0] * 1.015),
    })
  }

  for (let index = 1; index < ohlcv.length; index += 1) {
    const prev = ohlcv[index - 1]
    const bar = ohlcv[index]
    if (bar.l > prev.h * 1.002) {
      patterns.push({
        name: 'Gap Up',
        direction: 'Bullish',
        confidence: 72,
        priceZone: `${normalizePrice(prev.h)}-${normalizePrice(bar.l)}`,
        explanation: 'A bullish price gap opened above the prior session range.',
        invalidatedBelow: normalizePrice(prev.h),
      })
      break
    }
    if (bar.h < prev.l * 0.998) {
      patterns.push({
        name: 'Gap Down',
        direction: 'Bearish',
        confidence: 72,
        priceZone: `${normalizePrice(bar.h)}-${normalizePrice(prev.l)}`,
        explanation: 'A bearish gap opened below the prior session range.',
        invalidatedAbove: normalizePrice(prev.l),
      })
      break
    }
  }

  if (recentRange / Math.max(price, 0.01) < 0.05 && highSlope > 0.01 && lowSlope > 0.01 && volumeAnalysis.currentVsAverage === 'Above average') {
    patterns.push({
      name: 'Bull Flag',
      direction: 'Bullish',
      confidence: 67,
      priceZone: `${normalizePrice(Math.min(...recent.map(bar => bar.l)))}-${normalizePrice(Math.max(...recent.map(bar => bar.h)))}`,
      explanation: 'Price is consolidating in a tight upward-sloping flag with healthy participation.',
      invalidatedBelow: levels.support?.[0] ?? normalizePrice(price * 0.97),
    })
  }

  if (recentRange / Math.max(price, 0.01) < 0.05 && highSlope < -0.01 && lowSlope < -0.01 && volumeAnalysis.currentVsAverage === 'Above average') {
    patterns.push({
      name: 'Bear Flag',
      direction: 'Bearish',
      confidence: 67,
      priceZone: `${normalizePrice(Math.min(...recent.map(bar => bar.l)))}-${normalizePrice(Math.max(...recent.map(bar => bar.h)))}`,
      explanation: 'Price is consolidating in a tight downward-sloping flag after a weak move.',
      invalidatedAbove: levels.resistance?.[0] ?? normalizePrice(price * 1.03),
    })
  }

  return patterns
}

function scoreTimeframe(bars, indicators, levels, volumeAnalysis) {
  const index = bars.length - 1
  const price = bars[index].c
  const sma50 = latest(indicators.sma50, index)
  const sma200 = latest(indicators.sma200, index)
  const ema20 = latest(indicators.ema20, index)
  const ema50 = latest(indicators.ema50, index)
  const ema200 = latest(indicators.ema200, index)
  const rsi = latest(indicators.rsi14, index)
  const macdLine = latest(indicators.macd.line, index)
  const macdSignal = latest(indicators.macd.signal, index)
  const vwap = latest(indicators.vwap, index)
  const obvSlope = computeSlope(indicators.obv ?? [], 10)

  let trendScore = 50
  if (price > sma50) trendScore += 8
  if (price > sma200) trendScore += 14
  if (sma50 != null && sma200 != null && sma50 > sma200) trendScore += 12
  if (price > ema20) trendScore += 6
  if (price > ema50) trendScore += 5
  if (price > ema200) trendScore += 5
  if (vwap != null && price > vwap) trendScore += 4
  trendScore = clamp(trendScore, 10, 95)

  let momentumScore = 50
  if (rsi != null) {
    if (rsi >= 55 && rsi <= 68) momentumScore += 12
    else if (rsi > 70) momentumScore -= 6
    else if (rsi < 40) momentumScore -= 12
    else if (rsi >= 45) momentumScore += 4
  }
  if (macdLine != null && macdSignal != null) momentumScore += macdLine > macdSignal ? 10 : -10
  momentumScore += obvSlope > 0 ? 5 : obvSlope < 0 ? -5 : 0
  momentumScore = clamp(momentumScore, 10, 95)

  const breakoutLevel = levels.breakoutZones?.[0]
  const breakdownLevel = levels.breakdownZones?.[0]

  return {
    trend: trendLabel(trendScore),
    trendScore: Math.round(trendScore),
    momentum: momentumLabel(momentumScore),
    momentumScore: Math.round(momentumScore),
    support: levels.support.slice(0, 3),
    resistance: levels.resistance.slice(0, 3),
    breakoutZones: breakoutLevel != null ? [breakoutLevel] : [],
    breakdownZones: breakdownLevel != null ? [breakdownLevel] : [],
    dynamicLevels: levels.dynamicSupportResistance.slice(0, 5),
    volumeComment: volumeAnalysis.comment,
  }
}

function aggregateLevels(timeframes, side) {
  return uniqueRounded(Object.values(timeframes).flatMap(frame => frame?.[side] ?? [])).slice(0, 6)
}

function determineBiasFromFrames(timeframes) {
  const weights = { daily: 1.4, weekly: 1.2, monthly: 1.1, h4: 0.8 }
  const raw = Object.entries(timeframes).reduce((sum, [key, frame]) => {
    const biasValue = frame.trend === 'Bullish' ? 1 : frame.trend === 'Bearish' ? -1 : 0
    return sum + biasValue * (weights[key] ?? 1)
  }, 0)
  return raw > 0.75 ? 'Bullish' : raw < -0.75 ? 'Bearish' : 'Neutral'
}

export function computeTechnicalAnalysis(ticker, timeframeBars) {
  const dailyBars = timeframeBars.daily ?? []
  if (dailyBars.length < 30) return null

  const analyzedFrames = {}
  const frameIndicators = {}
  const framePatterns = {}

  Object.entries(timeframeBars).forEach(([key, bars]) => {
    if (!bars?.length || bars.length < 30) return
    const indicators = computeAll(bars)
    if (!indicators) return
    const levels = deriveSupportResistance(bars, indicators)
    const volumeAnalysis = deriveVolumeAnalysis(bars, indicators, levels)
    const basePatterns = detectPatterns(bars).patterns.map(pattern => summarizePattern(pattern, bars, levels))
    const extraPatterns = deriveAdditionalPatterns(bars, indicators, levels, volumeAnalysis)
    analyzedFrames[key] = scoreTimeframe(bars, indicators, levels, volumeAnalysis)
    frameIndicators[key] = indicators
    framePatterns[key] = [...basePatterns, ...extraPatterns]
  })

  const dailyIndicators = frameIndicators.daily
  const dailyLevels = deriveSupportResistance(dailyBars, dailyIndicators)
  const dailyVolume = deriveVolumeAnalysis(dailyBars, dailyIndicators, dailyLevels)
  const risk = computeRisk(dailyBars, dailyIndicators)
  const overallTechnicalBias = determineBiasFromFrames(analyzedFrames)
  const patterns = [...(framePatterns.daily ?? []), ...(framePatterns.weekly ?? []).slice(0, 2)]
    .filter((pattern, index, array) => array.findIndex(item => item.name === pattern.name && item.priceZone === pattern.priceZone) === index)
    .slice(0, 8)

  const trendScore = Math.round(Object.values(analyzedFrames).reduce((sum, frame) => sum + frame.trendScore, 0) / Object.keys(analyzedFrames).length)
  const momentumScore = Math.round(Object.values(analyzedFrames).reduce((sum, frame) => sum + frame.momentumScore, 0) / Object.keys(analyzedFrames).length)
  const volumeScore = Math.round(clamp(
    50 +
    (dailyVolume.confirmation ? 15 : 0) +
    (dailyVolume.currentVsAverage === 'Above average' ? 10 : dailyVolume.currentVsAverage === 'Below average' ? -8 : 0) +
    (dailyVolume.volumeDivergence ? -12 : 0) +
    (dailyVolume.accumulation ? 8 : 0) -
    (dailyVolume.distribution ? 8 : 0),
    20,
    95,
  ))
  const patternScore = Math.round(clamp(
    patterns.length
      ? patterns.reduce((sum, pattern) => sum + (pattern.confidence ?? 60), 0) / patterns.length
      : 50,
    30,
    95,
  ))
  const riskRewardScore = Math.round(clamp(
    risk?.rrRatio != null
      ? 45 + risk.rrRatio * 18 - (dailyLevels.resistance[0] && dailyBars.at(-1)?.c > dailyLevels.resistance[0] * 0.985 ? 6 : 0)
      : 55,
    25,
    92,
  ))
  const alignmentScore = overallTechnicalBias === 'Neutral' ? 55 : 76
  const technicalScore = Math.round(clamp(
    trendScore * 0.24 +
    momentumScore * 0.2 +
    volumeScore * 0.16 +
    patternScore * 0.18 +
    riskRewardScore * 0.12 +
    alignmentScore * 0.1,
    20,
    95,
  ))

  const primaryIndex = dailyBars.length - 1
  const rsi14 = latest(dailyIndicators.rsi14, primaryIndex)
  const macdSignal = latest(dailyIndicators.macd.line, primaryIndex) > latest(dailyIndicators.macd.signal, primaryIndex) ? 'Bullish' : 'Bearish'
  const priceVsSma200 = dailyBars.at(-1)?.c > latest(dailyIndicators.sma200, primaryIndex) ? 'Above' : 'Below'
  const keySupport = aggregateLevels(analyzedFrames, 'support')
  const keyResistance = aggregateLevels(analyzedFrames, 'resistance')
  const nearestResistance = keyResistance[0]
  const nearestSupport = keySupport[0]

  const riskLevel = technicalScore >= 75 && riskRewardScore >= 70 ? 'Low' : technicalScore >= 55 ? 'Medium' : 'High'
  const mainRisk = nearestResistance && dailyBars.at(-1)?.c >= nearestResistance * 0.985
    ? `Price is pressing into resistance near ${nearestResistance}, so failed breakout risk is elevated.`
    : rsi14 != null && rsi14 > 68
      ? 'RSI is moving toward an overbought condition, so upside may need stronger confirmation.'
      : 'Trend quality is mixed enough that support can fail if volume weakens.'

  const technicalSummary = `${ticker} is ${overallTechnicalBias.toLowerCase()} on the higher-timeframe stack${nearestResistance ? ` but approaching resistance near ${nearestResistance}` : ''}${nearestSupport ? ` while support sits around ${nearestSupport}` : ''}.`
  const finalTechnicalOutlook = overallTechnicalBias === 'Bullish'
    ? `Bullish while price holds above ${nearestSupport ?? normalizePrice(dailyBars.at(-1).c * 0.97)}. A confirmed move through ${nearestResistance ?? normalizePrice(dailyBars.at(-1).c * 1.03)} with strong volume would strengthen the setup.`
    : overallTechnicalBias === 'Bearish'
      ? `Bearish unless price reclaims ${nearestResistance ?? normalizePrice(dailyBars.at(-1).c * 1.03)}. A break below ${nearestSupport ?? normalizePrice(dailyBars.at(-1).c * 0.97)} keeps downside risk active.`
      : `Neutral for now. A breakout above ${nearestResistance ?? normalizePrice(dailyBars.at(-1).c * 1.03)} or breakdown below ${nearestSupport ?? normalizePrice(dailyBars.at(-1).c * 0.97)} should resolve the current range.`

  return {
    ticker,
    technicalSummary,
    overallTechnicalBias,
    technicalScore,
    trendScore,
    momentumScore,
    volumeScore,
    patternScore,
    riskRewardScore,
    timeframes: {
      daily: analyzedFrames.daily,
      weekly: analyzedFrames.weekly,
      monthly: analyzedFrames.monthly,
      h4: analyzedFrames.h4,
    },
    indicators: {
      sma20: normalizePrice(latest(dailyIndicators.sma20, primaryIndex)),
      sma50: normalizePrice(latest(dailyIndicators.sma50, primaryIndex)),
      sma100: normalizePrice(latest(dailyIndicators.sma100, primaryIndex)),
      sma200: normalizePrice(latest(dailyIndicators.sma200, primaryIndex)),
      ema20: normalizePrice(latest(dailyIndicators.ema20, primaryIndex)),
      ema50: normalizePrice(latest(dailyIndicators.ema50, primaryIndex)),
      ema200: normalizePrice(latest(dailyIndicators.ema200, primaryIndex)),
      rsi14: round(rsi14, 1),
      macdSignal,
      priceVsSma200,
      atr: round(latest(dailyIndicators.atr14, primaryIndex), 2),
      vwap: normalizePrice(latest(dailyIndicators.vwap, primaryIndex)),
      volumeMovingAverage: round(latest(dailyIndicators.avgVol, primaryIndex), 0),
      obv: round(latest(dailyIndicators.obv, primaryIndex), 0),
    },
    patterns,
    volumeAnalysis: dailyVolume,
    keyLevels: {
      support: keySupport,
      resistance: keyResistance,
      dynamicSupportResistance: dailyLevels.dynamicSupportResistance.slice(0, 6),
      breakoutLevels: dailyLevels.breakoutZones,
      stopLossDangerZones: dailyLevels.stopLossDangerZones,
    },
    riskAssessment: {
      riskLevel,
      mainRisk,
      stopLoss: risk?.stopLoss ?? null,
      takeProfit: risk?.takeProfit ?? null,
      rrRatio: risk?.rrRatio ?? null,
    },
    finalTechnicalOutlook,
    disclaimer: 'This technical analysis is for educational and informational purposes only. It is not financial advice or a trading recommendation.',
  }
}
