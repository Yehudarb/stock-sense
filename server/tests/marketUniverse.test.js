import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateStrength,
  MIN_ASSET_SIZE_USD,
  normalizeNasdaqStock,
  normalizeYahooFund,
} from '../services/marketUniverse.js'

function history(length, valueAt) {
  return {
    timestamps: Array.from({ length }, (_, index) => Date.UTC(2025, 0, 1 + index)),
    closes: Array.from({ length }, (_, index) => valueAt(index)),
  }
}

test('stock universe requires at least two billion dollars of market cap', () => {
  const base = {
    symbol: 'TEST', name: 'Test Corporation Common Stock', lastsale: '$50.00',
    volume: '1000000', pctchange: '1.2%', sector: 'Technology', marketCap: String(MIN_ASSET_SIZE_USD),
  }

  const accepted = normalizeNasdaqStock(base)
  const rejected = normalizeNasdaqStock({ ...base, marketCap: String(MIN_ASSET_SIZE_USD - 1) })

  assert.equal(accepted.symbol, 'TEST')
  assert.equal(accepted.sizeMetric, 'marketCap')
  assert.equal(accepted.dollarVolume, 50_000_000)
  assert.equal(rejected, null)
})

test('warrants and units are excluded from the common-stock universe', () => {
  const row = {
    symbol: 'TESTW', name: 'Test Corporation Warrants', lastsale: '$12',
    volume: '500000', marketCap: '4000000000',
  }
  assert.equal(normalizeNasdaqStock(row), null)
})

test('ETF size is measured by net assets rather than market cap', () => {
  const fund = normalizeYahooFund({
    symbol: 'FUND', shortName: 'Large Fund ETF', netAssets: 3_500_000_000,
    regularMarketPrice: 100, averageDailyVolume3Month: 600_000,
  })

  assert.equal(fund.assetType, 'etf')
  assert.equal(fund.sizeMetric, 'netAssets')
  assert.equal(fund.sizeValue, 3_500_000_000)
  assert.equal(fund.dollarVolume, 60_000_000)
})

test('strength score rewards aligned long-term momentum and liquidity', () => {
  const benchmark = calculateStrength(history(320, index => 100 + index * 0.12))
  const strong = calculateStrength(
    history(320, index => 80 + index * 0.32),
    benchmark,
    { dollarVolume: 75_000_000 },
  )
  const weak = calculateStrength(
    history(320, index => 220 - index * 0.35),
    benchmark,
    { dollarVolume: 75_000_000 },
  )

  assert.ok(strong.score >= 75)
  assert.equal(strong.aligned, true)
  assert.ok(strong.relative6m > 0)
  assert.ok(weak.score < 40)
  assert.equal(weak.above200, false)
})

test('strength remains unavailable without a 200-session history', () => {
  assert.equal(calculateStrength(history(199, index => 100 + index)), null)
})
