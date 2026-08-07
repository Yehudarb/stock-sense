import { computeAll } from '../indicators.js'
import { detectPatterns } from '../patterns.js'
import { runSplitSample, runWalkForward } from '../walkForward.js'
import { computeTechnicalMethod } from './index.js'

export const METHOD_VALIDATION_VARIANTS = Object.freeze([
  'long_term_only',
  'trend_sma20',
  'trend_support',
  'trend_fibonacci',
  'trend_pattern',
  'full_confluence',
])

function matchesVariant(method, variant) {
  const qualified = method?.trend?.qualified === true
  if (variant === 'long_term_only') return qualified
  if (variant === 'trend_sma20') return qualified && ['healthy_pullback_to_sma20', 'trading_near_sma20', 'reclaiming_sma20'].includes(method.timing.status)
  if (variant === 'trend_support') return qualified && method.supportResistance.nearestSupport?.distanceFromPricePercent <= 2.5
  if (variant === 'trend_fibonacci') return qualified && method.fibonacci?.goldenZone?.priceInsideZone === true
  if (variant === 'trend_pattern') return qualified && method.patternSummary?.best?.direction === 'bullish'
  return method?.setup?.status === 'triggered'
}

/** Build a no-lookahead decision function from bars available at each replay date. */
export function createTechnicalMethodAction(variant = 'full_confluence') {
  if (!METHOD_VALIDATION_VARIANTS.includes(variant)) throw new TypeError(`Unknown technical method variant: ${variant}`)
  return history => {
    const indicators = computeAll(history, '1d')
    const patterns = detectPatterns(history, { includeMarkers: false })
    const method = computeTechnicalMethod(history, indicators, patterns)
    return matchesVariant(method, variant) ? variant : 'baseline'
  }
}

/** Replay a method variant and return full-period and split-sample evidence. */
export function runTechnicalMethodWalkForward(bars, options = {}) {
  const { variant = 'full_confluence', ...walkForwardOptions } = options
  const computeAction = createTechnicalMethodAction(variant)
  const shared = { ...walkForwardOptions, computeAction }
  return {
    variant,
    full: runWalkForward(bars, shared),
    split: runSplitSample(bars, shared),
    limitations: [
      'Forward returns are research evidence, not simulated broker fills.',
      'Spread, commission, position sizing, and stop execution are not modeled by this adapter.',
      'Results require validation across symbols and market regimes before interpretation.',
    ],
  }
}
