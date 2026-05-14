import { useEffect, useState } from 'react'
import axios from 'axios'
import { computeTechnicalAnalysis } from '../lib/technicalAnalysis'

function aggregateBarsByMonth(bars) {
  if (!bars?.length) return []
  const grouped = new Map()

  bars.forEach(bar => {
    const date = new Date(bar.t)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...bar })
      return
    }
    existing.h = Math.max(existing.h, bar.h)
    existing.l = Math.min(existing.l, bar.l)
    existing.c = bar.c
    existing.v = (existing.v ?? 0) + (bar.v ?? 0)
    existing.t = bar.t
  })

  return [...grouped.values()]
}

export default function useTechnicalAnalysis(ticker) {
  const [state, setState] = useState({ data: null, isLoading: false, error: null })

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    async function load() {
      setState({ data: null, isLoading: true, error: null })

      try {
        const [dailyRes, weeklyRes, h4Res] = await Promise.all([
          axios.get(`/api/market/bars/${ticker}?interval=1d&limit=240`, { timeout: 20000 }),
          axios.get(`/api/market/bars/${ticker}?interval=5y&limit=260`, { timeout: 20000 }),
          axios.get(`/api/market/bars/${ticker}?interval=4h&limit=220`, { timeout: 20000 }),
        ])

        const daily = dailyRes.data?.bars ?? []
        const weekly = weeklyRes.data?.bars ?? []
        const h4 = h4Res.data?.bars ?? []
        const monthly = aggregateBarsByMonth(weekly)
        const analysis = computeTechnicalAnalysis(ticker, { daily, weekly, monthly, h4 })

        if (!cancelled) {
          setState({ data: analysis, isLoading: false, error: analysis ? null : 'Technical analysis could not be computed for this ticker.' })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            isLoading: false,
            error: error?.code === 'ECONNABORTED'
              ? 'Technical analysis timed out while waiting for multi-timeframe market data.'
              : 'Technical analysis could not load all timeframe data.',
          })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [ticker])

  return state
}
