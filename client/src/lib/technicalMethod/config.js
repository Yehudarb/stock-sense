/** Central, auditable thresholds for the Long-Term Technical Confluence Method. */
export const TECHNICAL_METHOD_CONFIG = Object.freeze({
  name: 'Long-Term Technical Confluence Method',
  displayName: 'Micha Method',
  minimumBars: 200,
  slope: { stronglyRising: 2.5, rising: 0.5, falling: -0.5, stronglyFalling: -2.5 },
  sma20: { nearAtr: 1, extendedAtr: 2, lostAtr: 1.25, testAtr: 0.45 },
  levels: {
    pivotLookback: 4,
    minimumTouches: 2,
    preferredTouches: 3,
    zoneAtrMultiplier: 0.55,
    nearPricePercent: 2.5,
    breakAtrBuffer: 0.25,
    breakConfirmationBars: 2,
    minimumBreakPercent: 0.35,
    volumeConfirmationRatio: 1.2,
    falseBreakLookback: 8,
  },
  fibonacci: { swingLookback: 120, proximityPercent: 1.25, minimumSwingAtr: 4 },
  trendlines: {
    minimumTouches: 3,
    maxViolations: 2,
    breakAtrBuffer: 0.35,
    breakConfirmationBars: 2,
    testingDistancePercent: 1.25,
  },
  patterns: { minimumConfidence: 58, overlapBars: 12 },
  setup: {
    breakoutBufferPercent: 0.35,
    confirmationBars: 2,
    confirmationVolumeRatio: 1.1,
    bullishCloseLocationMinimum: 0.6,
  },
  risk: { stopAtrMultiplier: 0.35, maxStopPercent: 12, minStopPercent: 1, minimumRiskReward: 1.5 },
  scoreThresholds: { strong: 85, good: 70, constructive: 55, weak: 40, bearish: 20 },
  weights: {
    longTermTrend: 0.30,
    shortTermTiming: 0.15,
    supportResistance: 0.20,
    trendlines: 0.10,
    technicalPatterns: 0.10,
    fibonacci: 0.10,
    volumeConfirmation: 0.05,
  },
})

export function classifySlope(value, config = TECHNICAL_METHOD_CONFIG.slope) {
  if (!Number.isFinite(value)) return 'unavailable'
  if (value >= config.stronglyRising) return 'rising_strongly'
  if (value >= config.rising) return 'rising'
  if (value <= config.stronglyFalling) return 'falling_strongly'
  if (value <= config.falling) return 'falling'
  return 'flat'
}
