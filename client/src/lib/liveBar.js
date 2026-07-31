// Folds a live tick into the last loaded bar.
//
// The socket already carried a live price, but it only reached the header:
// indicators, signals, patterns and levels all derive from `ohlcv`, which a
// tick never touched. So the number at the top of the page moved while the
// analysis underneath it stayed frozen at page load — and price could cross a
// breakout level drawn on the chart without the pattern ever updating.
//
// Merging the tick into the last bar makes the whole chain live, because
// everything downstream already recomputes from `ohlcv`.
//
// What this must not do is invent data. A tick is a quote for the CURRENT
// session; writing it into a bar that belongs to an earlier period would
// silently corrupt history.

// Intervals whose bar covers a whole session, so the tick's cumulative session
// volume is the bar's volume. On anything shorter the tick's volume is the
// day's running total and belongs to no single bar.
const SESSION_INTERVALS = new Set(['1d', '1mo', '1y', '5y'])

function sameDay(a, b) {
  const x = new Date(a)
  const y = new Date(b)
  return x.getUTCFullYear() === y.getUTCFullYear()
    && x.getUTCMonth() === y.getUTCMonth()
    && x.getUTCDate() === y.getUTCDate()
}

/**
 * @param {Array}  bars     loaded OHLCV, oldest first
 * @param {Object} tick     { price, volume, timestamp }
 * @param {string} interval the interval `bars` was fetched at
 * @returns {Array} a new array when the tick applies, the SAME array otherwise
 *                  so React can skip the render
 */
export function mergeTickIntoBars(bars, tick, interval = '1d') {
  if (!Array.isArray(bars) || !bars.length) return bars
  const price = tick?.price
  if (!Number.isFinite(price) || price <= 0) return bars

  const last = bars[bars.length - 1]
  if (!last || !Number.isFinite(last.c)) return bars

  const stamp = Number.isFinite(tick?.timestamp) ? tick.timestamp : Date.now()

  // A tick from a session the last bar does not cover cannot be folded in. The
  // honest response is to leave the series alone and let the next fetch bring
  // the real bar — appending a synthetic one would put a bar on the chart that
  // the exchange never printed.
  if (SESSION_INTERVALS.has(interval) && !sameDay(last.t, stamp)) return bars
  // On intraday intervals the same risk exists at bar granularity, but the bar
  // width is not known here. Requiring the tick to be no older than the last
  // bar is the part that can be checked without guessing.
  if (stamp < last.t) return bars

  const high = Math.max(last.h ?? price, price)
  const low = Math.min(last.l ?? price, price)
  // Volume is only meaningful when the bar and the tick cover the same span.
  const volume = SESSION_INTERVALS.has(interval) && Number.isFinite(tick?.volume)
    ? Math.max(last.v ?? 0, tick.volume)
    : last.v

  // Nothing changed — return the original reference so downstream memos hold.
  if (last.c === price && last.h === high && last.l === low && last.v === volume) return bars

  const merged = bars.slice()
  merged[merged.length - 1] = { ...last, c: price, h: high, l: low, v: volume }
  return merged
}

/**
 * Recomputing indicators and patterns over 400 bars on every 3-second tick is
 * wasteful and janky. This gates it on time AND on movement, so a quiet market
 * costs nothing while a fast one still updates promptly.
 */
export function shouldApplyTick({ lastAppliedAt, lastAppliedPrice, tickPrice, now = Date.now(), minIntervalMs = 15000, minMovePct = 0.05 }) {
  if (!Number.isFinite(tickPrice) || tickPrice <= 0) return false
  if (lastAppliedAt == null) return true
  if (now - lastAppliedAt >= minIntervalMs) return true
  if (!Number.isFinite(lastAppliedPrice) || lastAppliedPrice <= 0) return true
  // A move worth seeing gets through before the timer.
  return Math.abs((tickPrice - lastAppliedPrice) / lastAppliedPrice) * 100 >= minMovePct
}
