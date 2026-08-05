import { useEffect, useState } from 'react'
import axios from 'axios'

/**
 * Load the latest server-side Cup & Handle result for the selected symbol.
 * The scanner is cached server-side, so this does not start a new scan.
 */
export default function useCupHandleCandidate(ticker) {
  const [candidate, setCandidate] = useState(null)

  useEffect(() => {
    if (!ticker) {
      setCandidate(null)
      return undefined
    }

    let cancelled = false
    const symbol = ticker.trim().toUpperCase()

    axios.get('/api/scanner/cup-handle/latest', { timeout: 15000 })
      .then(response => {
        if (cancelled) return
        const job = response.data
        const completedAt = Number(job?.completedAt)
        const scanAge = Number.isFinite(completedAt) ? Date.now() - completedAt : Infinity
        const match = (job?.results ?? []).find(item => item.ticker === symbol)
        // A daily pattern may survive a weekend, but not an indefinitely cached
        // scan. Stale scanner output must never affect the live decision.
        const fresh = scanAge >= 0 && scanAge <= 48 * 60 * 60 * 1000
        setCandidate(match && fresh
          ? { ...match, scanCompletedAt: completedAt }
          : null)
      })
      .catch(() => {
        if (!cancelled) setCandidate(null)
      })

    return () => { cancelled = true }
  }, [ticker])

  return candidate
}
