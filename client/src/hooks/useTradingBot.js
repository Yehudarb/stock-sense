import { useEffect, useState } from 'react'
import axios from 'axios'

export default function useTradingBot(refreshKey) {
  const [bot, setBot] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/trading-bot')
      setBot(response.data)
      return response.data
    } catch (nextError) {
      setError(nextError?.response?.data?.error ?? nextError.message ?? 'Unable to load trading bot status')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [refreshKey])

  async function runMutation(request, nextBot = false) {
    setIsSaving(true)
    setError('')
    try {
      const response = await request()
      if (nextBot) setBot(response.data)
      return response.data
    } catch (nextError) {
      const message = nextError?.response?.data?.error ?? nextError.message ?? 'Trading bot action failed'
      setError(message)
      throw new Error(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function runAutoCycle(payload) {
    setIsExecuting(true)
    setError('')
    try {
      const response = await axios.post('/api/trading-bot/auto-execute', payload)
      if (response.data?.bot) setBot(response.data.bot)
      return response.data
    } catch (nextError) {
      const message = nextError?.response?.data?.error ?? nextError.message ?? 'Trading bot auto execution failed'
      setError(message)
      throw new Error(message)
    } finally {
      setIsExecuting(false)
    }
  }

  return {
    bot,
    isLoading,
    isSaving,
    isExecuting,
    error,
    refresh,
    updateSettings: payload => runMutation(() => axios.patch('/api/trading-bot/settings', payload), true),
    recordEvent: payload => runMutation(() => axios.post('/api/trading-bot/events', payload), false),
    runAutoCycle,
  }
}
