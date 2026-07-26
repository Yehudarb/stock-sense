// Multi-gate signal pipeline (inspired by stock-checker architecture)
// Gate 1: Trend Gate → Gate 2: Gradient Scoring → Gate 3: Confluence → Gate 4: Reversal → Final

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
function trendGate(price, sma50, sma200) {
  if (!sma50 || !sma200) return { regime: 'unknown', passed: true, strength: 50 }
  const aboveSma50  = price > sma50
  const aboveSma200 = price > sma200
  const smaOrder    = sma50 > sma200

  if (aboveSma50 && aboveSma200 && smaOrder)  return { regime: 'uptrend',  passed: true,  strength: 80 }
  if (!aboveSma50 && !aboveSma200 && !smaOrder) return { regime: 'downtrend', passed: false, strength: 20 }
  return { regime: 'sideways', passed: true, strength: 50 }
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

// A "bullish setup" is a strong continuation/reversal pattern that is either
// mid-formation (in the handle / base) or right at its breakout pivot. When one
// exists, indicator cooling INSIDE the setup is EXPECTED behavior (that IS the
// handle / pullback) — the analyst-brain read is "wait for the breakout / buy
// the breakout," never "sell because the handle is red." This function surfaces
// the strongest such setup so the main pipeline can suppress a knee-jerk SELL.
function findBullishSetup(patterns) {
  if (!Array.isArray(patterns) || !patterns.length) return null
  const eligibleKeys = new Set([
    'CUP_HANDLE', 'ASCENDING_TRIANGLE', 'BULLISH_FLAG', 'BULLISH_PENNANT',
    'FALLING_WEDGE', 'INVERSE_HEAD_SHOULDERS', 'DOUBLE_BOTTOM', 'TRIPLE_BOTTOM',
    'ROUNDED_BOTTOM', 'RECTANGLE_BULLISH', 'RETEST_AFTER_BREAKOUT',
  ])
  const candidates = patterns
    .filter(p => p.direction === 'bullish' && eligibleKeys.has(p.key) && p.weight >= 55)
    .filter(p => {
      const stage = p.meta?.stage
      if (stage) return ['in_handle', 'near_breakout', 'broken_out', 'cup_forming'].includes(stage)
      // Fallback for patterns without explicit stage: accept if we have a
      // breakoutLevel and current price isn't already far above it.
      return p.meta?.breakoutLevel != null
    })
    .sort((a, b) => b.weight - a.weight)
  return candidates[0] || null
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

  // Gate 1 — Trend
  const trend = trendGate(price, sma50, sma200)
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

  // ── SETUP OVERRIDE ──────────────────────────────────────────────────
  // If a strong bullish base/continuation pattern is in play, the "cooling"
  // indicators inside its handle/base are a FEATURE of the setup, not evidence
  // to sell. An analyst waits at the pivot; a naive engine sells the handle.
  // Rules:
  //   • Suppress SELL → SETUP_HOLD while the setup is intact and price still
  //     above the pattern's invalidation level.
  //   • Upgrade HOLD → BUY_SETUP once price is at or through the pivot.
  //   • Only invalidate the setup when price falls below invalidationLevel.
  const setup = findBullishSetup(patternResult.patterns)
  let setupInfo = null
  if (setup) {
    const invalidated = setup.meta?.invalidationLevel != null && price < setup.meta.invalidationLevel
    if (!invalidated) {
      const stage = setup.meta?.stage
      setupInfo = {
        key: setup.key,
        label: setup.label,
        stage: stage || 'developing',
        pivot: setup.meta?.breakoutLevel ?? null,
        target: setup.meta?.pivotTarget ?? setup.targetPrice ?? null,
        stopLoss: setup.meta?.invalidationLevel ?? null,
        distanceToBreakoutPct: setup.meta?.distanceToBreakoutPct ?? null,
        quality: setup.meta?.quality ?? null,
      }
      if (action === 'SELL' || action === 'STRONG_SELL') action = 'SETUP_HOLD'
      if (action === 'HOLD' && (stage === 'broken_out' || stage === 'near_breakout')) {
        action = 'BUY_SETUP'
      }
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
    setup: setupInfo, // null when no eligible bullish setup is active
    gates: {
      trend:       { ...trend },
      confluence:  { ...confluence },
      reversal:    { ...reversal },
    },
  }
}
