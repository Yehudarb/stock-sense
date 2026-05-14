import { useEffect } from 'react'
import axios from 'axios'
import useStore from '../store/useStore'
import { INTERVAL_BAR_LIMITS } from '../../../shared/constants'

export default function useTicker() {
  const {
    currentTicker,
    interval,
    setOhlcv,
    setSnapshot,
    setLoading,
    setError,
    setLastLoadedTicker,
    analysisNonce,
  } = useStore()

  useEffect(() => {
    if (!currentTicker) {
      setOhlcv([])
      setSnapshot(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const limit = INTERVAL_BAR_LIMITS[interval] ?? 200
    const normalizedTicker = currentTicker.trim().toUpperCase()

    function friendlyError(err) {
      const code = err?.code
      const status = err?.response?.status
      const serverMessage = err?.response?.data?.error

      if (serverMessage) return serverMessage
      if (status === 404) return `No market data was returned for ${normalizedTicker}. Double-check the symbol and try again.`
      if (status === 429) return 'The demo is rate-limited right now. Please wait a few seconds and retry.'
      if (code === 'ECONNABORTED') return 'The analysis request is taking longer than expected. The backend may be waking up on Render, so please try again in a few seconds.'
      if (status >= 500) return 'The market data service is temporarily unavailable. Please retry in a moment.'
      return `We could not load data for ${normalizedTicker}. Check the ticker and try again.`
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [barsRes, snapRes] = await Promise.all([
          axios.get(`/api/market/bars/${normalizedTicker}?interval=${interval}&limit=${limit}`, { timeout: 20000 }),
          axios.get(`/api/market/snapshot/${normalizedTicker}`, { timeout: 20000 }),
        ])

        if (!cancelled) {
          const bars = barsRes.data?.bars ?? []
          const snapshot = snapRes.data ?? null

          if (!bars.length || !snapshot?.ticker) {
            setOhlcv([])
            setSnapshot(null)
            setError(`No price history was returned for ${normalizedTicker}. This can happen when the symbol is invalid or the data provider is delayed.`)
            return
          }

          setOhlcv(bars)
          setSnapshot(snapshot)
          setLastLoadedTicker(normalizedTicker)
        }
      } catch (err) {
        if (!cancelled) {
          setOhlcv([])
          setSnapshot(null)
          setError(friendlyError(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [analysisNonce, currentTicker, interval, setError, setLastLoadedTicker, setLoading, setOhlcv, setSnapshot])
}
