import { useEffect } from 'react'
import axios from 'axios'
import useStore from '../store/useStore'
import { INTERVAL_BAR_LIMITS } from '../../../shared/constants'

export default function useTicker() {
  const { currentTicker, interval, setOhlcv, setSnapshot, setLoading, setError } = useStore()

  useEffect(() => {
    let cancelled = false
    const limit = INTERVAL_BAR_LIMITS[interval] ?? 200
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [barsRes, snapRes] = await Promise.all([
          axios.get(`/api/market/bars/${currentTicker}?interval=${interval}&limit=${limit}`),
          axios.get(`/api/market/snapshot/${currentTicker}`),
        ])
        if (!cancelled) {
          setOhlcv(barsRes.data.bars)
          setSnapshot(snapRes.data)
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error ?? 'שגיאה בטעינת הנתונים')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentTicker, interval])
}
