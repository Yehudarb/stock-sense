import { useCallback, useState } from 'react'
import axios from 'axios'

/**
 * Thin wrapper around the paper trading account's goal/taxShield fields
 * (server/services/paperTradingStore.js). Reads come from the account object
 * already fetched by usePaperTrading; this only adds the update mutation.
 */
export default function useGoalTracking(account, setAccount) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const updateGoal = useCallback(async (payload) => {
    setIsSaving(true)
    setError('')
    try {
      const response = await axios.patch('/api/paper-trading/goal', payload)
      setAccount(response.data)
      return response.data
    } catch (nextError) {
      const message = nextError?.response?.data?.error ?? nextError.message ?? 'Unable to update goal'
      setError(message)
      throw new Error(message)
    } finally {
      setIsSaving(false)
    }
  }, [setAccount])

  return {
    goal: account?.goal ?? null,
    taxShield: account?.taxShield ?? null,
    equity: account?.equity ?? null,
    realizedPnl: account?.realizedPnl ?? null,
    unrealizedPnl: account?.unrealizedPnl ?? null,
    isSaving,
    error,
    updateGoal,
  }
}
