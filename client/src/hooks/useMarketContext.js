import { useEffect, useState } from 'react'
import axios from 'axios'
import { computeMarketContext, getSectorEtf } from '../lib/marketContext'

const BASE_ASSETS = ['SPY', 'QQQ', '^VIX', 'DX-Y.NYB', 'TLT', 'GLD']

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

export default function useMarketContext(ticker) {
  const [state, setState] = useState({ data: null, isLoading: false, error: null })

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    const load = async () => {
      setState({ data: null, isLoading: true, error: null })

      try {
        const sectorEtf = getSectorEtf(ticker)
        const symbols = unique([...BASE_ASSETS, sectorEtf])
        const entries = await Promise.all(
          symbols.map(async symbol => {
            try {
              const response = await axios.get(`/api/market/bars/${encodeURIComponent(symbol)}?interval=1d&limit=40`)
              return [symbol, response.data?.bars ?? []]
            } catch {
              return [symbol, []]
            }
          }),
        )

        if (!cancelled) {
          const assetBars = Object.fromEntries(entries)
          setState({
            data: computeMarketContext(ticker, assetBars),
            isLoading: false,
            error: null,
          })
        }
      } catch (error) {
        if (!cancelled) setState({ data: null, isLoading: false, error: error.message })
      }
    }

    load()
    return () => { cancelled = true }
  }, [ticker])

  return state
}
