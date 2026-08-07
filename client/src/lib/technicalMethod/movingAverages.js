import { TECHNICAL_METHOD_CONFIG, classifySlope } from './config.js'

const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null
const pct = (from, to) => Number.isFinite(from) && from !== 0 && Number.isFinite(to) ? ((to - from) / from) * 100 : null

function consecutive(values, price, predicate) {
  let count = 0
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (!Number.isFinite(values[index]) || !predicate(price[index], values[index])) break
    count += 1
  }
  return count
}

function structureStatus({ price, sma150, sma200, slope150, slope200, bars }) {
  const above150 = price > sma150
  const above200 = price > sma200
  const stacked = sma150 > sma200
  const slope200Up = slope200 > 0
  const slope150Up = slope150 > 0
  const recent = bars.slice(-25)
  const higherStructure = recent.length >= 10 && recent.at(-1).c > recent[0].c &&
    Math.min(...recent.slice(-8).map(bar => bar.l)) >= Math.min(...recent.slice(0, 8).map(bar => bar.l))

  if (!above150 && !above200 && !stacked && slope200 < 0) return 'downtrend'
  if (above150 && above200 && stacked && slope150Up && slope200Up && higherStructure) return 'strong_uptrend'
  if (above150 && above200 && stacked && slope200Up) return 'uptrend'
  if ((above150 || above200) && (slope150Up || slope200 >= -0.5)) return 'early_recovery'
  if (!above150 || !above200 || slope150 < 0 || slope200 < 0) return 'weak_structure'
  return 'neutral'
}

/** Analyze SMA150/SMA200 status without relying on a single-session slope. */
export function analyzeLongTermTrend(bars, indicators, config = TECHNICAL_METHOD_CONFIG) {
  const index = bars.length - 1
  const price = bars[index]?.c
  const sma150 = indicators?.sma150?.[index]
  const sma200 = indicators?.sma200?.[index]
  if (bars.length < config.minimumBars || !Number.isFinite(price) || !Number.isFinite(sma150) || !Number.isFinite(sma200)) {
    return {
      available: false,
      status: 'insufficient_history',
      qualified: false,
      barsAvailable: bars.length,
      barsRequired: config.minimumBars,
      reason: `At least ${config.minimumBars} closed bars are required for SMA150/SMA200.`,
    }
  }

  const slope150_20 = pct(indicators.sma150[index - 20], sma150)
  const slope150_50 = pct(indicators.sma150[index - 50], sma150)
  const slope200_20 = pct(indicators.sma200[index - 20], sma200)
  const slope200_50 = pct(indicators.sma200[index - 50], sma200)
  const slope150 = slope150_50 ?? slope150_20
  const slope200 = slope200_50 ?? slope200_20
  const above150 = price > sma150
  const above200 = price > sma200
  const sma150Above200 = sma150 > sma200
  const sma200Rising = Number.isFinite(slope200) && slope200 > 0
  const sma150Rising = Number.isFinite(slope150) && slope150 > 0
  const qualified = above150 && above200 && sma150Above200 && sma200Rising

  return {
    available: true,
    status: structureStatus({ price, sma150, sma200, slope150, slope200, bars }),
    qualified,
    price, sma150: round(sma150), sma200: round(sma200),
    priceVsSma150Percent: round(pct(sma150, price)), priceVsSma200Percent: round(pct(sma200, price)),
    sma150VsSma200Percent: round(pct(sma200, sma150)),
    sma150Slope20Percent: round(slope150_20), sma150Slope50Percent: round(slope150_50),
    sma200Slope20Percent: round(slope200_20), sma200Slope50Percent: round(slope200_50),
    sma150SlopeState: classifySlope(slope150), sma200SlopeState: classifySlope(slope200),
    priceAboveSma150: above150, priceAboveSma200: above200, sma150AboveSma200: sma150Above200, sma150Rising, sma200Rising,
    barsAvailable: bars.length, barsRequired: config.minimumBars,
    consecutiveAboveSma150: consecutive(indicators.sma150, bars.map(bar => bar.c), (close, value) => close > value),
    consecutiveAboveSma200: consecutive(indicators.sma200, bars.map(bar => bar.c), (close, value) => close > value),
    consecutiveBelowSma150: consecutive(indicators.sma150, bars.map(bar => bar.c), (close, value) => close < value),
    consecutiveBelowSma200: consecutive(indicators.sma200, bars.map(bar => bar.c), (close, value) => close < value),
  }
}

/** Classify short-term timing relative to SMA20 using price and ATR distance. */
export function analyzeShortTermTiming(bars, indicators, config = TECHNICAL_METHOD_CONFIG) {
  const index = bars.length - 1
  const price = bars[index]?.c
  const sma20 = indicators?.sma20?.[index]
  const atr = indicators?.atr14?.[index]
  if (!Number.isFinite(price) || !Number.isFinite(sma20)) return { available: false, status: 'neutral' }
  const distancePercent = pct(sma20, price)
  const distanceAtr = Number.isFinite(atr) && atr > 0 ? (price - sma20) / atr : null
  const slope20 = pct(indicators.sma20[index - 20], sma20)
  const recent = bars.slice(-4)
  const tested = Number.isFinite(atr) && recent.some(bar => Math.abs(bar.l - sma20) <= atr * config.sma20.testAtr || Math.abs(bar.h - sma20) <= atr * config.sma20.testAtr)
  const bullishResponse = tested && price >= sma20 && bars[index].c >= bars[index].o
  const reclaiming = bars[index - 1]?.c < indicators.sma20?.[index - 1] && price >= sma20
  let status = 'trading_near_sma20'
  if (reclaiming) status = 'reclaiming_sma20'
  else if (distanceAtr != null && distanceAtr > config.sma20.extendedAtr) status = 'extended_above_sma20'
  else if (distanceAtr != null && distanceAtr < -config.sma20.lostAtr && slope20 < 0) status = 'below_falling_sma20'
  else if (distanceAtr != null && distanceAtr < -config.sma20.lostAtr) status = 'lost_sma20_support'
  else if (tested && bullishResponse) status = 'healthy_pullback_to_sma20'
  else if (distanceAtr == null || Math.abs(distanceAtr) > config.sma20.nearAtr) status = 'neutral'
  return {
    available: true, status, sma20: round(sma20), ema20: round(indicators?.ema20?.[index]),
    distanceFromSma20Percent: round(distancePercent), distanceFromSma20InAtr: round(distanceAtr),
    sma20SlopePercent: round(slope20), sma20SlopeState: classifySlope(slope20),
    recentlyTested: tested, response: bullishResponse ? 'bullish' : tested ? 'bearish' : 'inconclusive',
    dynamicRole: price >= sma20 ? 'support_reference' : 'resistance_reference',
    consecutiveAboveSma20: consecutive(indicators.sma20, bars.map(bar => bar.c), (close, value) => close > value),
    consecutiveBelowSma20: consecutive(indicators.sma20, bars.map(bar => bar.c), (close, value) => close < value),
  }
}
