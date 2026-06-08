import { useEffect, useState } from 'react'
import axios from 'axios'

export default function usePaperTrading(refreshKey) {
  const [account, setAccount] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/paper-trading')
      setAccount(response.data)
      return response.data
    } catch (nextError) {
      setError(nextError?.response?.data?.error ?? nextError.message ?? 'Unable to load paper trading account')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [refreshKey])

  async function runMutation(request) {
    setIsSaving(true)
    setError('')
    try {
      const response = await request()
      setAccount(response.data)
      return response.data
    } catch (nextError) {
      const message = nextError?.response?.data?.error ?? nextError.message ?? 'Paper trading action failed'
      setError(message)
      throw new Error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    account,
    isLoading,
    isSaving,
    error,
    refresh,
    createOrder: payload => runMutation(() => axios.post('/api/paper-trading/orders', payload)),
    cancelOrder: id => runMutation(() => axios.post(`/api/paper-trading/orders/${id}/cancel`)),
    closePosition: (id, exitPrice) => runMutation(() => axios.post(`/api/paper-trading/positions/${id}/close`, { exitPrice })),
    updateSettings: payload => runMutation(() => axios.patch('/api/paper-trading/settings', payload)),
    resetAccount: () => runMutation(() => axios.post('/api/paper-trading/reset')),
  }
}
