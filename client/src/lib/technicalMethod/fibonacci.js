import { TECHNICAL_METHOD_CONFIG } from './config.js'

const RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786]
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

/** Calculate retracement levels from the latest directional swing available in the current data. */
export function analyzeFibonacci(bars, trend, config = TECHNICAL_METHOD_CONFIG, context = {}) {
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
  const atr = context.indicators?.atr14?.at(-1)
  if (Number.isFinite(atr) && range < atr * config.fibonacci.minimumSwingAtr) {
    return { available: false, status: 'not_available', levels: null, reason: 'The latest swing is too small relative to ATR.' }
  }
  const levelPrice = ratio => bullish ? end.h - range * ratio : end.l + range * ratio
  const previousPrice = recent.at(-2)?.c
  const levels = RATIOS.map(ratio => {
    const value = levelPrice(ratio)
    const distance = ((price - value) / value) * 100
    const priorDistance = Number.isFinite(previousPrice) ? ((previousPrice - value) / value) * 100 : null
    let status = Math.abs(distance) <= config.fibonacci.proximityPercent ? 'testing' : distance > 0 ? 'above' : 'below'
    if (bullish && priorDistance < -config.fibonacci.proximityPercent && distance > config.fibonacci.proximityPercent) status = 'reclaimed'
    if (bullish && priorDistance > config.fibonacci.proximityPercent && distance < -config.fibonacci.proximityPercent) status = 'lost'
    if (!bullish && priorDistance > config.fibonacci.proximityPercent && distance < -config.fibonacci.proximityPercent) status = 'reclaimed'
    if (!bullish && priorDistance < -config.fibonacci.proximityPercent && distance > config.fibonacci.proximityPercent) status = 'lost'
    return { ratio, price: round(value), distanceFromPricePercent: round(distance), status }
  })
  const fifty = levels.find(level => level.ratio === 0.5)
  const golden = levels.find(level => level.ratio === 0.618)
  const lower = Math.min(fifty.price, golden.price)
  const upper = Math.max(fifty.price, golden.price)
  const inside = price >= lower && price <= upper
  const sixtyOne = levels.find(level => level.ratio === 0.618)
  const seventyEight = levels.find(level => level.ratio === 0.786)
  const deep = bullish ? price < sixtyOne.price : price > sixtyOne.price
  const atRisk = bullish ? price < seventyEight.price : price > seventyEight.price
  const reclaimed = levels.some(level => level.status === 'reclaimed')
  const lost = levels.some(level => level.status === 'lost')
  const shallow = bullish ? price > levels[1].price : price < levels[1].price
  const status = atRisk ? 'structure_at_risk' : inside ? 'golden_zone_test' : reclaimed ? 'fibonacci_level_reclaimed'
    : lost ? 'fibonacci_level_lost' : deep ? 'deep_retracement' : shallow ? 'shallow_pullback' : 'healthy_retracement'
  const tolerance = Math.max((atr ?? 0) * 0.5, price * 0.0075)
  const confluences = []
  for (const key of ['sma20', 'sma50']) {
    const value = context.indicators?.[key]?.at(-1)
    if (Number.isFinite(value) && (Math.abs(value - lower) <= tolerance || Math.abs(value - upper) <= tolerance)) confluences.push(key.toUpperCase())
  }
  if (context.levels?.all?.some(level => level.status !== 'broken' && level.upperBound >= lower - tolerance && level.lowerBound <= upper + tolerance)) confluences.push('HORIZONTAL_LEVEL')
  if (context.trendlines?.some(line => line.status !== 'broken' && line.currentValue >= lower - tolerance && line.currentValue <= upper + tolerance)) confluences.push('TRENDLINE')
  return {
    available: true, status, trendDirection: bullish ? 'up' : 'down',
    swingStartDate: new Date(start.t).toISOString(), swingStartPrice: round(bullish ? start.l : start.h),
    swingEndDate: new Date(end.t).toISOString(), swingEndPrice: round(bullish ? end.h : end.l),
    levels, goldenZone: { lower, upper, priceInsideZone: inside, confluences },
    confidenceScore: Math.min(95, Math.round(45 + Math.min(35, range / price * 400) + confluences.length * 5)),
  }
}
