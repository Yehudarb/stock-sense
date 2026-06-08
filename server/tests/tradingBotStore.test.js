import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { __resetPaperTradingTestConfig, __setPaperTradingTestConfig, resetPaperAccount } from '../services/paperTradingStore.js'
import {
  __resetTradingBotTestConfig,
  __setTradingBotTestConfig,
  executeAutoPaperCycle,
  getTradingBotState,
  updateTradingBotSettings,
} from '../services/tradingBotStore.js'

function createHarness() {
  const dir = mkdtempSync(join(tmpdir(), 'trading-bot-'))
  const paperStorePath = join(dir, 'paperTrading.json')
  const botStorePath = join(dir, 'tradingBot.json')
  const prices = new Map()
  let currentTime = new Date('2026-06-08T10:00:00.000Z')

  __setPaperTradingTestConfig({
    storePath: paperStorePath,
    now: () => currentTime,
    snapshotResolver: async ticker => ({
      price: prices.get(ticker),
      timestamp: currentTime.toISOString(),
      ticker,
    }),
  })
  __setTradingBotTestConfig({ storePath: botStorePath })

  return {
    setPrice(ticker, price) {
      prices.set(ticker, price)
    },
    setTime(iso) {
      currentTime = new Date(iso)
    },
    cleanup() {
      __resetPaperTradingTestConfig()
      __resetTradingBotTestConfig()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('trading bot store defaults to paper mode with live disabled', async () => {
  const harness = createHarness()
  const state = getTradingBotState()

  assert.equal(state.mode, 'paper')
  assert.equal(state.liveTradingEnabled, false)
  assert.equal(state.botEnabled, false)

  harness.cleanup()
})

test('auto paper bot opens a demo long trade when enabled and signal is bullish', async () => {
  const harness = createHarness()
  harness.setPrice('AAPL', 100)
  await resetPaperAccount()
  updateTradingBotSettings({
    botEnabled: true,
    mode: 'paper',
    cooldownMinutes: 30,
    maxRiskPerTradePct: 1,
  })

  const result = await executeAutoPaperCycle({
    ticker: 'AAPL',
    snapshot: { price: 100 },
    decision: {
      action: 'BUY',
      currentPrice: 100,
      invalidation: 98,
      takeProfit: 106,
    },
  })

  assert.equal(result.action, 'opened')
  assert.equal(result.account.openPositions.length, 1)
  assert.equal(result.account.openPositions[0].ticker, 'AAPL')
  assert.equal(result.account.openPositions[0].side, 'long')

  harness.cleanup()
})

test('auto paper bot closes an existing position when the signal flips', async () => {
  const harness = createHarness()
  harness.setPrice('TSLA', 200)
  await resetPaperAccount()
  updateTradingBotSettings({
    botEnabled: true,
    mode: 'paper',
    cooldownMinutes: 1,
    maxRiskPerTradePct: 1,
  })

  await executeAutoPaperCycle({
    ticker: 'TSLA',
    snapshot: { price: 200 },
    decision: {
      action: 'BUY',
      currentPrice: 200,
      invalidation: 196,
      takeProfit: 208,
    },
  })

  harness.setTime('2026-06-08T10:02:00.000Z')
  harness.setPrice('TSLA', 201)
  const result = await executeAutoPaperCycle({
    ticker: 'TSLA',
    snapshot: { price: 201 },
    decision: {
      action: 'SELL',
      currentPrice: 201,
      invalidation: 204,
      takeProfit: 194,
    },
  })

  assert.equal(result.action, 'closed')
  assert.equal(result.account.openPositions.length, 0)
  assert.equal(result.account.closedTrades.length, 1)
  assert.equal(result.account.closedTrades[0].ticker, 'TSLA')

  harness.cleanup()
})
