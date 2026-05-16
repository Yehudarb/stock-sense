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
  ROUNDED_BOTTOM: 'Rounded Bottom',
  ROUNDED_TOP: 'Rounded Top',
  CHANNEL_UP: 'Channel Up',
  CHANNEL_DOWN: 'Channel Down',
  RESISTANCE_BREAKOUT: 'Resistance Breakout',
  SUPPORT_BREAKDOWN: 'Support Breakdown',
  GAP_UP: 'Gap Up',
  GAP_DOWN: 'Gap Down',
  BREAKAWAY_GAP: 'Breakaway Gap',
  EXHAUSTION_GAP: 'Exhaustion Gap',
  VOLUME_BREAKOUT: 'Volume Breakout',
  FAILED_BREAKOUT: 'Failed Breakout',
  RETEST_AFTER_BREAKOUT: 'Retest After Breakout',
  HAMMER: 'Hammer',
  INVERTED_HAMMER: 'Inverted Hammer',
  SHOOTING_STAR: 'Shooting Star',
  DOJI: 'Doji',
  DRAGONFLY_DOJI: 'Dragonfly Doji',
  GRAVESTONE_DOJI: 'Gravestone Doji',
  BULLISH_ENGULFING: 'Bullish Engulfing',
  BEARISH_ENGULFING: 'Bearish Engulfing',
  MORNING_STAR: 'Morning Star',
  EVENING_STAR: 'Evening Star',
  THREE_WHITE_SOLDIERS: 'Three White Soldiers',
  THREE_BLACK_CROWS: 'Three Black Crows',
  PIERCING_PATTERN: 'Piercing Pattern',
  DARK_CLOUD_COVER: 'Dark Cloud Cover',
  INSIDE_BAR: 'Inside Bar',
  OUTSIDE_BAR: 'Outside Bar',
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

