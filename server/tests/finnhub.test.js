import test from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'

// The module reads FINNHUB_API_KEY at import time, so the environment has to be
// set before the dynamic import below. node --test gives each file its own
// process, so clearing it here cannot leak into other suites.
delete process.env.FINNHUB_API_KEY

const finnhub = await import('../services/finnhub.js')

test('reports itself as unconfigured when no key is present', () => {
  assert.equal(finnhub.isConfigured(), false)
})

test('returns the same empty shapes a failed call would, so callers are unaffected', async () => {
  assert.deepEqual(await finnhub.fetchCompanyNews('TSLA'), [])
  assert.equal(await finnhub.fetchCompanyProfile('TSLA'), null)
  assert.equal(await finnhub.fetchQuote('TSLA'), null)
})

// The point of the change: without a key the request cannot succeed, so it
// should never be sent. Previously each call went out, came back 401, and
// logged an error — once per ticker, per page load.
test('sends no HTTP request at all when unconfigured', async () => {
  const realGet = axios.get
  let calls = 0
  axios.get = async (...args) => { calls += 1; return realGet(...args) }
  try {
    await finnhub.fetchCompanyNews('TSLA')
    await finnhub.fetchCompanyProfile('TSLA')
    await finnhub.fetchQuote('TSLA')
    assert.equal(calls, 0, 'expected zero HTTP attempts without an API key')
  } finally {
    axios.get = realGet
  }
})
