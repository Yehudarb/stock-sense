import { useMemo } from 'react'

const ACTION_MAP = {
  STRONG_BUY: 'BUY',
  BUY: 'BUY',
  HOLD: 'HOLD',
  SELL: 'SELL',
  STRONG_SELL: 'SELL',
}

function confidenceBand(confidence) {
  if (confidence == null) return 'Weak'
  if (confidence >= 70) return 'Strong'
  if (confidence >= 40) return 'Medium'
  return 'Weak'
}

/**
 * Reduces the existing analyst decision (app/core-equivalent output) into the
 * plain BUY/SELL/HOLD/WAIT + Strong/Medium/Weak shape the simple screens need.
 * No new signal logic - it only relabels `signal.decision`.
 */
export default function useSimpleSignal(signal) {
  return useMemo(() => {
    const decision = signal?.decision
    if (!decision) {
      return { action: 'WAIT', confidence: 'Weak', decision: null }
    }

    const riskReward = decision.riskReward ?? null
    const meetsRiskReward = riskReward != null && riskReward >= 2.5

    return {
      action: decision.action === 'BUY' || decision.action === 'STRONG_BUY'
        ? (meetsRiskReward ? 'BUY' : 'WAIT')
        : (ACTION_MAP[decision.action] ?? 'WAIT'),
      confidence: confidenceBand(decision.signalStrength),
      decision,
    }
  }, [signal])
}
