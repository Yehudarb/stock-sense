// Relative strength and range position.
//
// Two readings the engine had no answer for. Both describe where a stock sits
// relative to something outside its own price series, which is what an
// indicator computed from that series alone cannot tell you.

/**
 * How the stock has performed against a benchmark over `lookback` bars.
 *
 * The ratio matters more than the direction of either leg: falling 5% while the
 * benchmark falls 20% is outperformance, and a stock that holds up through a
 * market decline is behaving very differently from one that merely fell. Read
 * on price alone both look like losses.
 *
 * @param {Array}  stockBars     OHLCV, oldest first
 * @param {Array}  benchmarkBars OHLCV for the comparison symbol, same interval
 * @param {number} lookback      bars to measure over — 63 is about a quarter
 */
export function relativeStrength(stockBars, benchmarkBars, lookback = 63) {
  if (!Array.isArray(stockBars) || !Array.isArray(benchmarkBars)) return null
  if (stockBars.length < lookback + 1 || benchmarkBars.length < lookback + 1) return null

  const ratio = (stock, bench) => (bench === 0 || bench == null ? null : stock / bench)
  const now = ratio(stockBars.at(-1)?.c, benchmarkBars.at(-1)?.c)
  const then = ratio(stockBars.at(-1 - lookback)?.c, benchmarkBars.at(-1 - lookback)?.c)
  if (now == null || then == null || !Number.isFinite(now) || !Number.isFinite(then) || then === 0) return null

  const changePct = ((now - then) / then) * 100
  const stockPct = ((stockBars.at(-1).c - stockBars.at(-1 - lookback).c) / stockBars.at(-1 - lookback).c) * 100
  const benchPct = ((benchmarkBars.at(-1).c - benchmarkBars.at(-1 - lookback).c) / benchmarkBars.at(-1 - lookback).c) * 100

  return {
    line: now,
    changePct,
    stockPct,
    benchmarkPct: benchPct,
    outperforming: changePct > 0,
    lookback,
  }
}

/**
 * Where the last close sits inside the recent range. 0 is at the low, 1 at the
 * high. Reported alongside the distance to each extreme, because "92% of the
 * range" and "8% below the 52-week high" answer different questions.
 */
export function rangePosition(bars, window = 252) {
  if (!Array.isArray(bars) || bars.length < 2) return null

  const recent = bars.slice(-window)
  const highs = recent.map(b => b.h).filter(Number.isFinite)
  const lows = recent.map(b => b.l).filter(Number.isFinite)
  const close = bars.at(-1)?.c
  if (!highs.length || !lows.length || !Number.isFinite(close)) return null

  const high = Math.max(...highs)
  const low = Math.min(...lows)
  // A flat series has no range to place anything in; saying so beats dividing
  // by zero and reporting a confident 0.5.
  if (high === low) return null

  return {
    position: Math.max(0, Math.min(1, (close - low) / (high - low))),
    high,
    low,
    fromHighPct: ((close - high) / high) * 100,
    fromLowPct: ((close - low) / low) * 100,
    bars: recent.length,
  }
}
