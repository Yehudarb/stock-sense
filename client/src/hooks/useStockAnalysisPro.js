import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { buildStockAnalysisPro } from '../lib/stockAnalysisPro'
import { computeAll } from '../lib/indicators'
import { getClosedAnalysisBars } from '../lib/analysisBars'

/**
 * Feeds the Stock Analysis Pro engine. Everything the engine needs except the
 * company profile and news already flows through the existing hooks, so this
 * hook only fetches those two — and treats their absence as a data-quality
 * fact rather than an error (the server needs FINNHUB_API_KEY for them).
 */
export default function useStockAnalysisPro({
  ticker,
  interval,
  ohlcv,
  indicators,
  signal,
  snapshot,
  earnings,
  marketContext,
  multiTimeframe,
  fearGreed,
  position,
  language = 'he',
  enabled = true,
}) {
  const [profile, setProfile] = useState(null)
  const [news, setNews] = useState(null)
  const [isFetchingContext, setIsFetchingContext] = useState(false)

  useEffect(() => {
    if (!enabled || !ticker) return undefined

    let cancelled = false
    setIsFetchingContext(true)
    setProfile(null)
    setNews(null)

    Promise.allSettled([
      axios.get(`/api/finnhub/profile/${ticker}`, { timeout: 15000 }),
      axios.get(`/api/finnhub/news/${ticker}?limit=5`, { timeout: 15000 }),
    ]).then(([profileResult, newsResult]) => {
      if (cancelled) return
      setProfile(profileResult.status === 'fulfilled' ? profileResult.value.data : null)
      setNews(newsResult.status === 'fulfilled' ? (newsResult.value.data?.news ?? null) : null)
      setIsFetchingContext(false)
    })

    return () => { cancelled = true }
  }, [enabled, ticker])

  const report = useMemo(() => {
    if (!enabled) return null
    const barContext = getClosedAnalysisBars(ohlcv, interval)
    const analysisBars = barContext.bars
    const analysisIndicators = barContext.excludedLiveBar
      ? computeAll(analysisBars)
      : indicators

    return buildStockAnalysisPro({
      ticker,
      interval,
      ohlcv: analysisBars,
      indicators: analysisIndicators,
      signal,
      snapshot,
      earnings,
      marketContext,
      multiTimeframe,
      fearGreed,
      profile,
      news,
      position,
      language,
    })
  }, [
    enabled, ticker, interval, ohlcv, indicators, signal, snapshot, earnings,
    marketContext, multiTimeframe, fearGreed, profile, news, position, language,
  ])

  return { report, isFetchingContext }
}
