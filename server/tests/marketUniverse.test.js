import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateStrength,
  MIN_ASSET_SIZE_USD,
  normalizeIndexSymbol,
  normalizeNasdaqStock,
  parseSp500ConstituentsCsv,
  SP500_INDEX_NAME,
  toYahooSymbol,
  validateSp500Constituents,
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

test('S&P 500 CSV parser preserves membership metadata and quoted names', () => {
  const csv = [
    'Symbol,Security,GICS Sector,GICS Sub-Industry',
    'AAPL,Apple Inc.,Information Technology,Technology Hardware',
    'BRK.B,"Berkshire Hathaway, Inc.",Financials,Multi-Sector Holdings',
  ].join('\n')

  const constituents = parseSp500ConstituentsCsv(csv)

  assert.equal(constituents.length, 2)
  assert.deepEqual(constituents[1], {
    indexSymbol: 'BRK.B',
    symbol: 'BRK-B',
    name: 'Berkshire Hathaway, Inc.',
    sector: 'Financials',
    industry: 'Multi-Sector Holdings',
  })
})

test('S&P share-class symbols are normalized for membership and Yahoo history', () => {
  assert.equal(normalizeIndexSymbol('BRK/B'), 'BRK.B')
  assert.equal(normalizeIndexSymbol('brk-b'), 'BRK.B')
  assert.equal(toYahooSymbol('BRK.B'), 'BRK-B')
  assert.equal(SP500_INDEX_NAME, 'S&P 500')
})

test('S&P 500 membership validation fails closed on an incomplete list', () => {
  assert.throws(
    () => validateSp500Constituents([{ indexSymbol: 'AAPL', symbol: 'AAPL', name: 'Apple' }]),
    /outside the safe range/,
  )

  const wrongUniverse = Array.from({ length: 503 }, (_, index) => ({
    indexSymbol: `T${index}`,
    symbol: `T${index}`,
    name: `Wrong ${index}`,
  }))
  assert.throws(() => validateSp500Constituents(wrongUniverse), /missing required anchors/)

  const anchors = ['AAPL', 'JPM', 'MSFT', 'SPGI', 'XOM']
  const complete = Array.from({ length: 503 }, (_, index) => ({
    indexSymbol: anchors[index] ?? `T${index}`,
    symbol: anchors[index] ?? `T${index}`,
    name: `Test ${index}`,
  }))
  assert.equal(validateSp500Constituents(complete), complete)
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
