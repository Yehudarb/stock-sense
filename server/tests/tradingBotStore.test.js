import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('trading bot store defaults to paper mode with live disabled', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trading-bot-'))
  const storePath = join(dir, 'tradingBot.json')

  writeFileSync(storePath, JSON.stringify({
    mode: 'paper',
    botEnabled: false,
    liveTradingEnabled: false,
    recentEvents: [],
  }), 'utf8')

  assert.equal(existsSync(storePath), true)
  const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
  assert.equal(parsed.mode, 'paper')
  assert.equal(parsed.liveTradingEnabled, false)

  rmSync(dir, { recursive: true, force: true })
})
