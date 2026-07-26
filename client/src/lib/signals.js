// Multi-gate signal pipeline (inspired by stock-checker architecture)
// Gate 1: Trend Gate (structure-first) → Gate 2: Gradient Scoring →
// Gate 3: Confluence → Gate 4: Reversal → Setup Override → Final
import { analyzeMarketStructure, allowsBullishEntry, allowsBearishEntry } from './marketStructure'

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function logisticProbability(score, scale = 65) {
  if (!Number.isFinite(score)) return 50
  return Math.round((1 / (1 + Math.exp(-score / scale))) * 100)
}

// Linear gradient: 1.0 at oversold, 0.0 at overbought (for buy side)
function buyGradient(value, oversold, overbought) {
  if (value == null) return null
  if (value <= oversold)   return 1.0
  if (value >= overbought) return 0.0
  return 1.0 - (value - oversold) / (overbought - oversold)
}

// Linear gradient: 1.0 at overbought, 0.0 at oversold (for sell side)
function sellGradient(value, oversold, overbought) {
  if (value == null) return null
  if (value >= overbought) return 1.0
  if (value <= oversold)   return 0.0
  return (value - oversold) / (overbought - oversold)
}

// Sigmoid calibration → probability 0-100

// ── Gate 1: Trend / Regime ────────────────────────────────────────────────
// Market STRUCTURE (HH/HL vs LH/LL sequence) is the primary trend signal —
// SMAs only corroborate. A stock in a valid Cup & Handle handle is briefly
// below SMA20/50 but its structure is still bullish; the old SMA-only gate
// downgraded it to "sideways" and blocked bullish reads. The structure-aware
// gate keeps it as "uptrend" (weaker strength if SMAs disagree) and lets the
// setup override do its job.
function trendGate(price, sma50, sma200, structure) {
  const smaSays =
    (sma50 && sma200 && price > sma50 && sma50 > sma200) ? 'up'   :
    (sma50 && sma200 && price < sma50 && sma50 < sma200) ? 'down' : 'flat'

  // Structure is decisive when present.
  if (structure) {
    if (structure.trend === 'bullish') {
      // BOS up = trend is being actively confirmed → maximum strength.
      // CHoCH down = early warning; still passable but downgraded.
      let strength = 65
      if (smaSays === 'up')  strength += 15
      if (structure.bosDirection === 'up') strength += 10
      if (structure.chochDirection === 'down') strength = Math.max(50, strength - 20)
      return {
        regime: 'uptrend',
        passed: true,
        strength: Math.min(95, strength),
        source: 'structure',
        structureTrend: 'bullish',
        bos: structure.bosDirection,
        choch: structure.chochDirection,
      }
    }
    if (structure.trend === 'bearish') {
      // Bearish structure blocks bullish reads UNLESS a CHoCH up has fired —
      // the earliest evidence of a possible reversal, worth watching but not
      // yet fully passable. Also blocks the pipeline's BUY / STRONG_BUY.
      const passed = structure.chochDirection === 'up'
      return {
        regime: 'downtrend',
        passed,
        strength: passed ? 45 : 20,
        source: 'structure',
        structureTrend: 'bearish',
        bos: structure.bosDirection,
        choch: structure.chochDirection,
      }
    }
    // Consolidating: no directional trend. Passable but weak.
    return {
      regime: 'sideways',
      passed: true,
      strength: 50,
      source: 'structure',
      structureTrend: 'consolidating',
      bos: structure.bosDirection,
      choch: structure.chochDirection,
    }
  }

  // Fallback: legacy SMA-only classifier when structure data isn't available.
  if (!sma50 || !sma200) return { regime: 'unknown', passed: true, strength: 50, source: 'sma' }
  if (smaSays === 'up')   return { regime: 'uptrend',   passed: true,  strength: 80, source: 'sma' }
  if (smaSays === 'down') return { regime: 'downtrend', passed: false, strength: 20, source: 'sma' }
  return { regime: 'sideways', passed: true, strength: 50, source: 'sma' }
}

// ── Gate 3: Confluence ────────────────────────────────────────────────────
function confluenceCheck(gradients, minActive = 3) {
  const THRESHOLD = 0.55
  const active = gradients.filter(g => g != null && g >= THRESHOLD).length
  return { passed: active >= minActive, active, total: gradients.length, ratio: active / gradients.length }
}

