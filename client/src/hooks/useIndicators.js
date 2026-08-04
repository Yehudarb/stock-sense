import { useMemo } from 'react'
import { computeAll } from '../lib/indicators'

export default function useIndicators(ohlcv, interval = null) {
  return useMemo(() => {
    if (!ohlcv || ohlcv.length < 30) return null
    return computeAll(ohlcv, interval)
  }, [interval, ohlcv])
}
