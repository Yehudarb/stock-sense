import test from 'node:test'
import assert from 'node:assert/strict'
import { computeRisk } from '../../client/src/lib/riskManagement.js'
import { computeAnalystDecision } from '../../client/src/lib/analystDecision.js'
import { computeProfessionalFeatures } from '../../client/src/lib/professionalFeatures.js'
import { buildPlainVerdict } from '../../client/src/lib/plainVerdict.js'

function series(length, value) {
  return Array.from({ length }, () => value)
}

test('risk engine enforces target and stop bounds', () => {
  const bars = Array.from({ length: 40 }, (_, index) => ({
    t: index,
    o: 100,
    h: 101,
    l: 99,
    c: 100,
    v: 1_000_000,
  }))
  const risk = computeRisk(bars, { atr14: series(40, 1), vwap: series(40, 100) })

  assert.equal(risk.riskPct, 2.5)
  assert.equal(risk.rewardPct, 5)
  assert.equal(risk.rrRatio, 2)
  assert.equal(risk.tradeValid, true)
})

test('analyst decision blocks a long entry when nearby resistance leaves less than 5 percent', () => {
  const bars = Array.from({ length: 40 }, (_, index) => ({
    t: index,
    o: 99,
    h: 100,
    l: 97,
    c: index === 39 ? 100 : 99,
    v: 1_000_000,
  }))
  const indicators = {
    atr14: series(40, 2),
    sma20: series(40, 99),
    sma50: series(40, 98),
    sma200: series(40, 95),
    rsi14: series(40, 55),
    macd: { line: series(40, 1), signal: series(40, 0.8) },
    volRatio: series(40, 1),
  }
  const signal = {
    action: 'BUY',
    confidence: 72,
    score: 20,
    pro: {
      supportResistance: { nearestSupport: 96, nearestResistance: 103, breakoutUp: false },
      professional: { confluencePct: 65 },
      gaps: {},
    },
    patterns: { best: null },
    gates: { trend: { regime: 'uptrend' }, confluence: { active: 4, total: 6 } },
  }
  const risk = computeRisk(bars, indicators, { nearestSupport: 96 })
  const decision = computeAnalystDecision(bars, indicators, signal, risk)

  assert.equal(decision.requestedAction, 'BUY')
  assert.equal(decision.action, 'HOLD')
  assert.equal(decision.entryApproved, false)
  assert.equal(decision.entryLow, null)
})

test('professional breakout compares the close with the prior range', () => {
  const bars = Array.from({ length: 40 }, (_, index) => ({
    t: index,
    o: 99,
    h: index === 39 ? 102 : 100,
    l: 97,
    c: index === 39 ? 101 : 99,
    v: 1_000_000,
  }))
  const indicators = {
    rsi14: series(40, 58),
    atr14: series(40, 2),
    ema20: series(40, 99),
    ema50: series(40, 97),
    adx: { adx: series(40, 28) },
  }
  const result = computeProfessionalFeatures(bars, indicators, { score: 20 })

  assert.equal(result.supportResistance.recentHigh, 100)
  assert.equal(result.supportResistance.breakoutUp, true)
  assert.equal(result.marketRegime.regime, 'TRENDING')
  assert.equal(result.marketRegime.direction, 'BULLISH')
})

test('confirmed Cup & Handle breakout is not described as if no breakout exists', () => {
  const decision = {
    action: 'SELL',
    tone: 'bearish',
    signalStrength: 42,
    invalidation: 368.79,
    cupHandleBreakout: true,
    cupHandle: {
      stage: 'broken_out',
      pivot: 389.99,
      stopLoss: 367.67,
      breakoutVolumeRatio: 2.31,
    },
  }

  const verdict = buildPlainVerdict({ decision, checklist: { score: 7 }, language: 'he' })

  assert.match(verdict, /פריצת Cup & Handle מאושרת/)
  assert.match(verdict, /אינו מאשר כניסה חדשה/)
  assert.match(verdict, /368\.79/)
  assert.doesNotMatch(verdict, /הלחץ השלילי גובר על הסיכוי/)
})
