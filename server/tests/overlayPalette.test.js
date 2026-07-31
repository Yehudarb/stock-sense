import test from 'node:test'
import assert from 'node:assert/strict'

import { OVERLAY_COLORS } from '../../client/src/components/charts/chartHelpers.js'

// Pairs that are one instrument with two edges, or two names for one line.
// Everything else sharing a colour is a defect: two overlays drawn identically
// cannot be told apart on the chart, and the legend names both the same.
const INTENTIONAL_SHARES = [
  ['bbUpper', 'bbLower'],
  ['keltnerUpper', 'keltnerLower'],
  ['donchianUpper', 'donchianLower'],
  ['prevHigh', 'previousHigh'],
  ['prevLow', 'previousLow'],
  ['supertrendUp', 'supertrend'],
].map(pair => pair.slice().sort().join('|'))

test('every overlay has its own colour', () => {
  const byColour = {}
  for (const [key, colour] of Object.entries(OVERLAY_COLORS)) {
    ;(byColour[colour] ??= []).push(key)
  }
  const collisions = Object.entries(byColour)
    .filter(([, keys]) => keys.length > 1)
    .filter(([, keys]) => !INTENTIONAL_SHARES.includes(keys.slice().sort().join('|')))
    .map(([colour, keys]) => `${colour}: ${keys.join(', ')}`)

  assert.deepEqual(collisions, [], `overlays sharing a colour:\n  ${collisions.join('\n  ')}`)
})

// The legend reads this map and the chart draws from it. When they were two
// maps every shared key disagreed — SMA50 yellow in the legend, blue on the
// chart — so a missing key is not cosmetic: it renders a swatch with no colour.
test('every colour is a usable CSS value', () => {
  for (const [key, colour] of Object.entries(OVERLAY_COLORS)) {
    assert.match(colour, /^(#[0-9a-fA-F]{6}|rgba?\([\d\s.,]+\))$/, `${key} is not a colour: ${colour}`)
  }
})

test('the moving averages the chart draws are all present', () => {
  for (const key of ['sma20', 'sma50', 'sma100', 'sma150', 'sma200', 'ema20', 'ema50', 'ema200']) {
    assert.ok(OVERLAY_COLORS[key], `missing palette entry for ${key}`)
  }
})
