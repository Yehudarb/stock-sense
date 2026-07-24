// ATR-based dynamic stop loss / target calculator.
// Pure-JS port of trading-engine/stop_engine.py's calculate_optimal_levels().
// Ported instead of shelling out to Python because spawning a `python`
// process is fragile across environments (not on PATH in local dev here,
// and not guaranteed to exist at all in the Node deployment target) and
// this logic is plain arithmetic with no need for a separate runtime.

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function calculateRRRatio(entry, stop, target) {
  if (stop >= entry) throw new Error(`Stop (${stop}) must be below entry (${entry})`)
  if (target <= entry) throw new Error(`Target (${target}) must be above entry (${entry})`)
  return (target - entry) / (entry - stop)
}

function calculateRiskRewardPct(entry, stop, target) {
  return {
    riskPct: ((entry - stop) / entry) * 100,
    rewardPct: ((target - entry) / entry) * 100,
  }
}

function createFixedPercentageLevel(entryPrice, riskPct, rewardPct, reason) {
  const stop = entryPrice * (1 - riskPct)
  const target = entryPrice * (1 + rewardPct)
  return {
    stopPrice: stop,
    targetPrice: target,
    riskPct: riskPct * 100,
    rewardPct: rewardPct * 100,
    rrRatio: calculateRRRatio(entryPrice, stop, target),
    reason,
  }
}

// Each tier gets its own risk ceiling instead of one flat 5% cap for all
// three. A single global cap made "normal" and "wide" collapse onto the
// exact same stop price as "tight" whenever ATR alone already implied
// >5% risk (common for volatile tickers) - defeating the purpose of
// offering three differentiated scenarios. Ceilings scale with the tier
// the same way the original 3%/4%/10% reference points did.
const RISK_CEILING_PCT = { atr_tight: 5, atr_normal: 7.5, atr_wide: 10 }

function buildLevel(entryPrice, stopMultiple, targetMultiple, atr, reason) {
  let stop = entryPrice - stopMultiple * atr
  const target = entryPrice + targetMultiple * atr
  let { riskPct, rewardPct } = calculateRiskRewardPct(entryPrice, stop, target)

  const ceiling = RISK_CEILING_PCT[reason]
  if (riskPct > ceiling) {
    stop = entryPrice * (1 - ceiling / 100)
    riskPct = ceiling
    rewardPct = ((target - entryPrice) / entryPrice) * 100
  }

  return {
    stopPrice: stop,
    targetPrice: target,
    riskPct,
    rewardPct,
    rrRatio: calculateRRRatio(entryPrice, stop, target),
    reason,
  }
}

function calculateAtrStops(entryPrice, atr) {
  if (atr <= 0) {
    return {
      tight: createFixedPercentageLevel(entryPrice, 0.03, 0.12, 'edge_case_zero_atr'),
      normal: createFixedPercentageLevel(entryPrice, 0.04, 0.15, 'edge_case_zero_atr'),
      wide: createFixedPercentageLevel(entryPrice, 0.05, 0.25, 'edge_case_zero_atr'),
    }
  }

  return {
    tight: buildLevel(entryPrice, 1.0, 4.0, atr, 'atr_tight'),
    normal: buildLevel(entryPrice, 1.5, 3.0, atr, 'atr_normal'),
    wide: buildLevel(entryPrice, 2.0, 2.0, atr, 'atr_wide'),
  }
}

function checkSupportImpact(entryPrice, tight, normal, wide, supportPrice) {
  if (!supportPrice) return { recommended: 'normal', warning: null }

  if (supportPrice >= entryPrice) {
    return { recommended: 'tight', warning: '⚠️ Support is above entry — entry may be invalid' }
  }

  const supportDistancePct = ((entryPrice - supportPrice) / entryPrice) * 100

  if (tight.stopPrice < supportPrice) {
    if (normal.stopPrice >= supportPrice) {
      return { recommended: 'normal', warning: `⚠️ Tight stop below support (${supportDistancePct.toFixed(1)}%). Using normal.` }
    }
    return { recommended: 'wide', warning: `⚠️ Support very close (${supportDistancePct.toFixed(1)}%). Using wide stop.` }
  }

  if (supportDistancePct > 3) return { recommended: 'tight', warning: null }
  if (supportDistancePct > 1) return { recommended: 'normal', warning: null }
  return { recommended: 'wide', warning: `ℹ️ Support very close (${supportDistancePct.toFixed(2)}%). Consider wide stop.` }
}

/**
 * Calculate optimal stop loss and target levels from ATR, with optional
 * support-level validation. Mirrors stop_engine.py's calculate_optimal_levels().
 */
export function calculateOptimalLevels(entryPrice, atr, supportPrice = null, volatilityPct = 0.05) {
  if (entryPrice <= 0) throw new Error(`Entry price must be positive, got ${entryPrice}`)
  if (atr < 0) throw new Error(`ATR cannot be negative, got ${atr}`)
  if (supportPrice != null && supportPrice < 0) throw new Error(`Support price must be non-negative, got ${supportPrice}`)

  const { tight, normal, wide } = calculateAtrStops(entryPrice, atr)
  const { recommended, warning } = checkSupportImpact(entryPrice, tight, normal, wide, supportPrice)

  const levelToJSON = level => ({
    stop: round(level.stopPrice),
    target: round(level.targetPrice),
    risk_pct: round(level.riskPct),
    reward_pct: round(level.rewardPct),
    rr_ratio: round(level.rrRatio),
    reason: level.reason,
  })

  return {
    entry_price: round(entryPrice),
    atr: round(atr),
    support_price: supportPrice ? round(supportPrice) : null,
    volatility_pct: round(volatilityPct * 100),
    tight: levelToJSON(tight),
    normal: levelToJSON(normal),
    wide: levelToJSON(wide),
    recommended,
    warning,
  }
}
