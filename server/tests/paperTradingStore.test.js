import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  __resetPaperTradingTestConfig,
  __setPaperTradingTestConfig,
  closePaperPosition,
  createPaperOrder,
  getPaperAccount,
  resetPaperAccount,
  updatePaperTradingSettings,
} from '../services/paperTradingStore.js'

function createHarness() {
  const dir = mkdtempSync(join(tmpdir(), 'paper-trading-'))
  const storePath = join(dir, 'paperTrading.json')
  const prices = new Map()
  let currentTime = new Date('2026-06-08T10:00:00.000Z')

  __setPaperTradingTestConfig({
    storePath,
    now: () => currentTime,
    snapshotResolver: async ticker => ({
      price: prices.get(ticker),
      timestamp: currentTime.toISOString(),
      ticker,
    }),
  })

  return {
    setPrice(ticker, price) {
      prices.set(ticker, price)
    },
    setTime(iso) {
      currentTime = new Date(iso)
    },
    cleanup() {
      __resetPaperTradingTestConfig()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('rejects long stop loss above entry', async () => {
  const harness = createHarness()
  harness.setPrice('AAPL', 100)
  await resetPaperAccount()

  await assert.rejects(
    () => createPaperOrder({
      ticker: 'AAPL',
      side: 'long',
      orderType: 'market',
      quantity: 10,
      stopLoss: 101,
      takeProfit: 110,
    }),
    /Long stop loss must be below entry price/,
  )

  harness.cleanup()
})

test('rejects short order when short selling disabled', async () => {
  const harness = createHarness()
  harness.setPrice('TSLA', 200)
  await resetPaperAccount()
  await updatePaperTradingSettings({ shortSellingEnabled: false })

  await assert.rejects(
    () => createPaperOrder({
      ticker: 'TSLA',
      side: 'short',
      orderType: 'market',
      quantity: 5,
      stopLoss: 210,
      takeProfit: 180,
    }),
    /Short selling is disabled/,
  )

  harness.cleanup()
})

test('keeps limit order pending until price crosses and then fills it', async () => {
  const harness = createHarness()
  harness.setPrice('MSFT', 110)
  await resetPaperAccount()

  let account = await createPaperOrder({
    ticker: 'MSFT',
    side: 'long',
    orderType: 'limit',
    quantity: 20,
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 112,
  })

  assert.equal(account.pendingOrders.length, 1)
  assert.equal(account.openPositions.length, 0)

  harness.setPrice('MSFT', 99)
  account = await getPaperAccount()

  assert.equal(account.pendingOrders.length, 0)
  assert.equal(account.openPositions.length, 1)
  assert.equal(account.openPositions[0].ticker, 'MSFT')

  harness.cleanup()
})

test('auto closes an open position when stop loss is hit', async () => {
  const harness = createHarness()
  harness.setPrice('NVDA', 120)
  await resetPaperAccount()

  await createPaperOrder({
    ticker: 'NVDA',
    side: 'long',
    orderType: 'market',
    quantity: 10,
    stopLoss: 115,
    takeProfit: 135,
  })

  harness.setPrice('NVDA', 114)
  const account = await getPaperAccount()

  assert.equal(account.openPositions.length, 0)
  assert.equal(account.closedTrades.length, 1)
  assert.equal(account.closedTrades[0].exitReason, 'stop_loss')

  harness.cleanup()
})

test('manual close updates equity and realized pnl for short trade', async () => {
  const harness = createHarness()
  harness.setPrice('AMD', 100)
  await resetPaperAccount()

  let account = await createPaperOrder({
    ticker: 'AMD',
    side: 'short',
    orderType: 'market',
    quantity: 10,
    stopLoss: 106,
    takeProfit: 90,
  })

  assert.equal(account.openPositions.length, 1)

  harness.setPrice('AMD', 92)
  account = await closePaperPosition(account.openPositions[0].id)

  assert.equal(account.openPositions.length, 0)
  assert.equal(account.closedTrades.length, 1)
  assert.ok(account.closedTrades[0].realizedPnl > 0)

  harness.cleanup()
})

test('locks new orders after daily loss threshold is breached', async () => {
  const harness = createHarness()
  harness.setPrice('QQQ', 100)
  await resetPaperAccount()
  await updatePaperTradingSettings({ maxDailyLossPct: 0.2 })

  let account = await createPaperOrder({
    ticker: 'QQQ',
    side: 'long',
    orderType: 'market',
    quantity: 40,
    stopLoss: 95,
    takeProfit: 110,
  })

  harness.setPrice('QQQ', 95)
  account = await getPaperAccount()
  assert.equal(account.closedTrades.length, 1)

  harness.setPrice('SPY', 500)
  await assert.rejects(
    () => createPaperOrder({
      ticker: 'SPY',
      side: 'long',
      orderType: 'market',
      quantity: 1,
      stopLoss: 495,
      takeProfit: 510,
    }),
    /Daily loss limit reached/,
  )

  harness.cleanup()
})