// ── Gate 4: Reversal Confirmation ─────────────────────────────────────────
function reversalConfirm(ohlcv, volRatio) {
  const last  = ohlcv.length - 1
  const prev  = ohlcv[last - 1]
  const bullishtCandle = prev && prev.c > prev.o
  const highVolume     = volRatio?.[last] != null && volRatio[last] > 1.5
  if (bullishtCandle && highVolume) return { passed: true, trigger: 'both' }
  if (bullishtCandle)               return { passed: true, trigger: 'bullish_candle' }
  return { passed: false, trigger: null }
}

// Compute a stage on-the-fly for patterns whose detector didn't set one.
// The stage is the analyst-brain framing: where are we in the setup's life?
//  - developing    : too far from the pivot to be actionable yet
//  - in_handle     : pulled back from the last rally but pivot still overhead
//  - near_breakout : within ~2% of the pivot — the actionable zone
//  - broken_out    : trading above the pivot — thesis is confirmed
function inferStage(price, breakoutLevel, direction = 'bullish') {
  if (breakoutLevel == null || !Number.isFinite(breakoutLevel)) return 'developing'
  if (direction === 'bearish') {
    // Bearish: pivot is a support/neckline BELOW price. Breakout DOWN is the trigger.
    const dist = (price - breakoutLevel) / breakoutLevel // >0 while price still above pivot
    if (price <= breakoutLevel * 0.995) return 'broken_out'
    if (dist <= 0.02) return 'near_breakout'
    if (dist <= 0.08) return 'in_handle'
    return 'developing'
  }
  // Bullish (default): pivot is a resistance ABOVE price. Breakout UP is the trigger.
  const dist = (breakoutLevel - price) / breakoutLevel
  if (price >= breakoutLevel * 1.005) return 'broken_out'
  if (dist <= 0.02) return 'near_breakout'
  if (dist <= 0.08) return 'in_handle'
  return 'developing'
}

// A "bullish setup" is a strong continuation/reversal pattern that is either
// mid-formation (in the handle / base) or right at its breakout pivot. When one
// exists, indicator cooling INSIDE the setup is EXPECTED behavior (that IS the
// handle / pullback) — the analyst-brain read is "wait for the breakout / buy
// the breakout," never "sell because the handle is red." This function surfaces
// the strongest such setup so the main pipeline can suppress a knee-jerk SELL.
function findBullishSetup(patterns, price) {
  if (!Array.isArray(patterns) || !patterns.length) return null
  const eligibleKeys = new Set([
    'CUP_HANDLE', 'ASCENDING_TRIANGLE', 'BULLISH_FLAG', 'BULLISH_PENNANT',
    'FALLING_WEDGE', 'INVERSE_HEAD_SHOULDERS', 'DOUBLE_BOTTOM', 'TRIPLE_BOTTOM',
    'ROUNDED_BOTTOM', 'RECTANGLE_BULLISH', 'RETEST_AFTER_BREAKOUT',
    // Directional break of a converging triangle & standalone trendline break —
    // both are pivot-anchored bullish triggers the setup framework should honor.
    'SYMMETRICAL_TRIANGLE_BREAK_UP', 'TRENDLINE_BREAK_UP',
  ])
  const withStage = patterns
    .filter(p => p.direction === 'bullish' && eligibleKeys.has(p.key) && p.weight >= 55)
    .map(p => {
      const stage = p.meta?.stage || inferStage(price, p.meta?.breakoutLevel, 'bullish')
      return { ...p, meta: { ...p.meta, stage } }
    })
    .filter(p => ['in_handle', 'near_breakout', 'broken_out', 'cup_forming'].includes(p.meta.stage))
    .sort((a, b) => b.weight - a.weight)
  return withStage[0] || null
}

// Bearish mirror: a valid distribution / topping pattern deserves the same
// analyst treatment on the down side. Rising indicator readings inside a
// head-and-shoulders right shoulder look like BUY momentum but the pattern
// context says NO — the analyst waits for a break of the neckline and shorts /
// gets out. Suppress "BUY" out of a valid bearish setup, escalate HOLD → SELL_SETUP
// when the pattern breaks its pivot.
function findBearishSetup(patterns, price) {
  if (!Array.isArray(patterns) || !patterns.length) return null
  const eligibleKeys = new Set([
    'HEAD_SHOULDERS', 'DESCENDING_TRIANGLE', 'BEARISH_FLAG', 'BEARISH_PENNANT',
    'RISING_WEDGE', 'DOUBLE_TOP', 'TRIPLE_TOP', 'ROUNDED_TOP',
    'RECTANGLE_BEARISH', 'INVERSE_CUP_HANDLE',
    // Bearish mirror: symmetrical triangle breaking DOWN, uptrend line failing.
    'SYMMETRICAL_TRIANGLE_BREAK_DOWN', 'TRENDLINE_BREAK_DOWN',
  ])
  const withStage = patterns
    .filter(p => p.direction === 'bearish' && eligibleKeys.has(p.key) && p.weight <= -55)
    .map(p => {
      const stage = p.meta?.stage || inferStage(price, p.meta?.breakoutLevel, 'bearish')
      return { ...p, meta: { ...p.meta, stage } }
    })
    .filter(p => ['in_handle', 'near_breakout', 'broken_out', 'cup_forming', 'developing'].includes(p.meta.stage) && p.meta.stage !== 'developing')
    .sort((a, b) => a.weight - b.weight) // most bearish first (most negative weight)
  return withStage[0] || null
}

