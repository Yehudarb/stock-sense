import { useEffect, useState } from 'react'
import axios from 'axios'

/**
 * Hook: Calculate stop loss and target levels using Trading Engine
 *
 * @param {number} entryPrice - Entry price
 * @param {number} atr - Average True Range
 * @param {number|null} supportPrice - Support price (optional)
 * @param {number} volatilityPct - Daily volatility % (default 5%)
 * @returns {object} { stops, loading, error }
 */
export function useTradingStops(entryPrice, atr, supportPrice = null, volatilityPct = 0.05) {
  const [stops, setStops] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!entryPrice || !atr) {
      setStops(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      try {
        const params = new URLSearchParams()
        params.append('entry', entryPrice.toString())
        params.append('atr', atr.toString())
        params.append('volatility', volatilityPct.toString())

        if (supportPrice) {
          params.append('support', supportPrice.toString())
        }

        const res = await axios.get(
          `/api/trading/calculate-stops/STOCK?${params.toString()}`,
          { timeout: 15000 }
        )

        if (!cancelled) {
          setStops(res.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message)
          console.warn('[Trading Stops] Error:', err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [entryPrice, atr, supportPrice, volatilityPct])

  return { stops, loading, error }
}

export default useTradingStops
