import { useEffect, useState } from 'react'
import axios from 'axios'
import { computeTechnicalAnalysis } from '../lib/technicalAnalysis'
import { getClosedAnalysisBars } from '../lib/analysisBars'

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
        const [dailyResult, weeklyResult, h4Result] = await Promise.allSettled([
          axios.get(`/api/market/bars/${ticker}?interval=1d&limit=240`, { timeout: 20000 }),
          axios.get(`/api/market/bars/${ticker}?interval=5y&limit=260`, { timeout: 20000 }),
          axios.get(`/api/market/bars/${ticker}?interval=4h&limit=220`, { timeout: 20000 }),
        ])

        if (dailyResult.status !== 'fulfilled') throw dailyResult.reason
        const daily = getClosedAnalysisBars(dailyResult.value.data?.bars ?? [], '1d').bars
        const weeklyBars = weeklyResult.status === 'fulfilled' ? weeklyResult.value.data?.bars ?? [] : []
        const h4Bars = h4Result.status === 'fulfilled' ? h4Result.value.data?.bars ?? [] : []
        const weekly = getClosedAnalysisBars(weeklyBars, '5y').bars
        const h4 = getClosedAnalysisBars(h4Bars, '4h').bars
        const monthlyRaw = aggregateBarsByMonth(weekly)
        const currentMonth = new Date().toISOString().slice(0, 7)
        const lastMonth = monthlyRaw.at(-1)?.t ? new Date(monthlyRaw.at(-1).t).toISOString().slice(0, 7) : null
        const monthly = lastMonth === currentMonth ? monthlyRaw.slice(0, -1) : monthlyRaw
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