// ── Main ──────────────────────────────────────────────────────────────────
// Third arg accepts EITHER the legacy scalar patternScore (for callers we
// haven't migrated yet) OR the full detectPatterns() result — the object gives
// us the metadata needed for setup-override reasoning.
export function computeSignal(ohlcv, indicators, patternInput = 0) {
  if (!ohlcv?.length || !indicators) return null

  const patternResult = typeof patternInput === 'number'
    ? { score: patternInput, patterns: [], best: null }
    : (patternInput || { score: 0, patterns: [], best: null })
  const patternScore = patternResult.score || 0

  const last  = ohlcv.length - 1
  const price = ohlcv[last].c

  // Market structure is computed FIRST — every gate below reads through it.
  // The pivots-based HH/HL vs LH/LL sequence is a more honest read on trend
  // than SMA alignment (which lags and misreads pullbacks inside a trend).
  const structure = analyzeMarketStructure(ohlcv)

  const rsi      = indicators.rsi14[last]
  const stochK   = indicators.stoch.k[last]
  const willR    = indicators.willR[last]
  const bbUpper  = indicators.bb20.upper[last]
  const bbLower  = indicators.bb20.lower[last]
  const bbMid    = indicators.bb20.middle[last]
  const dcUpper  = indicators.donchian.upper[last]
  const dcLower  = indicators.donchian.lower[last]
  const macdLine = indicators.macd.line[last]
  const macdSig  = indicators.macd.signal[last]
  const macdPrev = indicators.macd.line[last - 1]
  const macdSigP = indicators.macd.signal[last - 1]
  const sma20    = indicators.sma20[last]
  const sma50    = indicators.sma50[last]
  const sma200   = indicators.sma200[last]
  const volRatio = indicators.volRatio

  // Gate 1 — Trend (structure-aware; SMAs are corroboration only)
  const trend = trendGate(price, sma50, sma200, structure)
  const factors = []

  // ── Buy-side gradient scores ──────────────────────────────────────────
  const rsiGrad    = buyGradient(rsi,    30,  70)
  const stochGrad  = buyGradient(stochK, 20,  80)
  // Williams %R: oversold = -80..-100, overbought = -20..0 → invert
  const willRBuy   = willR != null ? buyGradient(-willR, 20, 80) : null

  // Bollinger %B: price position within bands 0..1
  let bbPctB = null
  if (bbUpper != null && bbLower != null && bbUpper > bbLower)
    bbPctB = (price - bbLower) / (bbUpper - bbLower)
  const bbGrad = bbPctB != null ? buyGradient(bbPctB, 0.05, 0.95) : null

  // Donchian position: 0 = at lower band, 1 = at upper band
  let dcPos = null
  if (dcUpper != null && dcLower != null && dcUpper > dcLower)
    dcPos = (price - dcLower) / (dcUpper - dcLower)
  const dcGrad = dcPos != null ? buyGradient(dcPos, 0.1, 0.9) : null

  // MACD: fresh crossover = 1.0, above signal = 0.6, below = 0.0
  let macdGrad = null
  if (macdLine != null && macdSig != null) {
    const crossedUp = macdPrev != null && macdSigP != null && macdPrev < macdSigP && macdLine >= macdSig
    if (crossedUp)              macdGrad = 1.0
    else if (macdLine > macdSig) macdGrad = 0.6
    else                         macdGrad = 0.0
  }

  // Gate 3 — Confluence (are enough indicators aligned for buy?)
  const buyGradients = [rsiGrad, stochGrad, willRBuy, bbGrad, dcGrad, macdGrad].filter(g => g != null)
  const confluence   = confluenceCheck(buyGradients)
  const reversal     = reversalConfirm(ohlcv, volRatio)

  // ── Weighted gradient score ───────────────────────────────────────────
  const WEIGHTS = { rsi: 79, stoch: 76, willR: 72, bb: 78, dc: 74, macd: 75 }
  const MAX_BUY_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)

  let rawBuyScore = 0
  if (rsiGrad   != null) rawBuyScore += rsiGrad   * WEIGHTS.rsi
  if (stochGrad != null) rawBuyScore += stochGrad * WEIGHTS.stoch
  if (willRBuy  != null) rawBuyScore += willRBuy  * WEIGHTS.willR
  if (bbGrad    != null) rawBuyScore += bbGrad    * WEIGHTS.bb
  if (dcGrad    != null) rawBuyScore += dcGrad    * WEIGHTS.dc
  if (macdGrad  != null) rawBuyScore += macdGrad  * WEIGHTS.macd

  // Sell score = inverse
  const rawSellScore = MAX_BUY_SCORE - rawBuyScore

  // Volume amplifier
  const lastVolRatio = volRatio?.[last]
  const volAmp = lastVolRatio != null && lastVolRatio > 1.5 ? 1.2 : 1.0

  const buyScore  = parseFloat((rawBuyScore  * volAmp).toFixed(1))
  const sellScore = parseFloat((rawSellScore * volAmp).toFixed(1))

  // Pattern contribution (±75 per pattern)
  const patternAdj = clamp(patternScore * 0.5, -150, 150)

  const netScore  = buyScore - sellScore + patternAdj
  const BUY_THRESH  = 370 * volAmp
  const SELL_THRESH = 200 * volAmp

  // ── Gate-based final action ───────────────────────────────────────────
  let action
  if (buyScore >= BUY_THRESH && trend.passed && confluence.passed && reversal.passed) {
    action = buyScore >= BUY_THRESH * 1.2 ? 'STRONG_BUY' : 'BUY'
  } else if (sellScore >= SELL_THRESH) {
    action = sellScore >= SELL_THRESH * 1.2 ? 'STRONG_SELL' : 'SELL'
  } else {
    action = 'HOLD'
  }

  // Blocked by downtrend
  if (!trend.passed && (action === 'BUY' || action === 'STRONG_BUY')) action = 'HOLD'

  // Structural veto: never take a BUY when structure is bearish AND no CHoCH
  // up has fired, and never take a SELL when structure is bullish AND no CHoCH
  // down has fired. "Don't fight the trend" is more important than any single
  // indicator reading.
  if ((action === 'BUY' || action === 'STRONG_BUY') && !allowsBullishEntry(structure)) action = 'HOLD'
  if ((action === 'SELL' || action === 'STRONG_SELL') && !allowsBearishEntry(structure)) action = 'HOLD'

  // ── SETUP OVERRIDE ──────────────────────────────────────────────────
  // Analyst-brain framing: if a strong base/continuation pattern is in play,
  // the "cooling" (bullish setup) or "warming" (bearish setup) inside it is a
  // FEATURE of the pattern, not evidence to trade against it. The engine now
  // treats bullish AND bearish setups symmetrically.
  //
  // Bullish setup (cup, IH&S, base, ascending triangle, bull flag, …):
  //   • SELL / STRONG_SELL → SETUP_HOLD  while price is above invalidationLevel
  //   • HOLD → BUY_SETUP  at pivot break (broken_out or near_breakout)
  //
  // Bearish setup (H&S, descending triangle, bear flag, double top, …):
  //   • BUY / STRONG_BUY → SETUP_AVOID  while price is below invalidationLevel
  //   • HOLD → SELL_SETUP  at pivot break down (broken_out or near_breakout)
  const bullSetup = findBullishSetup(patternResult.patterns, price)
  const bearSetup = findBearishSetup(patternResult.patterns, price)
  let setupInfo = null

  if (bullSetup) {
    const invalidated = bullSetup.meta?.invalidationLevel != null && price < bullSetup.meta.invalidationLevel
    if (!invalidated) {
      const stage = bullSetup.meta?.stage
      setupInfo = {
        direction: 'bullish',
        key: bullSetup.key,
        label: bullSetup.label,
        stage: stage || 'developing',
        pivot: bullSetup.meta?.breakoutLevel ?? null,
        target: bullSetup.meta?.pivotTarget ?? bullSetup.targetPrice ?? null,
        stopLoss: bullSetup.meta?.invalidationLevel ?? null,
        distanceToBreakoutPct: bullSetup.meta?.distanceToBreakoutPct ?? null,
        quality: bullSetup.meta?.quality ?? null,
      }
      if (action === 'SELL' || action === 'STRONG_SELL') action = 'SETUP_HOLD'
      if (action === 'HOLD' && (stage === 'broken_out' || stage === 'near_breakout')) action = 'BUY_SETUP'
    }
  } else if (bearSetup) {
    const invalidated = bearSetup.meta?.invalidationLevel != null && price > bearSetup.meta.invalidationLevel
    if (!invalidated) {
      const stage = bearSetup.meta?.stage
      setupInfo = {
        direction: 'bearish',
        key: bearSetup.key,
        label: bearSetup.label,
        stage: stage || 'developing',
        pivot: bearSetup.meta?.breakoutLevel ?? null,
        target: bearSetup.meta?.pivotTarget ?? bearSetup.targetPrice ?? null,
        stopLoss: bearSetup.meta?.invalidationLevel ?? null,
        distanceToBreakoutPct: bearSetup.meta?.distanceToBreakoutPct ?? null,
        quality: bearSetup.meta?.quality ?? null,
      }
      if (action === 'BUY' || action === 'STRONG_BUY') action = 'SETUP_AVOID'
      if (action === 'HOLD' && (stage === 'broken_out' || stage === 'near_breakout')) action = 'SELL_SETUP'
    }
  }

  const buyProbability  = logisticProbability(netScore)
  const sellProbability = 100 - buyProbability
  const confidence      = Math.min(100, Math.round((Math.abs(netScore) / (MAX_BUY_SCORE * 1.5)) * 100))

  // ── Factor list for UI ────────────────────────────────────────────────
  if (rsi != null) {
    const sig = rsiGrad >= 0.6 ? 'BUY' : rsiGrad <= 0.3 ? 'SELL' : 'HOLD'
    factors.push({ label: 'RSI (14)', signal: sig, value: rsi.toFixed(1) })
  }
  if (stochK != null) {
    const sig = stochGrad >= 0.6 ? 'BUY' : stochGrad <= 0.3 ? 'SELL' : 'HOLD'
    factors.push({ label: 'Stochastic %K', signal: sig, value: stochK.toFixed(1) })
  }
  if (willR != null) {
    const sig = willRBuy >= 0.6 ? 'BUY' : willRBuy <= 0.3 ? 'SELL' : 'HOLD'
    factors.push({ label: 'Williams %R', signal: sig, value: willR.toFixed(1) })
  }
  if (macdLine != null && macdSig != null) {
    const sig = macdGrad >= 0.6 ? 'BUY' : macdGrad <= 0.3 ? 'SELL' : 'HOLD'
    factors.push({ label: 'MACD', signal: sig, value: (macdLine - macdSig).toFixed(4) })
  }
  if (bbPctB != null) {
    const sig = bbGrad >= 0.6 ? 'BUY' : bbGrad <= 0.3 ? 'SELL' : 'HOLD'
    factors.push({ label: 'Bollinger %B', signal: sig, value: (bbPctB * 100).toFixed(0) + '%' })
  }
  if (dcPos != null) {
    const sig = dcGrad >= 0.6 ? 'BUY' : dcGrad <= 0.3 ? 'SELL' : 'HOLD'
    factors.push({ label: 'Donchian', signal: sig, value: (dcPos * 100).toFixed(0) + '%' })
  }
  if (sma20 != null) {
    const d = ((price - sma20) / sma20 * 100).toFixed(1)
    factors.push({ label: 'מרחק SMA20', signal: parseFloat(d) < -2 ? 'BUY' : parseFloat(d) > 2 ? 'SELL' : 'HOLD', value: (d >= 0 ? '+' : '') + d + '%' })
  }
  if (lastVolRatio != null) {
    factors.push({ label: 'Volume Ratio', signal: lastVolRatio > 1.5 ? 'BUY' : 'HOLD', value: lastVolRatio.toFixed(2) + 'x' })
  }

  return {
    action,
    score:           parseFloat(netScore.toFixed(1)),
    buyScore,
    sellScore,
    buyProbability,
    sellProbability,
    confidence,
    factors,
    setup: setupInfo,       // null when no eligible bullish setup is active
    structure: structure,   // pivot-based HH/HL sequence, BOS / CHoCH events
    gates: {
      trend:       { ...trend },
      confluence:  { ...confluence },
      reversal:    { ...reversal },
    },
  }
}
