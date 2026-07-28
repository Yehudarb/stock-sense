import test from 'node:test'
import assert from 'node:assert/strict'
import {
  __resetStockAnalysisProTestConfig,
  __setStockAnalysisProTestConfig,
  runStockAnalysisPro,
  sanitizeAnalysisRequest,
} from '../services/stockAnalysisProRunner.js'

test('sanitizes stock analysis pro request with safe defaults', () => {
  const request = sanitizeAnalysisRequest({
    symbol: 'tsla',
    style: 'swing',
    account_size: 25_000,
    risk_percent: 1,
    target_min: 5,
    target_max: 12,
  })

  assert.equal(request.symbol, 'TSLA')
  assert.equal(request.style, 'swing')
  assert.equal(request.accountSize, 25_000)
  assert.equal(request.riskPercent, 1)
  assert.equal(request.targetMin, 5)
  assert.equal(request.targetMax, 12)
})

test('rejects invalid stock analysis pro symbols', () => {
  assert.throws(
    () => sanitizeAnalysisRequest({ symbol: 'TSLA; rm -rf /' }),
    /Invalid symbol/,
  )
})

test('passes sanitized request to injectable stock analysis pro runner', async () => {
  __setStockAnalysisProTestConfig({
    runner: async request => ({
      symbol: request.symbol,
      current_action: 'WAIT_FOR_BREAKOUT',
      position: {
        hasPosition: request.hasPosition,
        averageEntryPrice: request.averageEntryPrice,
        shares: request.shares,
        currentStop: request.currentStop,
      },
    }),
  })

  const result = await runStockAnalysisPro({
    symbol: 'aapl',
    has_position: true,
    average_entry_price: 100,
    shares: 50,
    current_stop: 95,
  })

  assert.equal(result.symbol, 'AAPL')
  assert.equal(result.current_action, 'WAIT_FOR_BREAKOUT')
  assert.equal(result.position.hasPosition, true)
  assert.equal(result.position.averageEntryPrice, 100)
  assert.equal(result.position.shares, 50)
  assert.equal(result.position.currentStop, 95)

  __resetStockAnalysisProTestConfig()
})
