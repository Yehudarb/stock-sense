/** Central, auditable thresholds for the Long-Term Technical Confluence Method. */
export const TECHNICAL_METHOD_CONFIG = Object.freeze({
  name: 'Long-Term Technical Confluence Method',
  displayName: 'Micha Method',
  minimumBars: 200,
  slope: { stronglyRising: 2.5, rising: 0.5, falling: -0.5, stronglyFalling: -2.5 },
  sma20: { nearAtr: 1, extendedAtr: 2, lostAtr: 1.25, testAtr: 0.45 },
  levels: { pivotLookback: 4, minimumTouches: 2, zoneAtrMultiplier: 0.55, nearPricePercent: 2.5 },
  fibonacci: { swingLookback: 120, proximityPercent: 1.25 },
  trendlines: { minimumTouches: 3, maxViolations: 2, breakAtrBuffer: 0.35 },
  risk: { stopAtrMultiplier: 0.35, maxStopPercent: 12, minStopPercent: 1, minimumRiskReward: 1.5 },
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
