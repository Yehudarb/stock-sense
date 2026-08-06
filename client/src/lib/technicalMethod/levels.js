import { TECHNICAL_METHOD_CONFIG } from './config.js'

const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null
const distancePct = (price, level) => Number.isFinite(price) && Number.isFinite(level) ? Math.abs(price - level) / price * 100 : null

function pivots(bars, key, compare, lookback) {
  const output = []
  for (let index = lookback; index < bars.length - lookback; index += 1) {
    const value = bars[index][key]
    const around = bars.slice(index - lookback, index + lookback + 1)
    if (around.every(bar => compare(value, bar[key]))) output.push({ index, price: value, t: bars[index].t })
  }
  return output
}

function clusters(points, type, bars, atr, config) {
  const width = Math.max((atr ?? 0) * config.levels.zoneAtrMultiplier, bars.at(-1).c * 0.004)
  const groups = []
  for (const point of points) {
    const group = groups.find(item => Math.abs(item.midpoint - point.price) <= width)
    if (group) group.points.push(point)
    else groups.push({ points: [point], midpoint: point.price })
  }
  const price = bars.at(-1).c
  return groups.map((group, index) => {
    const prices = group.points.map(point => point.price)
    const midpoint = prices.reduce((sum, value) => sum + value, 0) / prices.length
    const lastPoint = group.points.at(-1)
    const recency = Math.max(0, 1 - (bars.length - 1 - lastPoint.index) / 180)
    const touches = group.points.length
    const strengthScore = Math.min(100, Math.round(touches * 24 + recency * 24 + (touches >= config.levels.minimumTouches ? 18 : 0)))
    const lowerBound = Math.min(...prices) - width / 2
    const upperBound = Math.max(...prices) + width / 2
    const broken = type === 'support' ? price < lowerBound : price > upperBound
    const status = broken ? 'broken' : Math.abs(price - midpoint) <= width ? 'tested' : 'active'
    return {
      id: `${type}-${index}-${round(midpoint, 3)}`, type,
      lowerBound: round(lowerBound), upperBound: round(upperBound), midpoint: round(midpoint),
      strengthScore, touchCount: touches, falseBreakCount: 0,
      firstDetectedAt: new Date(group.points[0].t).toISOString(), lastTouchedAt: new Date(lastPoint.t).toISOString(),
      rejectionMagnitudePercent: null, distanceFromPricePercent: round(distancePct(price, midpoint)),
      confluences: [], status,
    }
  }).filter(level => level.touchCount >= config.levels.minimumTouches)
}

/** Build ATR-width support/resistance zones from meaningful pivot clusters. */
export function detectPriceLevels(bars, indicators, config = TECHNICAL_METHOD_CONFIG) {
  if (!bars?.length || bars.length < 30) return { support: [], resistance: [], nearestSupport: null, nearestResistance: null }
  const atr = indicators?.atr14?.at(-1)
  const support = clusters(pivots(bars, 'l', (value, other) => value <= other, config.levels.pivotLookback), 'support', bars, atr, config)
    .filter(level => level.midpoint <= bars.at(-1).c).sort((a, b) => b.midpoint - a.midpoint)
  const resistance = clusters(pivots(bars, 'h', (value, other) => value >= other, config.levels.pivotLookback), 'resistance', bars, atr, config)
    .filter(level => level.midpoint >= bars.at(-1).c).sort((a, b) => a.midpoint - b.midpoint)
  return { support, resistance, nearestSupport: support[0] ?? null, nearestResistance: resistance[0] ?? null }
}
