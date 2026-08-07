import test from 'node:test'
import assert from 'node:assert/strict'

import { detectCupHandlePattern } from '../../client/src/lib/patterns.js'
import { buildCupCandidate, scoreCupSetup } from '../services/cupHandleScanner.js'

const cup = {
  key: 'CUP_HANDLE',
  label: 'Cup and Handle',
  weight: 82,
  direction: 'bullish',
  status: 'developing',
  targetPrice: 128,
  meta: {
    quality: 0.8,
    stage: 'near_breakout',
    breakoutLevel: 112,
    pivotTarget: 128,
    invalidationLevel: 104,
    distanceToBreakoutPct: 0.01,
    breakoutVolumeRatio: 1.3,
    handleVolumeRatio: 0.82,
    handleVolumeContracting: true,
    breakoutConfirmed: false,
    cupBars: 72,
    handleBars: 18,
  },
}

const asset = {
  symbol: 'TEST', indexSymbol: 'TEST', name: 'Test Corporation', assetType: 'stock', sector: 'Technology',
  indexMembership: 'S&P 500',
  source: 'S&P 500 constituents + Nasdaq',
  sizeValue: 12_000_000_000, sizeMetric: 'marketCap', dollarVolume: 80_000_000,
  strength: {
    score: 78,
    return3m: 0.12,
    return6m: 0.24,
    return12m: 0.35,
    relative6m: 0.08,
    distanceFromHighPct: -4.2,
  },
}

test('Cup setup score rewards a high-quality near-breakout pattern', () => {
  const score = scoreCupSetup(cup, 110)
  assert.ok(score >= 75)
  assert.ok(score <= 100)
})

test('Cup detector accepts a confirmed breakout candle after the handle', () => {
  const bars = Array.from({ length: 80 }, (_, index) => {
    let close
    if (index < 11) close = 100
    else if (index <= 30) close = 100 - ((index - 10) / 20) * 20
    else if (index <= 57) close = 80 + ((index - 30) / 27) * 20
    else if (index < 68) close = 100
    else if (index < 71) close = 99 - (index - 68)
    else if (index < 79) close = 98
    else close = 103

    return {
      t: Date.UTC(2025, 0, index + 1),
      o: close,
      h: close + (index === 79 ? 1 : 0.2),
      l: close - 0.2,
      c: close,
      v: index === 79 ? 200 : 100,
    }
  })

  const detected = detectCupHandlePattern(bars)

  assert.equal(detected?.meta?.stage, 'broken_out')
  assert.equal(detected?.meta?.breakoutConfirmed, true)
  assert.ok(detected.meta.breakoutVolumeRatio >= 1.2)
})

test('scanner candidate preserves size, strength and deterministic trade levels', () => {
  const bars = Array.from({ length: 160 }, (_, index) => ({
    t: Date.UTC(2025, 0, index + 1), o: 100, h: 112, l: 98, c: index === 159 ? 110 : 100, v: 1_000_000,
  }))
  const candidate = buildCupCandidate(asset, cup, bars)

  assert.equal(candidate.ticker, 'TEST')
  assert.equal(candidate.indexMembership, 'S&P 500')
  assert.equal(candidate.sizeValue, 12_000_000_000)
  assert.equal(candidate.sizeMetric, 'marketCap')
  assert.equal(candidate.strengthScore, 78)
  assert.equal(candidate.pivot, 112)
  assert.equal(candidate.target, 128)
  assert.equal(candidate.stopLoss, 104)
  assert.equal(candidate.upsidePct, 16.36)
  assert.ok(candidate.opportunityScore > 0)
  assert.equal(candidate.provider, 'S&P 500 constituents + Nasdaq + Yahoo Finance')
  assert.ok(Number.isFinite(candidate.technicalMethodScore))
  assert.equal(candidate.pattern, 'cup_and_handle')
  assert.equal(candidate.patternStatus, 'breakout_pending')
  assert.equal(candidate.longTermTrendStatus, 'insufficient_history')
  assert.equal(candidate.setupStatus, 'not_ready')
  assert.ok('riskReward' in candidate)
  assert.ok('lastUpdated' in candidate)
})

test('scanner refuses a pattern from an asset outside the S&P 500', () => {
  const bars = [{ t: Date.UTC(2025, 0, 1), o: 100, h: 112, l: 98, c: 110, v: 1_000_000 }]
  const candidate = buildCupCandidate({ ...asset, indexMembership: null }, cup, bars)

  assert.equal(candidate, null)
})
