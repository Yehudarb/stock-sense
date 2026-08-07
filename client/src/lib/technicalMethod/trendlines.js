import { TECHNICAL_METHOD_CONFIG } from './config.js'

const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null

function collectPivots(bars, key, direction, lookback) {
  const pivots = []
  for (let index = lookback; index < bars.length - lookback; index += 1) {
    const value = bars[index]?.[key]
    if (!Number.isFinite(value)) continue
    const neighbours = bars.slice(index - lookback, index + lookback + 1)
    const isPivot = neighbours.every(bar => direction === 'support' ? value <= bar[key] : value >= bar[key])
    if (isPivot) pivots.push({ index, price: value, t: bars[index].t })
  }
  return pivots
}

function lineFromPivots(pivots, direction, bars, atr, config) {
  if (pivots.length < config.trendlines.minimumTouches) return null
  const touches = pivots.slice(-config.trendlines.minimumTouches)
  const first = touches[0]
  const last = touches.at(-1)
  const span = last.index - first.index
  if (span < 4) return null

  const slopePerBar = (last.price - first.price) / span
  const rising = slopePerBar > 0
  const directional = direction === 'support' ? rising : slopePerBar < 0
  if (!directional) return null

  const buffer = Math.max((atr ?? 0) * config.trendlines.breakAtrBuffer, bars.at(-1).c * 0.0025)
  // The anchored section establishes the line. Count breaks only after the
  // final confirmed pivot, otherwise ordinary pullback noise rejects every
  // otherwise valid multi-touch trendline.
  const postAnchor = bars.slice(last.index + 1)
  const violations = postAnchor.reduce((count, bar, offset) => {
    const expected = last.price + slopePerBar * (offset + 1)
    const violates = direction === 'support' ? bar.c < expected - buffer : bar.c > expected + buffer
    return count + (violates ? 1 : 0)
  }, 0)
  const currentIndex = bars.length - 1
  const currentValue = first.price + slopePerBar * (currentIndex - first.index)
  const distancePercent = Math.abs(bars.at(-1).c - currentValue) / bars.at(-1).c * 100
  const confirmationBars = bars.slice(-config.trendlines.breakConfirmationBars)
  const confirmedBreak = confirmationBars.length === config.trendlines.breakConfirmationBars && confirmationBars.every((bar, offset) => {
    const index = currentIndex - confirmationBars.length + 1 + offset
    const expected = first.price + slopePerBar * (index - first.index)
    return direction === 'support' ? bar.c < expected - buffer : bar.c > expected + buffer
  })
  const priorBreak = postAnchor.slice(0, -1).some((bar, offset) => {
    const expected = last.price + slopePerBar * (offset + 1)
    return direction === 'support' ? bar.c < expected - buffer : bar.c > expected + buffer
  })
  const reclaimed = priorBreak && !confirmedBreak && distancePercent <= config.trendlines.testingDistancePercent
  if (!confirmedBreak && violations > config.trendlines.maxViolations && !reclaimed) return null
  const status = confirmedBreak ? 'broken' : reclaimed ? 'reclaimed' : distancePercent <= config.trendlines.testingDistancePercent ? 'testing' : 'holding'
  const duration = last.index - first.index
  const qualityScore = Math.min(100, Math.max(0, Math.round(
    touches.length * 18 + Math.min(25, duration / 4) + Math.max(0, 24 - violations * 8) + Math.max(0, 15 - (currentIndex - last.index) / 4),
  )))

  return {
    id: `micha-${direction}-${first.index}-${last.index}`,
    type: direction,
    direction: direction === 'support' ? 'ascending' : 'descending',
    bias: direction === 'support' ? 'bullish' : 'bearish',
    touchCount: touches.length,
    qualityScore,
    trendlineQualityScore: qualityScore,
    slopePerBar: round(slopePerBar, 4),
    currentValue: round(currentValue),
    distanceFromPricePercent: round(distancePercent),
    violations,
    status,
    startDate: new Date(first.t).toISOString(),
    endDate: new Date(last.t).toISOString(),
    startPrice: round(first.price),
    endPrice: round(last.price),
    currentProjectedValue: round(currentValue),
    from: { index: first.index, price: round(first.price), t: first.t },
    to: { index: last.index, price: round(last.price), t: last.t },
    projection: { index: currentIndex, price: round(currentValue), t: bars.at(-1).t },
  }
}

/** Detect validated three-touch ascending support and descending resistance lines. */
export function detectMethodTrendlines(bars, indicators, config = TECHNICAL_METHOD_CONFIG) {
  if (!bars?.length || bars.length < 30) return []
  const atr = indicators?.atr14?.at(-1)
  const lookback = config.levels.pivotLookback
  return [
    lineFromPivots(collectPivots(bars, 'l', 'support', lookback), 'support', bars, atr, config),
    lineFromPivots(collectPivots(bars, 'h', 'resistance', lookback), 'resistance', bars, atr, config),
  ].filter(Boolean)
}
