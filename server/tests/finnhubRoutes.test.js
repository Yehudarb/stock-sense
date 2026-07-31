import test from 'node:test'
import assert from 'node:assert/strict'

// The service reads the env at import time, so clear it before importing.
delete process.env.FINNHUB_API_KEY
const { requireFinnhub } = await import('../routes/finnhub.js')

// Minimal express-shaped double. Testing the guard directly avoids binding a
// port and avoids depending on express resolving from this directory.
function fakeRes() {
  const res = { statusCode: null, payload: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.payload = body; return res }
  return res
}

// A 404 on an unconfigured service is a lie: it says the TICKER has no profile
// when the deployment has no API key. Production logged "Profile not found" for
// TSLA, a symbol that plainly exists, and a caller could not tell a bad symbol
// from a missing dependency.
test('an unconfigured deployment reports the dependency, not a missing ticker', () => {
  const res = fakeRes()
  let passedThrough = false
  requireFinnhub({}, res, () => { passedThrough = true })

  assert.equal(passedThrough, false, 'the request must not reach the fetchers')
  assert.equal(res.statusCode, 503, '503 says the service is unavailable; 404 would blame the ticker')
  assert.equal(res.payload.configured, false)
  assert.match(res.payload.error, /not configured/i)
})

test('the reason names the variable that fixes it', () => {
  const res = fakeRes()
  requireFinnhub({}, res, () => {})
  assert.match(res.payload.detail, /FINNHUB_API_KEY/)
})
