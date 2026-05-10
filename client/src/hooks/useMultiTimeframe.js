import { useEffect, useState } from 'react'
import axios from 'axios'
import { INTERVAL_BAR_LIMITS } from '../../../shared/constants'
import { computeAll } from '../lib/indicators'

const TIMEFRAMES = [
  { interval: '5y', label: '5 שנים', weight: 3 },
  { interval: '1y', label: 'שנה', weight: 2.5 },
  { interval: '1mo', label: 'חודש', weight: 2 },
  { interval: '1d', label: 'יום', weight: 1.5 },
  { interval: '1h', label: 'שעה', weight: 1 },
  { interval: '5m', label: '5 דק׳', weight: 0.5 },
]

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function latest(values, index) {
  return values?.[index] ?? null
}

function pctChange(from, to) {
  if (!from || to == null) return null
  return ((to - from) / from) * 100
}

function classify(score) {
  if (score >= 2) return 'bullish'
  if (score <= -2) return 'bearish'
  return 'neutral'
}

function scoreTimeframe(config, bars) {
  if (!bars?.length || bars.length < 30) {
    return {
      ...config,
      score: 0,
      bias: 'neutral',
      price: null,
      rsi: null,
      trend: 'אין מספיק נתונים',
      factors: ['אין מספיק נרות אמינים לטווח הזה'],
      hasData: false,
    }
  }

  const indicators = computeAll(bars)
  if (!indicators) {
    return {
      ...config,
      score: 0,
      bias: 'neutral',
      price: bars[bars.length - 1]?.c ?? null,
      rsi: null,
      trend: 'אין אינדיקטורים',
      factors: ['לא ניתן לחשב אינדיקטורים לטווח הזה'],
      hasData: false,
    }
  }

  const index = bars.length - 1
  const price = bars[index].c
  const rsi = latest(indicators.rsi14, index)
  const sma20 = latest(indicators.sma20, index)
  const sma50 = latest(indicators.sma50, index)
  const sma200 = latest(indicators.sma200, index)
  const atr = latest(indicators.atr14, index)
  const macdLine = latest(indicators.macd?.line, index)
  const macdSignal = latest(indicators.macd?.signal, index)
  const lookbackIndex = Math.max(0, index - Math.min(20, bars.length - 1))
  const recentReturn = pctChange(bars[lookbackIndex]?.c, price)

  let score = 0
  const factors = []

  if (sma200 != null) {
    if (price > sma200 * 1.02) {
      score += 2
      factors.push('מעל SMA200: מגמת בסיס חיובית')
    } else if (price < sma200 * 0.98) {
      score -= 2
      factors.push('מתחת SMA200: מגמת בסיס שלילית')
    }
  } else if (sma50 != null) {
    if (price > sma50) {
      score += 1
      factors.push('מעל SMA50: נטייה חיובית')
    } else {
      score -= 1
      factors.push('מתחת SMA50: נטייה חלשה')
    }
  }

  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) {
      score += 0.75
      factors.push('SMA20 מעל SMA50')
    } else {
      score -= 0.75
      factors.push('SMA20 מתחת SMA50')
    }
  }

  if (rsi != null) {
    if (rsi < 30) {
      score += 0.75
      factors.push(`RSI נמוך (${round(rsi, 0)}) - אפשרות לריבאונד`)
    } else if (rsi > 72) {
      score -= 0.75
      factors.push(`RSI גבוה (${round(rsi, 0)}) - סיכון מימוש`)
    } else if (rsi >= 50 && rsi <= 65) {
      score += 0.5
      factors.push('RSI באזור מומנטום בריא')
    } else if (rsi < 45) {
      score -= 0.35
      factors.push('RSI חלש יחסית')
    }
  }

  if (macdLine != null && macdSignal != null) {
    if (macdLine > macdSignal) {
      score += 1
      factors.push('MACD חיובי')
    } else {
      score -= 1
      factors.push('MACD שלילי')
    }
  }

  if (recentReturn != null) {
    if (recentReturn > 4) {
      score += 0.75
      factors.push(`תשואה אחרונה ${round(recentReturn, 1)}%`)
    } else if (recentReturn < -4) {
      score -= 0.75
      factors.push(`חולשה אחרונה ${round(recentReturn, 1)}%`)
    }
  }

  const volatilityPct = atr && price ? (atr / price) * 100 : null
  const bias = classify(score)

  return {
    ...config,
    score: round(score, 2),
    bias,
    price: round(price),
    rsi: round(rsi, 1),
    recentReturn: round(recentReturn, 1),
    volatilityPct: round(volatilityPct, 2),
    trend: bias === 'bullish' ? 'בוליש' : bias === 'bearish' ? 'בריש' : 'מעורב',
    factors: factors.slice(0, 3),
    hasData: true,
  }
}

function analyzeTimeframes(timeframes) {
  const available = timeframes.filter(item => item.hasData)
  if (!available.length) {
    return {
      compositeScore: 0,
      bias: 'neutral',
      alignmentPct: 0,
      bullish: 0,
      bearish: 0,
      neutral: 0,
      total: 0,
      timeframes,
      recommendation: 'אין מספיק נתונים לטווחים מרובים',
    }
  }

  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0)
  const compositeScore = available.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight
  const bullish = available.filter(item => item.bias === 'bullish').length
  const bearish = available.filter(item => item.bias === 'bearish').length
  const neutral = available.length - bullish - bearish
  const alignmentPct = Math.round((Math.max(bullish, bearish, neutral) / available.length) * 100)
  const bias = classify(compositeScore)

  const recommendation = bias === 'bullish'
    ? 'רוב הטווחים תומכים בכיוון חיובי'
    : bias === 'bearish'
      ? 'רוב הטווחים מזהירים מלחץ שלילי'
      : 'הטווחים מעורבים, עדיף להמתין לאישור'

  return {
    compositeScore: round(compositeScore, 2),
    bias,
    alignmentPct,
    bullish,
    bearish,
    neutral,
    total: available.length,
    timeframes,
    recommendation,
  }
}

export default function useMultiTimeframe(ticker) {
  const [state, setState] = useState({ data: null, isLoading: false, error: null })

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    const load = async () => {
      setState({ data: null, isLoading: true, error: null })

      try {
        const results = await Promise.all(
          TIMEFRAMES.map(async config => {
            try {
              const limit = INTERVAL_BAR_LIMITS[config.interval] ?? 220
              const response = await axios.get(`/api/market/bars/${ticker}?interval=${config.interval}&limit=${limit}`)
              return scoreTimeframe(config, response.data?.bars ?? [])
            } catch {
              return {
                ...config,
                score: 0,
                bias: 'neutral',
                price: null,
                rsi: null,
                trend: 'שגיאת טעינה',
                factors: ['הטווח לא נטען כרגע'],
                hasData: false,
              }
            }
          }),
        )

        if (!cancelled) {
          setState({ data: analyzeTimeframes(results), isLoading: false, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, isLoading: false, error: error.message })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [ticker])

  return state
}
