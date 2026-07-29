import { useCallback, useRef, useState } from 'react'
import axios from 'axios'

import { computeAll } from '../lib/indicators'
import { computeSignal } from '../lib/signals'
import { detectPatterns } from '../lib/patterns'
import { runWalkForward, runSplitSample, aggregateWalkForward, actionFromSignal, DEFAULT_HORIZON, DEFAULT_WARMUP } from '../lib/walkForward'

// Enough history for the 220-bar warmup plus a measurable stretch after it.
const MULTI_BAR_LIMIT = 400

// Replaying the engine costs a full indicator + pattern pass per sample, which
// is far too expensive to run on every render or every ticker change. It is
// deliberately user-triggered: you ask for the validation, you wait for it.
//
// The work is synchronous and will block the main thread for a moment. A yield
// before starting lets React paint the "running" state first, so the UI does
// not appear frozen with no explanation.
export function useWalkForward() {
  const [result, setResult] = useState(null)
  const [split, setSplit] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const runIdRef = useRef(0)

  const run = useCallback(async (ohlcv, options = {}) => {
    const {
      horizon = DEFAULT_HORIZON,
      warmup = DEFAULT_WARMUP,
      overlapping = false,
      withSplit = true,
    } = options

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    setIsRunning(true)
    setError(null)
    setResult(null)
    setSplit(null)

    // Yield once so the spinner is on screen before the thread is tied up.
    await new Promise(resolve => setTimeout(resolve, 0))

    try {
      if (!Array.isArray(ohlcv) || ohlcv.length < warmup + horizon + 1) {
        throw new Error(`NOT_ENOUGH_BARS:${ohlcv?.length ?? 0}:${warmup + horizon + 1}`)
      }

      // The engine is rebuilt here rather than imported into walkForward.js so
      // the library stays free of the client module graph and testable on its
      // own. This is the one place the two are joined.
      const computeAction = actionFromSignal(history =>
        computeSignal(history, computeAll(history), detectPatterns(history), null),
      )

      const walk = runWalkForward(ohlcv, { computeAction, horizon, warmup, overlapping })
      const halves = withSplit ? runSplitSample(ohlcv, { computeAction, horizon, warmup, overlapping }) : null

      // A newer run started while this one was working — drop this result.
      if (runIdRef.current !== runId) return

      if (!walk) throw new Error('NO_SAMPLES')
      setResult(walk)
      setSplit(halves)
    } catch (err) {
      if (runIdRef.current !== runId) return
      setError(err.message ?? 'UNKNOWN')
    } finally {
      if (runIdRef.current === runId) setIsRunning(false)
    }
  }, [])

  // Runs the same replay over several symbols and pools the observations.
  //
  // One symbol yields about 17 non-overlapping samples at horizon 10, which
  // cannot settle anything. Pooling is the cheapest route to a readable sample.
  //
  // Symbols are processed one at a time on purpose: the work is CPU-bound, so
  // parallelism would not speed it up, and it would hit the market API in a
  // burst. Between symbols the loop yields so the progress counter can paint
  // and the tab stays responsive. A symbol that fails to fetch or produces no
  // samples is recorded and skipped rather than aborting the run.
  const runMany = useCallback(async (tickers, options = {}) => {
    const {
      horizon = DEFAULT_HORIZON,
      warmup = DEFAULT_WARMUP,
      overlapping = false,
    } = options

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    setIsRunning(true)
    setError(null)
    setResult(null)
    setSplit(null)
    setProgress({ done: 0, total: tickers.length, current: null })
    await new Promise(resolve => setTimeout(resolve, 0))

    const computeAction = actionFromSignal(history =>
      computeSignal(history, computeAll(history), detectPatterns(history), null),
    )

    const runs = []
    const skipped = []

    try {
      for (const ticker of tickers) {
        if (runIdRef.current !== runId) return
        setProgress({ done: runs.length + skipped.length, total: tickers.length, current: ticker })
        await new Promise(resolve => setTimeout(resolve, 0))

        let bars
        try {
          const response = await axios.get(
            `/api/market/bars/${encodeURIComponent(ticker)}?interval=1d&limit=${MULTI_BAR_LIMIT}`,
            { timeout: 20000 },
          )
          bars = response.data?.bars
        } catch {
          skipped.push({ ticker, reason: 'fetch' })
          continue
        }

        const single = runWalkForward(bars, { computeAction, horizon, warmup, overlapping, keepSamples: true })
        if (!single) {
          skipped.push({ ticker, reason: 'too_few_bars' })
          continue
        }
        runs.push({ label: ticker, result: single })
      }

      if (runIdRef.current !== runId) return

      const pooled = aggregateWalkForward(runs)
      if (!pooled) throw new Error('NO_SAMPLES')
      pooled.skipped = skipped
      setResult(pooled)
      setSplit(null)   // a split is per-series and does not pool meaningfully
    } catch (err) {
      if (runIdRef.current !== runId) return
      setError(err.message ?? 'UNKNOWN')
    } finally {
      if (runIdRef.current === runId) {
        setIsRunning(false)
        setProgress(null)
      }
    }
  }, [])

  const reset = useCallback(() => {
    runIdRef.current += 1
    setResult(null)
    setSplit(null)
    setError(null)
    setIsRunning(false)
    setProgress(null)
  }, [])

  return { result, split, isRunning, error, progress, run, runMany, reset }
}

export default useWalkForward
