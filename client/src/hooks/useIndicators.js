import { useMemo } from 'react'
import { computeAll } from '../lib/indicators'

export default function useIndicators(ohlcv) {
  return useMemo(() => {
    if (!ohlcv || ohlcv.length < 30) return null
    return computeAll(ohlcv)
  }, [ohlcv])
}
