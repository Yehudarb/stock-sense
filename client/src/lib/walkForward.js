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

function summarize(returns, { keepSamples = false } = {}) {
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
    // Raw observations, kept only when a caller intends to pool several runs.
    // Aggregating across symbols cannot be done from summaries: averaging
    // means would weight a 9-sample symbol the same as a 90-sample one, and a
    // pooled standard error cannot be recovered from per-run ones at all.
    ...(keepSamples ? { samples: returns } : {}),
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
    keepSamples = false,
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

  const baseline = summarize(all, { keepSamples })
  const actions = {}
  for (const [action, returns] of Object.entries(byAction)) {
    const stats = summarize(returns, { keepSamples })
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
  if (!Array.isArray(ohlcv)) return null

  const midpoint = Math.floor((warmup + ohlcv.length) / 2)
  // The late half still replays from bar 0 so its indicators get the same
  // warmup the live app gives them; only the evaluation range moves.
  //
  // No length precondition beyond this: each half is a runWalkForward call and
  // that function already returns null when its own range is too short, so the
  // real requirement is expressed once instead of being restated here. An
  // earlier guard of warmup*2 + horizon*2 was a guess, and a wrong one — it
  // demanded 460 bars where both halves in fact run comfortably on 400, so the
  // split never appeared at the app's own fetch size.
  const early = runWalkForward(ohlcv.slice(0, midpoint + horizon), options)
  const late = runWalkForward(ohlcv, { ...options, warmup: midpoint })

  if (!early || !late) return null
  return { early, late, midpointIndex: midpoint }
}

/**
 * Pools several runs into one result.
 *
 * A single symbol yields far too few non-overlapping samples to conclude
 * anything — 400 bars at horizon 10 gives about 17. Pooling across symbols is
 * the cheapest way to a sample worth reading.
 *
 * Pooling is done on the raw observations, never on the summaries. Averaging
 * per-run means would give a symbol with 9 samples the same weight as one with
 * 90, and a pooled standard error cannot be reconstructed from per-run ones at
 * all. Runs must therefore have been produced with `keepSamples: true`.
 *
 * The pooled t-statistic is still optimistic: symbols are correlated, and on a
 * shared down week every large cap contributes a loss to the same bucket. Treat
 * it as a sanity floor, not a p-value.
 *
 * @param {Array} runs entries of { label, result } — a null result is skipped
 */
export function aggregateWalkForward(runs) {
  const usable = (runs ?? []).filter(entry => entry?.result?.baseline?.samples)
  if (!usable.length) return null

  const allReturns = []
  const byActionReturns = {}
  const perSymbol = []

  for (const { label, result } of usable) {
    allReturns.push(...result.baseline.samples)
    for (const [action, bucket] of Object.entries(result.byAction)) {
      if (!bucket.samples) continue
      ;(byActionReturns[action] ??= []).push(...bucket.samples)
    }
    perSymbol.push({
      label,
      n: result.baseline.n,
      mean: result.baseline.mean,
      winRate: result.baseline.winRate,
    })
  }

  if (!allReturns.length) return null

  const baseline = summarize(allReturns)
  const actions = {}
  for (const [action, returns] of Object.entries(byActionReturns)) {
    const stats = summarize(returns)
    const edge = stats.mean - baseline.mean
    const tStat = stats.stdError ? edge / stats.stdError : 0
    // How many of the pooled symbols produced this action at all. An action
    // carried by one symbol is that symbol's quirk, however large its n.
    const symbolsWithAction = usable.filter(e => e.result.byAction[action]).length
    actions[action] = {
      ...stats,
      share: (stats.n / baseline.n) * 100,
      edge,
      tStat,
      significant: Math.abs(tStat) >= 2,
      symbols: symbolsWithAction,
    }
  }

  const first = usable[0].result.meta
  return {
    baseline,
    byAction: actions,
    perSymbol,
    meta: {
      horizon: first.horizon,
      warmup: first.warmup,
      overlapping: first.overlapping,
      step: first.step,
      evaluated: baseline.n,
      errors: usable.reduce((sum, e) => sum + (e.result.meta.errors ?? 0), 0),
      symbols: usable.length,
      pooled: true,
    },
  }
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