function formatDollar(value) {
  const normalized = normalizePrice(value)
  return normalized == null ? null : `$${normalized}`
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
    latest(indicators.wma20, ohlcv.length - 1),
    latest(indicators.supertrend?.line, ohlcv.length - 1),
    indicators.pivotPoints?.pivot,
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
    pivotPoints: indicators.pivotPoints,
    previousHighLow: indicators.priceLevels,
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

function detectGapEvents(ohlcv) {
  const events = []

  for (let index = 1; index < ohlcv.length; index += 1) {
    const prev = ohlcv[index - 1]
    const bar = ohlcv[index]
    const subsequent = ohlcv.slice(index + 1)

    if (bar.l > prev.h * 1.002) {
      const zoneLow = prev.h
      const zoneHigh = bar.l
      const gapSize = Math.max(zoneHigh - zoneLow, 0)
      const lowestAfter = subsequent.length ? Math.min(...subsequent.map(item => item.l)) : bar.l
      const fillPct = gapSize > 0
        ? clamp(((zoneHigh - lowestAfter) / gapSize) * 100, 0, 100)
        : 0
      const status = lowestAfter <= zoneLow ? 'closed' : lowestAfter < zoneHigh ? 'partial' : 'open'

      events.push({
        direction: 'Bullish',
        type: 'Gap Up',
        zoneLow: normalizePrice(zoneLow),
        zoneHigh: normalizePrice(zoneHigh),
        sizePct: round((gapSize / Math.max(zoneLow, 0.01)) * 100, 2),
        status,
        fillPct: round(fillPct, 0),
        index,
      })
      continue
    }

    if (bar.h < prev.l * 0.998) {
      const zoneLow = bar.h
      const zoneHigh = prev.l
      const gapSize = Math.max(zoneHigh - zoneLow, 0)
      const highestAfter = subsequent.length ? Math.max(...subsequent.map(item => item.h)) : bar.h
      const fillPct = gapSize > 0
        ? clamp(((highestAfter - zoneLow) / gapSize) * 100, 0, 100)
        : 0
      const status = highestAfter >= zoneHigh ? 'closed' : highestAfter > zoneLow ? 'partial' : 'open'

      events.push({
        direction: 'Bearish',
        type: 'Gap Down',
        zoneLow: normalizePrice(zoneLow),
        zoneHigh: normalizePrice(zoneHigh),
        sizePct: round((gapSize / Math.max(zoneHigh, 0.01)) * 100, 2),
        status,
        fillPct: round(fillPct, 0),
        index,
      })
    }
  }

  return events
}

function deriveGapContext(ohlcv, overallTechnicalBias) {
  const price = ohlcv.at(-1)?.c ?? null
  const gapEvents = detectGapEvents(ohlcv)
  if (!gapEvents.length || price == null) {
    return {
      latestGap: null,
      nearestOpenGap: null,
      alignment: 'None',
      signal: 'Neutral',
      comment: 'No notable unfilled gap is shaping the current technical picture.',
    }
  }

  const openGaps = gapEvents.filter(gap => gap.status !== 'closed')
  const nearestOpenGap = openGaps.length
    ? [...openGaps].sort((a, b) => {
      const distanceA = Math.min(Math.abs(price - a.zoneLow), Math.abs(price - a.zoneHigh))
      const distanceB = Math.min(Math.abs(price - b.zoneLow), Math.abs(price - b.zoneHigh))
      return distanceA - distanceB
    })[0]
    : null
  const latestGap = gapEvents.at(-1)
  const focusGap = nearestOpenGap ?? latestGap
  const gapBias = focusGap.direction

  const alignment = overallTechnicalBias === 'Neutral'
    ? 'Mixed'
    : overallTechnicalBias === gapBias
      ? 'With trend'
      : 'Against trend'

  const signal = gapBias === 'Bullish'
    ? alignment === 'With trend'
      ? 'Bullish'
      : alignment === 'Against trend'
        ? 'Caution'
        : 'Mixed'
    : alignment === 'With trend'
      ? 'Bearish'
      : alignment === 'Against trend'
        ? 'Rebound watch'
        : 'Mixed'

  const comment = focusGap.direction === 'Bullish'
    ? alignment === 'With trend'
      ? `An open gap-up between ${formatDollar(focusGap.zoneLow)} and ${formatDollar(focusGap.zoneHigh)} is still supporting the prevailing uptrend.`
      : `A bullish gap-up between ${formatDollar(focusGap.zoneLow)} and ${formatDollar(focusGap.zoneHigh)} is pushing against the broader bias, so follow-through matters.`
    : alignment === 'With trend'
      ? `An open gap-down between ${formatDollar(focusGap.zoneLow)} and ${formatDollar(focusGap.zoneHigh)} is reinforcing the prevailing downside pressure.`
      : `A bearish gap-down between ${formatDollar(focusGap.zoneLow)} and ${formatDollar(focusGap.zoneHigh)} is counter to the broader bias, so failed continuation is possible.`

  return {
    latestGap,
    nearestOpenGap,
    alignment,
    signal,
    comment,
  }
}

function deriveVwapContext(indicators, bars, index, overallTechnicalBias) {
  const price = bars[index]?.c ?? null
  const vwap = latest(indicators.vwap, index)
  if (price == null || vwap == null) {
    return {
      position: 'Unknown',
      signal: 'Neutral',
      slope: 'Flat',
      distancePct: null,
      trendAgreement: 'Unknown',
      comment: 'VWAP context is unavailable for the current dataset.',
    }
  }

  const distancePct = ((price - vwap) / Math.max(vwap, 0.01)) * 100
  const vwapSlope = computeSlope(indicators.vwap ?? [], 8)
  const slope = vwapSlope > 0.02 ? 'Rising' : vwapSlope < -0.02 ? 'Falling' : 'Flat'
  const position = distancePct > 0.2 ? 'Above' : distancePct < -0.2 ? 'Below' : 'At VWAP'
  const trendAgreement = overallTechnicalBias === 'Neutral'
    ? 'Mixed'
    : (overallTechnicalBias === 'Bullish' && position === 'Above') || (overallTechnicalBias === 'Bearish' && position === 'Below')
      ? 'Aligned'
      : 'Diverging'
  const signal = position === 'Above' && slope === 'Rising'
    ? 'Bullish'
    : position === 'Below' && slope === 'Falling'
      ? 'Bearish'
      : position === 'Above'
        ? 'Support test'
        : position === 'Below'
          ? 'Pressure'
          : 'Balanced'

  const comment = position === 'Above' && slope === 'Rising'
    ? 'Price is holding above a rising VWAP, which supports the current move.'
    : position === 'Below' && slope === 'Falling'
      ? 'Price is trading below a falling VWAP, which keeps downside pressure intact.'
      : position === 'Above'
        ? 'Price is above VWAP, but the slope is not fully confirming the move yet.'
        : position === 'Below'
          ? 'Price is below VWAP, so rallies may still face resistance unless VWAP is reclaimed.'
          : 'Price is trading near VWAP, suggesting a balanced or transitional session structure.'

  return {
    position,
    signal,
    slope,
    distancePct: round(distancePct, 2),
    trendAgreement,
    comment,
  }
}

function summarizePattern(pattern, bars, levels, timeframe = '1D', volumeAnalysis = {}) {
  const lastPrice = bars.at(-1)?.c ?? 0
  const zoneLow = pattern.visual?.low ?? Math.min(...bars.slice(-12).map(bar => bar.l))
  const zoneHigh = pattern.visual?.high ?? Math.max(...bars.slice(-12).map(bar => bar.h))
  const direction = pattern.weight > 0 ? 'Bullish' : pattern.weight < 0 ? 'Bearish' : 'Neutral'
  const baseConfidence = clamp(55 + Math.abs(pattern.weight) * 0.4 + (pattern.status === 'confirmed' ? 12 : 0), 40, 96)
  const breakoutLevel = pattern.meta?.breakoutLevel
    ?? (direction === 'Bullish' ? levels.resistance?.[0] : direction === 'Bearish' ? levels.support?.[0] : null)
  const invalidationLevel = pattern.meta?.invalidationLevel
    ?? (direction === 'Bullish'
      ? levels.support?.[0] ?? normalizePrice(zoneLow * 0.985)
      : direction === 'Bearish'
        ? levels.resistance?.[0] ?? normalizePrice(zoneHigh * 1.015)
        : null)
  const invalidatedBelow = direction === 'Bullish'
    ? invalidationLevel
    : null
  const invalidatedAbove = direction === 'Bearish'
    ? invalidationLevel
    : null
  const volumeConfirmed = pattern.meta?.volumeConfirmed ?? (
    direction === 'Bullish'
      ? volumeAnalysis.breakoutWithHighVolume || volumeAnalysis.accumulation
      : direction === 'Bearish'
        ? volumeAnalysis.breakdownWithHighVolume || volumeAnalysis.distribution
        : false
  )

  return {
    name: PATTERN_NAMES[pattern.key] ?? pattern.label,
    category: pattern.category ?? 'Pattern',
    direction,
    confidence: Math.round(baseConfidence),
    timeframe,
    priceZone: `${formatDollar(zoneLow)} - ${formatDollar(zoneHigh)}`,
    breakoutLevel: breakoutLevel != null ? normalizePrice(breakoutLevel) : null,
    invalidationLevel: invalidationLevel != null ? normalizePrice(invalidationLevel) : null,
    volumeConfirmed,
    status: pattern.status === 'confirmed'
      ? 'Confirmed'
      : pattern.status === 'near breakout' || pattern.status === 'near breakdown'
        ? pattern.status
        : 'Developing',
    explanation: `${PATTERN_NAMES[pattern.key] ?? pattern.label} is shaping between ${formatDollar(zoneLow)} and ${formatDollar(zoneHigh)} while price trades near ${formatDollar(lastPrice)}.`,
    invalidatedBelow,
    invalidatedAbove,
    targetPrice: pattern.targetPrice != null ? normalizePrice(pattern.targetPrice) : null,
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

  return patterns.map(pattern => {
    const invalidationLevel = pattern.invalidatedBelow ?? pattern.invalidatedAbove ?? null
    const category = pattern.name.includes('Breakout') || pattern.name.includes('Breakdown') || pattern.name.includes('Gap')
      ? 'Breakout / Breakdown'
      : pattern.name.includes('Flag') || pattern.name.includes('Channel')
        ? 'Continuation'
        : 'Pattern'

    return {
      category,
      timeframe: 'Daily',
      breakoutLevel: pattern.breakoutLevel ?? levels.breakoutZones?.[0] ?? null,
      invalidationLevel,
      volumeConfirmed: volumeAnalysis.confirmation,
      status: pattern.status ?? (category === 'Breakout / Breakdown' ? 'Near breakout' : 'Developing'),
      ...pattern,
      priceZone: pattern.priceZone?.includes('$')
        ? pattern.priceZone
        : pattern.priceZone?.split('-').map(value => `$${value.trim()}`).join(' - '),
    }
  })
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

function buildIndicatorInterpretations(indicators, bars, index) {
  const price = bars[index]?.c
  const rsi = latest(indicators.rsi14, index)
  const macdLine = latest(indicators.macd.line, index)
  const macdSignal = latest(indicators.macd.signal, index)
  const adx = latest(indicators.adx?.adx, index)
  const pdi = latest(indicators.adx?.pdi, index)
  const mdi = latest(indicators.adx?.mdi, index)
  const atr = latest(indicators.atr14, index)
  const bbUpper = latest(indicators.bb20?.upper, index)
  const bbLower = latest(indicators.bb20?.lower, index)
  const bbWidth = latest(indicators.bb20?.width, index)
  const percentB = latest(indicators.bb20?.percentB, index)
  const stochRsi = latest(indicators.stochRsi?.k, index)
  const obvSlope = computeSlope(indicators.obv ?? [], 10)
  const supertrendDirection = latest(indicators.supertrend?.direction, index)
  const supertrendLine = latest(indicators.supertrend?.line, index)
  const mfi = latest(indicators.mfi14, index)
  const cmf = latest(indicators.cmf20, index)
  const atrPct = price && atr != null ? (atr / price) * 100 : null
  const vwap = latest(indicators.vwap, index)
  const vwapSlope = computeSlope(indicators.vwap ?? [], 8)
  const vwapDistancePct = price && vwap != null ? ((price - vwap) / Math.max(vwap, 0.01)) * 100 : null

  const items = []
  if (rsi != null) items.push({ label: 'RSI 14', value: round(rsi, 1), interpretation: rsi >= 70 ? 'Overbought risk' : rsi <= 30 ? 'Oversold rebound zone' : rsi >= 55 ? 'Positive momentum' : rsi <= 45 ? 'Soft momentum' : 'Balanced momentum', tone: rsi >= 70 ? 'warning' : rsi <= 30 ? 'positive' : 'balanced' })
  if (macdLine != null && macdSignal != null) items.push({ label: 'MACD', value: macdLine > macdSignal ? 'Bullish' : 'Bearish', interpretation: macdLine > macdSignal ? 'MACD line is above signal' : 'MACD line is below signal', tone: macdLine > macdSignal ? 'positive' : 'danger' })
  if (adx != null) items.push({ label: 'ADX', value: round(adx, 1), interpretation: adx < 20 ? 'Weak / no clear trend' : adx < 25 ? 'Developing trend' : `Strong trend, ${pdi > mdi ? '+DI leads' : '-DI leads'}`, tone: adx >= 25 ? 'positive' : adx >= 20 ? 'warning' : 'balanced' })
  if (bbUpper != null && bbLower != null) items.push({ label: 'Bollinger Bands', value: percentB != null ? `${round(percentB * 100, 0)}%B` : '-', interpretation: percentB >= 0.9 ? 'Price near upper band' : percentB <= 0.1 ? 'Price near lower band' : bbWidth != null && bbWidth < 0.06 ? 'Squeeze detected' : bbWidth != null && bbWidth > 0.16 ? 'Volatility expansion' : 'Inside normal band range', tone: percentB >= 0.9 || percentB <= 0.1 ? 'warning' : 'balanced' })
  if (atr != null) items.push({ label: 'ATR 14', value: `${round(atr, 2)} (${round(atrPct, 2)}%)`, interpretation: atrPct > 4 ? 'High volatility' : atrPct > 2 ? 'Medium volatility' : 'Low volatility', tone: atrPct > 4 ? 'danger' : atrPct > 2 ? 'warning' : 'positive' })
  if (stochRsi != null) items.push({ label: 'Stochastic RSI', value: round(stochRsi, 1), interpretation: stochRsi >= 80 ? 'Momentum stretched' : stochRsi <= 20 ? 'Momentum washed out' : 'Momentum in range', tone: stochRsi >= 80 ? 'warning' : stochRsi <= 20 ? 'positive' : 'balanced' })
  if (supertrendLine != null) items.push({ label: 'Supertrend', value: supertrendDirection === 'bullish' ? 'Bullish' : 'Bearish', interpretation: price >= supertrendLine ? 'Price is above the Supertrend line' : 'Price is below the Supertrend line', tone: price >= supertrendLine ? 'positive' : 'danger' })
  if (vwap != null) items.push({ label: 'VWAP', value: normalizePrice(vwap), interpretation: price > vwap ? `Price is ${round(vwapDistancePct, 2)}% above VWAP${vwapSlope > 0.02 ? ' and VWAP is rising' : vwapSlope < -0.02 ? ' while VWAP is falling' : ''}` : price < vwap ? `Price is ${Math.abs(round(vwapDistancePct, 2))}% below VWAP${vwapSlope < -0.02 ? ' and VWAP is falling' : vwapSlope > 0.02 ? ' while VWAP is rising' : ''}` : 'Price is sitting right on VWAP', tone: price > vwap ? 'positive' : price < vwap ? 'danger' : 'balanced' })
  if (obvSlope !== 0) items.push({ label: 'OBV', value: obvSlope > 0 ? 'Rising' : 'Falling', interpretation: obvSlope > 0 ? 'Volume trend supports price move' : 'Volume trend is diverging or weakening', tone: obvSlope > 0 ? 'positive' : 'warning' })
  if (mfi != null) items.push({ label: 'Money Flow Index', value: round(mfi, 1), interpretation: mfi >= 80 ? 'Money flow is stretched' : mfi <= 20 ? 'Money flow is washed out' : 'Money flow is balanced', tone: mfi >= 80 ? 'warning' : mfi <= 20 ? 'positive' : 'balanced' })
  if (cmf != null) items.push({ label: 'Chaikin Money Flow', value: round(cmf, 2), interpretation: cmf > 0.05 ? 'Accumulation pressure' : cmf < -0.05 ? 'Distribution pressure' : 'Neutral money flow', tone: cmf > 0.05 ? 'positive' : cmf < -0.05 ? 'danger' : 'balanced' })

  return items
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
    const timeframeLabel = { daily: '1D', weekly: '1W', monthly: '1M', h4: '4H' }[key] ?? key
    const basePatterns = detectPatterns(bars).patterns.map(pattern => summarizePattern(pattern, bars, levels, timeframeLabel, volumeAnalysis))
    const extraPatterns = deriveAdditionalPatterns(bars, indicators, levels, volumeAnalysis)
    analyzedFrames[key] = scoreTimeframe(bars, indicators, levels, volumeAnalysis)
    frameIndicators[key] = indicators
    framePatterns[key] = [...basePatterns, ...extraPatterns]
  })

  const dailyIndicators = frameIndicators.daily
  const dailyLevels = deriveSupportResistance(dailyBars, dailyIndicators)
  const dailyVolume = deriveVolumeAnalysis(dailyBars, dailyIndicators, dailyLevels)
  const overallTechnicalBias = determineBiasFromFrames(analyzedFrames)
  const gapContext = deriveGapContext(dailyBars, overallTechnicalBias)
  const vwapContext = deriveVwapContext(dailyIndicators, dailyBars, dailyBars.length - 1, overallTechnicalBias)
  const patterns = [...(framePatterns.daily ?? []), ...(framePatterns.weekly ?? []).slice(0, 2)]
    .filter((pattern, index, array) => array.findIndex(item => item.name === pattern.name && item.priceZone === pattern.priceZone) === index)
    .slice(0, 8)

  const primaryIndex = dailyBars.length - 1
  const lastDailyPrice = dailyBars.at(-1)?.c ?? 0
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
  const atrPct = lastDailyPrice ? (latest(dailyIndicators.atr14, primaryIndex) / lastDailyPrice) * 100 : null
  const bbWidth = latest(dailyIndicators.bb20.width, primaryIndex)
  const volatilityScore = Math.round(clamp(
    68 -
    (atrPct != null && atrPct > 4 ? 16 : atrPct != null && atrPct > 2.5 ? 7 : 0) +
    (bbWidth != null && bbWidth < 0.08 ? 5 : 0) -
    (bbWidth != null && bbWidth > 0.18 ? 8 : 0),
    25,
    92,
  ))
  const supportDistance = dailyLevels.support?.[0] != null && lastDailyPrice
    ? Math.abs(lastDailyPrice - dailyLevels.support[0]) / lastDailyPrice
    : null
  const resistanceDistance = dailyLevels.resistance?.[0] != null && lastDailyPrice
    ? Math.abs(dailyLevels.resistance[0] - lastDailyPrice) / lastDailyPrice
    : null
  const levelsScore = Math.round(clamp(
    58 +
    (supportDistance != null && supportDistance <= 0.035 ? 10 : 0) +
    (resistanceDistance != null && resistanceDistance >= 0.04 ? 8 : 0) -
    (resistanceDistance != null && resistanceDistance <= 0.015 ? 10 : 0),
    25,
    92,
  ))
  const alignmentScore = overallTechnicalBias === 'Neutral' ? 55 : 76
  const technicalScore = Math.round(clamp(
    trendScore * 0.22 +
    momentumScore * 0.18 +
    volatilityScore * 0.12 +
    volumeScore * 0.15 +
    patternScore * 0.16 +
    levelsScore * 0.1 +
    alignmentScore * 0.07,
    20,
    95,
  ))

  const rsi14 = latest(dailyIndicators.rsi14, primaryIndex)
  const macdSignal = latest(dailyIndicators.macd.line, primaryIndex) > latest(dailyIndicators.macd.signal, primaryIndex) ? 'Bullish' : 'Bearish'
  const priceVsSma200 = dailyBars.at(-1)?.c > latest(dailyIndicators.sma200, primaryIndex) ? 'Above' : 'Below'
  const keySupport = aggregateLevels(analyzedFrames, 'support')
  const keyResistance = aggregateLevels(analyzedFrames, 'resistance')
  const nearestResistance = keyResistance[0]
  const nearestSupport = keySupport[0]
  const risk = computeRisk(dailyBars, dailyIndicators, {
    nearestSupport,
    nearestResistance,
    patternInvalidation: patterns[0]?.invalidationLevel ?? patterns[0]?.invalidatedBelow ?? patterns[0]?.invalidatedAbove ?? null,
    vwap: latest(dailyIndicators.vwap, primaryIndex),
  })

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
    volatilityScore,
    volumeScore,
    patternScore,
    levelsScore,
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
      wma20: normalizePrice(latest(dailyIndicators.wma20, primaryIndex)),
      wma50: normalizePrice(latest(dailyIndicators.wma50, primaryIndex)),
      rsi14: round(rsi14, 1),
      stochRsi: round(latest(dailyIndicators.stochRsi?.k, primaryIndex), 1),
      macdSignal,
      priceVsSma200,
      atr: round(latest(dailyIndicators.atr14, primaryIndex), 2),
      atrPct: round(lastDailyPrice ? (latest(dailyIndicators.atr14, primaryIndex) / lastDailyPrice) * 100 : null, 2),
      adx: round(latest(dailyIndicators.adx?.adx, primaryIndex), 1),
      plusDI: round(latest(dailyIndicators.adx?.pdi, primaryIndex), 1),
      minusDI: round(latest(dailyIndicators.adx?.mdi, primaryIndex), 1),
      cci20: round(latest(dailyIndicators.cci20, primaryIndex), 1),
      momentum10: round(latest(dailyIndicators.momentum10, primaryIndex), 2),
      williamsR: round(latest(dailyIndicators.willR, primaryIndex), 1),
      vwap: normalizePrice(latest(dailyIndicators.vwap, primaryIndex)),
      supertrend: {
        state: latest(dailyIndicators.supertrend?.direction, primaryIndex) === 'bullish' ? 'Bullish' : 'Bearish',
        line: normalizePrice(latest(dailyIndicators.supertrend?.line, primaryIndex)),
        flip: Boolean(latest(dailyIndicators.supertrend?.flipped, primaryIndex)),
      },
      bollingerBands: {
        upper: normalizePrice(latest(dailyIndicators.bb20?.upper, primaryIndex)),
        middle: normalizePrice(latest(dailyIndicators.bb20?.middle, primaryIndex)),
        lower: normalizePrice(latest(dailyIndicators.bb20?.lower, primaryIndex)),
        width: round(latest(dailyIndicators.bb20?.width, primaryIndex), 4),
        percentB: round(latest(dailyIndicators.bb20?.percentB, primaryIndex), 2),
      },
      keltnerChannels: {
        upper: normalizePrice(latest(dailyIndicators.keltner?.upper, primaryIndex)),
        middle: normalizePrice(latest(dailyIndicators.keltner?.middle, primaryIndex)),
        lower: normalizePrice(latest(dailyIndicators.keltner?.lower, primaryIndex)),
      },
      donchianChannels: {
        upper: normalizePrice(latest(dailyIndicators.donchian?.upper, primaryIndex)),
        middle: normalizePrice(latest(dailyIndicators.donchian?.middle, primaryIndex)),
        lower: normalizePrice(latest(dailyIndicators.donchian?.lower, primaryIndex)),
      },
      mfi14: round(latest(dailyIndicators.mfi14, primaryIndex), 1),
      cmf20: round(latest(dailyIndicators.cmf20, primaryIndex), 2),
      adl: round(latest(dailyIndicators.adl, primaryIndex), 0),
      volumeMovingAverage: round(latest(dailyIndicators.avgVol, primaryIndex), 0),
      obv: round(latest(dailyIndicators.obv, primaryIndex), 0),
    },
    indicatorInterpretations: buildIndicatorInterpretations(dailyIndicators, dailyBars, primaryIndex),
    gapContext,
    vwapContext,
    patterns,
    volumeAnalysis: dailyVolume,
    keyLevels: {
      support: keySupport,
      resistance: keyResistance,
      dynamicSupportResistance: dailyLevels.dynamicSupportResistance.slice(0, 6),
      breakoutLevels: dailyLevels.breakoutZones,
      breakdownLevels: dailyLevels.breakdownZones,
      stopLossDangerZones: dailyLevels.stopLossDangerZones,
      pivotPoints: dailyLevels.pivotPoints,
      previousHighLow: dailyLevels.previousHighLow,
    },
    riskAssessment: {
      riskLevel,
      mainRisk,
      stopLoss: risk?.stopLoss ?? null,
      takeProfit: risk?.takeProfit ?? null,
      rrRatio: risk?.rrRatio ?? null,
      trailingStop: risk?.trailingStop ?? null,
      riskPct: risk?.riskPct ?? null,
      rewardPct: risk?.rewardPct ?? null,
      stopContext: risk?.stopContext ?? null,
    },
    finalTechnicalOutlook,
    disclaimer: 'This technical analysis is for educational and informational purposes only. It is not financial advice or a trading recommendation.',
  }
}
