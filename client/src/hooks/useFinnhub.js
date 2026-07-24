import { useEffect, useState } from 'react'
import axios from 'axios'

/**
 * Hook: Fetch Finnhub Company News
 */
export function useFinnhubNews(ticker, limit = 10) {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticker) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      try {
        const res = await axios.get(
          `/api/finnhub/news/${ticker}?limit=${limit}`,
          { timeout: 15000 }
        )
        if (!cancelled) {
          setNews(res.data.news || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [ticker, limit])

  return { news, loading, error }
}

/**
 * Hook: Fetch Finnhub Company Profile
 */
export function useFinnhubProfile(ticker) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticker) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      try {
        const res = await axios.get(`/api/finnhub/profile/${ticker}`, { timeout: 15000 })
        if (!cancelled) {
          setProfile(res.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [ticker])

  return { profile, loading, error }
}

/**
 * Hook: Fetch Finnhub Real-time Quote
 */
export function useFinnhubQuote(ticker) {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticker) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      try {
        const res = await axios.get(`/api/finnhub/quote/${ticker}`, { timeout: 15000 })
        if (!cancelled) {
          setQuote(res.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [ticker])

  return { quote, loading, error }
}
