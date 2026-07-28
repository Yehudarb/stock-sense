// Walk-forward validation for the signal engine.
//
// The engine's weights and thresholds were hand-picked and, until this module
// existed, never checked against what the market actually did next. This
// answers one question and only that question: when the engine emitted action
// X, what happened over the following N bars?
//
// The rule that makes the answer meaningful: at bar i the action is derived
// from ohlcv.slice(0, i + 1) and nothing else, so no value from bar i + 1
// onward can reach it. The result is a record, not hindsight.
//
// The engine is INJECTED rather than imported. That keeps this module free of
// the client module graph so it can be tested directly, and it lets a caller
// that already has a signal pipeline reuse it instead of recomputing.
//
// What this cannot tell you: whether an edge generalizes. One symbol over one
// period is a single sample of a single regime. Overlapping forward windows
// also inflate significance badly, which is why `overlapping: false` is the
// default — it costs sample size and buys a t-statistic worth reading.

export const DEFAULT_HORIZON = 10
export const DEFAULT_WARMUP = 220

function summarize(returns) {
  const n = returns.length
  if (!n) return null
  const mean = returns.reduce((sum, v) => sum + v, 0) / n
  // Sample standard deviation (n - 1): these are observations, not the whole
  // population of possible outcomes.
  const variance = n > 1 ? returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0
  const sd = Math.sqrt(variance)
  return {
    n,
    mean,
    sd,
    stdError: sd / Math.sqrt(n),
    winRate: (returns.filter(v => v > 0).length / n) * 100,
    median: [...returns].sort((a, b) => a - b)[Math.floor(n / 2)],
    best: Math.max(...returns),
    worst: Math.min(...returns),
  }
}

/**
 * Replays a decision function bar by bar and buckets realized forward returns
 * by the action it emitted.
 *
 * @param {Array}    ohlcv                 full bar history, oldest first
 * @param {Function} options.computeAction (historySlice) => action string|null.
 *                   REQUIRED. Called with bars 0..i inclusive; anything it
 *                   reads beyond that slice is a lookahead bug in the caller.
 * @param {number}   options.horizon       bars to look forward (default 10)
 * @param {number}   options.warmup        bars to skip so indicators settle
 * @param {boolean}  options.overlapping   step 1 bar (true) or `horizon` bars
 *                                         (false, default) between samples
 * @returns {Object|null} { baseline, byAction, meta }, or null when there is
 *                        not enough history to evaluate anything
 */
export function runWalkForward(ohlcv, options = {}) {
  const {
    computeAction,
    horizon = DEFAULT_HORIZON,
    warmup = DEFAULT_WARMUP,
    overlapping = false,
  } = options

  if (typeof computeAction !== 'function') {
    throw new TypeError('runWalkForward requires options.computeAction')
  }
  if (!Array.isArray(ohlcv) || ohlcv.length < warmup + horizon + 1) return null

  const step = overlapping ? 1 : horizon
  const byAction = {}
  const all = []
  let errors = 0

  for (let i = warmup; i < ohlcv.length - horizon; i += step) {
    let action
    try {
      action = computeAction(ohlcv.slice(0, i + 1))
    } catch {
      errors += 1
      continue
    }
    if (!action) continue

    const entry = ohlcv[i].c
    const exit = ohlcv[i + horizon].c
    if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry === 0) continue

    const ret = ((exit - entry) / entry) * 100
    ;(byAction[action] ??= []).push(ret)
    all.push(ret)
  }

  if (!all.length) return null

  const baseline = summarize(all)
  const actions = {}
  for (const [action, returns] of Object.entries(byAction)) {
    const stats = summarize(returns)
    // Edge is measured against holding through every evaluated bar, never
    // against zero — beating zero in a rising market means nothing.
    const edge = stats.mean - baseline.mean
    const tStat = stats.stdError ? edge / stats.stdError : 0
    actions[action] = {
      ...stats,
      share: (stats.n / baseline.n) * 100,
      edge,
      tStat,
      // |t| >= 2 is the conventional "probably not noise" bar. Necessary, not
      // sufficient: it says nothing about another period or another symbol.
      significant: Math.abs(tStat) >= 2,
    }
  }

  return {
    baseline,
    byAction: actions,
    meta: { horizon, warmup, overlapping, step, evaluated: baseline.n, errors, bars: ohlcv.length },
  }
}

/**
 * Evaluates the earlier and later halves of the history separately. A setting
 * that only works in one half is fitted to that half rather than to the
 * market; this is the cheapest available guard against reading noise as edge.
 */
export function runSplitSample(ohlcv, options = {}) {
  const { warmup = DEFAULT_WARMUP, horizon = DEFAULT_HORIZON } = options
  if (!Array.isArray(ohlcv) || ohlcv.length < warmup * 2 + horizon * 2) return null

  const midpoint = Math.floor((warmup + ohlcv.length) / 2)
  // The late half still replays from bar 0 so its indicators get the same
  // warmup the live app gives them; only the evaluation range moves.
  const early = runWalkForward(ohlcv.slice(0, midpoint + horizon), options)
  const late = runWalkForward(ohlcv, { ...options, warmup: midpoint })

  if (!early || !late) return null
  return { early, late, midpointIndex: midpoint }
}

/**
 * Builds the `computeAction` the app itself should use, from an already-wired
 * signal pipeline. Kept here so callers do not each re-derive the contract.
 *
 * @param {Function} computeSignalFn (historySlice) => signal object
 */
export function actionFromSignal(computeSignalFn) {
  return (history) => computeSignalFn(history)?.action ?? null
}
