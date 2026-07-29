import { useCallback, useRef, useState } from 'react'

import { computeAll } from '../lib/indicators'
import { computeSignal } from '../lib/signals'
import { detectPatterns } from '../lib/patterns'
import { runWalkForward, runSplitSample, actionFromSignal, DEFAULT_HORIZON, DEFAULT_WARMUP } from '../lib/walkForward'

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

  const reset = useCallback(() => {
    runIdRef.current += 1
    setResult(null)
    setSplit(null)
    setError(null)
    setIsRunning(false)
  }, [])

  return { result, split, isRunning, error, run, reset }
}

export default useWalkForward
