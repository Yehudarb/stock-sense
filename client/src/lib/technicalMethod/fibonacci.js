import { TECHNICAL_METHOD_CONFIG } from './config.js'

const RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786]
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

/** Calculate retracement levels from the latest directional swing available in the current data. */
export function analyzeFibonacci(bars, trend, config = TECHNICAL_METHOD_CONFIG) {
  const recent = bars?.slice(-config.fibonacci.swingLookback) ?? []
  if (recent.length < 30 || !trend?.available) return { available: false, status: 'not_available', levels: null }
  const price = recent.at(-1).c
  const bullish = ['strong_uptrend', 'uptrend', 'early_recovery'].includes(trend.status)
  const startIndex = bullish
    ? recent.reduce((best, bar, index) => bar.l < recent[best].l ? index : best, 0)
    : recent.reduce((best, bar, index) => bar.h > recent[best].h ? index : best, 0)
  const after = recent.slice(startIndex + 1)
  if (after.length < 10) return { available: false, status: 'not_available', levels: null }
  const endOffset = bullish
    ? after.reduce((best, bar, index) => bar.h > after[best].h ? index : best, 0)
    : after.reduce((best, bar, index) => bar.l < after[best].l ? index : best, 0)
  const endIndex = startIndex + 1 + endOffset
  const start = recent[startIndex]
  const end = recent[endIndex]
  const range = bullish ? end.h - start.l : start.h - end.l
  if (!Number.isFinite(range) || range <= 0) return { available: false, status: 'not_available', levels: null }
  const levelPrice = ratio => bullish ? end.h - range * ratio : end.l + range * ratio
  const levels = RATIOS.map(ratio => {
    const value = levelPrice(ratio)
    const distance = ((price - value) / value) * 100
    return { ratio, price: round(value), distanceFromPricePercent: round(distance), status: Math.abs(distance) <= config.fibonacci.proximityPercent ? 'testing' : distance > 0 ? 'above' : 'below' }
  })
  const fifty = levels.find(level => level.ratio === 0.5)
  const golden = levels.find(level => level.ratio === 0.618)
  const lower = Math.min(fifty.price, golden.price)
  const upper = Math.max(fifty.price, golden.price)
  const inside = price >= lower && price <= upper
  const deep = bullish ? price < levels.find(level => level.ratio === 0.618).price : price > levels.find(level => level.ratio === 0.618).price
  const status = inside ? 'golden_zone_test' : deep ? 'deep_retracement' : 'healthy_retracement'
  return {
    available: true, status, trendDirection: bullish ? 'up' : 'down',
    swingStartDate: new Date(start.t).toISOString(), swingStartPrice: round(bullish ? start.l : start.h),
    swingEndDate: new Date(end.t).toISOString(), swingEndPrice: round(bullish ? end.h : end.l),
    levels, goldenZone: { lower, upper, priceInsideZone: inside, confluences: [] },
    confidenceScore: Math.min(90, Math.round(45 + Math.min(45, range / price * 500))),
  }
}
