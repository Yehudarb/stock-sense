import { TECHNICAL_METHOD_CONFIG } from './config.js'

const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null
const distancePct = (price, level) => Number.isFinite(price) && Number.isFinite(level) && price > 0 ? Math.abs(price - level) / price * 100 : null
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

function pivots(bars, key, compare, lookback) {
  const output = []
  for (let index = lookback; index < bars.length - lookback; index += 1) {
    const value = bars[index][key]
    const around = bars.slice(index - lookback, index + lookback + 1)
    if (Number.isFinite(value) && around.every(bar => compare(value, bar[key]))) output.push({ index, price: value, t: bars[index].t })
  }
  return output
}

function rejectionMagnitude(group, originalType, bars) {
  const reactions = group.points.map(point => {
    const future = bars.slice(point.index + 1, Math.min(bars.length, point.index + 6))
    if (!future.length || point.price <= 0) return 0
    const extreme = originalType === 'support'
      ? Math.max(...future.map(bar => bar.h))
      : Math.min(...future.map(bar => bar.l))
    return Math.abs(extreme - point.price) / point.price * 100
  })
  return average(reactions) ?? 0
}

function countFalseBreaks(bars, lowerBound, upperBound, originalType, lookback) {
  const recent = bars.slice(-lookback)
  let count = 0
  for (let index = 0; index < recent.length - 1; index += 1) {
    const crossed = originalType === 'support' ? recent[index].l < lowerBound : recent[index].h > upperBound
    const recovered = originalType === 'support' ? recent[index + 1].c >= lowerBound : recent[index + 1].c <= upperBound
    if (crossed && recovered) count += 1
  }
  return count
}

function levelConfluences(midpoint, indicators, atr) {
  const tolerance = Math.max((atr ?? 0) * 0.5, midpoint * 0.0075)
  return ['sma20', 'sma50', 'sma150', 'sma200']
    .filter(key => Number.isFinite(indicators?.[key]?.at(-1)) && Math.abs(indicators[key].at(-1) - midpoint) <= tolerance)
    .map(key => key.toUpperCase())
}

function clusters(points, originalType, bars, indicators, atr, config) {
  const width = Math.max((atr ?? 0) * config.levels.zoneAtrMultiplier, bars.at(-1).c * 0.004)
  const groups = []
  for (const point of points) {
    const group = groups.find(item => Math.abs(item.midpoint - point.price) <= width)
    if (group) {
      group.points.push(point)
      group.midpoint = average(group.points.map(item => item.price))
    } else groups.push({ points: [point], midpoint: point.price })
  }

  const price = bars.at(-1).c
  const volumeAverage = indicators?.volSma20?.at(-1) ?? average(bars.slice(-20).map(bar => bar.v ?? 0))
  return groups.map((group, index) => {
    const prices = group.points.map(point => point.price)
    const midpoint = average(prices)
    const lowerBound = Math.min(...prices) - width / 2
    const upperBound = Math.max(...prices) + width / 2
    const buffer = Math.max((atr ?? 0) * config.levels.breakAtrBuffer, midpoint * config.levels.minimumBreakPercent / 100)
    const confirmation = bars.slice(-config.levels.breakConfirmationBars)
    const confirmedUp = confirmation.length === config.levels.breakConfirmationBars && confirmation.every(bar => bar.c > upperBound + buffer)
    const confirmedDown = confirmation.length === config.levels.breakConfirmationBars && confirmation.every(bar => bar.c < lowerBound - buffer)
    const flipped = originalType === 'resistance' ? confirmedUp : confirmedDown
    const type = flipped ? (originalType === 'resistance' ? 'support' : 'resistance') : originalType
    const broken = originalType === 'support' ? confirmedDown : confirmedUp
    const falseBreakCount = countFalseBreaks(bars, lowerBound, upperBound, originalType, config.levels.falseBreakLookback)
    const rejection = rejectionMagnitude(group, originalType, bars)
    const lastPoint = group.points.at(-1)
    const recency = Math.max(0, 1 - (bars.length - 1 - lastPoint.index) / 180)
    const touchVolume = average(group.points.map(point => bars[point.index]?.v ?? 0))
    const volumeRatio = Number.isFinite(touchVolume) && volumeAverage > 0 ? touchVolume / volumeAverage : null
    const volumeScore = Number.isFinite(volumeRatio) ? Math.min(1, volumeRatio) : 0.5
    const confluences = levelConfluences(midpoint, indicators, atr)
    const strengthScore = Math.min(100, Math.max(0, Math.round(
      Math.min(group.points.length, 4) * 17 + Math.min(rejection, 6) * 4 + recency * 15 + volumeScore * 10 + confluences.length * 5 - falseBreakCount * 8,
    )))
    const inZone = price >= lowerBound && price <= upperBound
    const wasRecovered = falseBreakCount > 0 && !broken
    const status = flipped ? 'flipped' : broken ? 'broken' : wasRecovered ? 'reclaimed' : inZone ? 'tested' : 'active'
    return {
      id: `${originalType}-${index}-${round(midpoint, 3)}`,
      type,
      originalType,
      lowerBound: round(lowerBound),
      upperBound: round(upperBound),
      midpoint: round(midpoint),
      strengthScore,
      levelStrengthScore: strengthScore,
      touchCount: group.points.length,
      falseBreakCount,
      firstDetectedAt: new Date(group.points[0].t).toISOString(),
      lastTouchedAt: new Date(lastPoint.t).toISOString(),
      rejectionMagnitudePercent: round(rejection),
      distanceFromPricePercent: round(distancePct(price, midpoint)),
      confluences,
      volumeConfirmed: Number.isFinite(volumeRatio) ? volumeRatio >= config.levels.volumeConfirmationRatio : null,
      status,
    }
  }).filter(level => level.touchCount >= config.levels.minimumTouches)
}

/** Build confirmed ATR-width zones and preserve support/resistance role changes. */
export function detectPriceLevels(bars, indicators, config = TECHNICAL_METHOD_CONFIG) {
  if (!bars?.length || bars.length < 30) return { support: [], resistance: [], nearestSupport: null, nearestResistance: null }
  const atr = indicators?.atr14?.at(-1)
  const all = [
    ...clusters(pivots(bars, 'l', (value, other) => value <= other, config.levels.pivotLookback), 'support', bars, indicators, atr, config),
    ...clusters(pivots(bars, 'h', (value, other) => value >= other, config.levels.pivotLookback), 'resistance', bars, indicators, atr, config),
  ]
  const price = bars.at(-1).c
  const support = all.filter(level => level.type === 'support' && level.midpoint <= price && level.status !== 'broken')
    .sort((a, b) => b.midpoint - a.midpoint)
  const resistance = all.filter(level => level.type === 'resistance' && level.midpoint >= price && level.status !== 'broken')
    .sort((a, b) => a.midpoint - b.midpoint)
  const broken = all.filter(level => level.status === 'broken')
  return { support, resistance, broken, all, nearestSupport: support[0] ?? null, nearestResistance: resistance[0] ?? null }
}
