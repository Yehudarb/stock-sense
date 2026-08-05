import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCupCandidate, scoreCupSetup } from '../services/cupHandleScanner.js'

const cup = {
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
})

test('scanner refuses a pattern from an asset outside the S&P 500', () => {
  const bars = [{ t: Date.UTC(2025, 0, 1), o: 100, h: 112, l: 98, c: 110, v: 1_000_000 }]
  const candidate = buildCupCandidate({ ...asset, indexMembership: null }, cup, bars)

  assert.equal(candidate, null)
})
