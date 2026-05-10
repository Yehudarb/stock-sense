function round(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function latest(values, index) {
  return values?.[index] ?? null
}

function pct(from, to) {
  if (!from || to == null) return null
  return ((to - from) / from) * 100
}

function normalizeProbability(score) {
  return clamp(0.5 + score / 10, 0.05, 0.95)
}

function confidenceFromVotes(buyVotes, totalModels) {
  if (!totalModels) return 'LOW'
  if (buyVotes === totalModels || buyVotes === 0) return 'MAXIMUM'
  if (buyVotes >= totalModels * 0.8 || buyVotes <= totalModels * 0.2) return 'HIGH'
  if (buyVotes >= totalModels * 0.6 || buyVotes <= totalModels * 0.4) return 'MEDIUM'
  return 'LOW'
}

function modelResult({ key, label, probability, factors, weight }) {
  const prob = clamp(probability, 0.05, 0.95)
  return {
    key,
    label,
    probability: round(prob, 3),
    vote: prob >= 0.5 ? 'BUY' : 'SELL',
    weight,
    factors: factors.filter(Boolean).slice(0, 3),
  }
}

function trendModel(ohlcv, indicators) {
  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const sma20 = latest(indicators.sma20, index)
  const sma50 = latest(indicators.sma50, index)
  const sma200 = latest(indicators.sma200, index)
  let score = 0
  const factors = []

  if (sma200 != null) {
    const distance = pct(sma200, price)
    if (price > sma200) {
      score += 1.7
      factors.push(`מעל SMA200 ב-${round(distance, 1)}%`)
    } else {
      score -= 1.9
      factors.push(`מתחת SMA200 ב-${round(Math.abs(distance), 1)}%`)
    }
  }

  if (sma50 != null && sma200 != null) {
    if (sma50 > sma200) {
      score += 1.2
      factors.push('SMA50 מעל SMA200')
    } else {
      score -= 1.2
      factors.push('SMA50 מתחת SMA200')
    }
  }

  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) score += 0.8
    else score -= 0.8
  }

  return modelResult({
    key: 'trend_boost',
    label: 'Trend Boost',
    probability: normalizeProbability(score),
    factors,
    weight: 0.28,
  })
}

function momentumModel(ohlcv, indicators) {
  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const rsi = latest(indicators.rsi14, index)
  const macdLine = latest(indicators.macd?.line, index)
  const macdSignal = latest(indicators.macd?.signal, index)
  const macdPrev = latest(indicators.macd?.line, index - 1)
  const macdSignalPrev = latest(indicators.macd?.signal, index - 1)
  const ret5 = index >= 5 ? pct(ohlcv[index - 5].c, price) : null
  const ret20 = index >= 20 ? pct(ohlcv[index - 20].c, price) : null
  let score = 0
  const factors = []

  if (rsi != null) {
    if (rsi >= 50 && rsi <= 68) {
      score += 1.5
      factors.push(`RSI מומנטום בריא ${round(rsi, 1)}`)
    } else if (rsi > 72) {
      score -= 1.1
      factors.push(`RSI גבוה ${round(rsi, 1)}`)
    } else if (rsi < 42) {
      score -= 0.9
      factors.push(`RSI חלש ${round(rsi, 1)}`)
    }
  }

  if (macdLine != null && macdSignal != null) {
    const crossedUp = macdPrev != null && macdSignalPrev != null && macdPrev <= macdSignalPrev && macdLine > macdSignal
    const crossedDown = macdPrev != null && macdSignalPrev != null && macdPrev >= macdSignalPrev && macdLine < macdSignal
    if (crossedUp) {
      score += 1.6
      factors.push('MACD חצה למעלה')
    } else if (crossedDown) {
      score -= 1.6
      factors.push('MACD חצה למטה')
    } else if (macdLine > macdSignal) {
      score += 0.9
      factors.push('MACD חיובי')
    } else {
      score -= 0.9
      factors.push('MACD שלילי')
    }
  }

  if (ret5 != null && ret5 > 2) score += 0.7
  if (ret5 != null && ret5 < -2) score -= 0.7
  if (ret20 != null && ret20 > 5) factors.push(`מומנטום 20 נרות +${round(ret20, 1)}%`)
  if (ret20 != null && ret20 < -5) factors.push(`מומנטום 20 נרות ${round(ret20, 1)}%`)

  return modelResult({
    key: 'momentum',
    label: 'Momentum',
    probability: normalizeProbability(score),
    factors,
    weight: 0.22,
  })
}

function meanReversionModel(ohlcv, indicators) {
  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const rsi = latest(indicators.rsi14, index)
  const lower = latest(indicators.bb20?.lower, index)
  const upper = latest(indicators.bb20?.upper, index)
  const middle = latest(indicators.bb20?.middle, index)
  let score = 0
  const factors = []

  if (rsi != null) {
    if (rsi < 28) {
      score += 2
      factors.push(`מכירת יתר RSI ${round(rsi, 1)}`)
    } else if (rsi < 35) {
      score += 1.2
      factors.push(`RSI נמוך ${round(rsi, 1)}`)
    } else if (rsi > 75) {
      score -= 2
      factors.push(`קניית יתר RSI ${round(rsi, 1)}`)
    } else if (rsi > 68) {
      score -= 1.2
      factors.push(`RSI גבוה ${round(rsi, 1)}`)
    }
  }

  if (lower != null && upper != null && middle != null) {
    if (price < lower) {
      score += 1.4
      factors.push('מתחת לרצועת Bollinger תחתונה')
    } else if (price > upper) {
      score -= 1.4
      factors.push('מעל רצועת Bollinger עליונה')
    } else if (price > middle) {
      score += 0.35
    } else {
      score -= 0.2
    }
  }

  return modelResult({
    key: 'mean_reversion',
    label: 'Mean Reversion',
    probability: normalizeProbability(score),
    factors,
    weight: 0.16,
  })
}

function volumeInstitutionalModel(ohlcv, indicators, signal) {
  const index = ohlcv.length - 1
  const last = ohlcv[index]
  const volumeRatio = latest(indicators.volRatio, index)
  const pro = signal?.pro
  let score = 0
  const factors = []

  if (volumeRatio != null && volumeRatio > 1.5) {
    if (last.c >= last.o) {
      score += 1.4
      factors.push(`נפח חריג בעלייה ${round(volumeRatio, 2)}x`)
    } else {
      score -= 1.2
      factors.push(`נפח חריג בירידה ${round(volumeRatio, 2)}x`)
    }
  }

  if (pro?.institutional?.institutionalBuying) {
    score += 1.5
    factors.push(`פעילות מוסדית: ${pro.institutional.spikeCount} קפיצות נפח`)
  }

  if (pro?.volumeProfile?.conviction) {
    score += 0.5
    factors.push('אזורי נפח משמעותיים')
  }

  if (pro?.divergences?.bullish) {
    score += 1
    factors.push('סטייה חיובית')
  }
  if (pro?.divergences?.bearish) {
    score -= 1
    factors.push('סטייה שלילית')
  }

  return modelResult({
    key: 'volume_institutional',
    label: 'Volume / Institutions',
    probability: normalizeProbability(score),
    factors,
    weight: 0.18,
  })
}

function structurePatternModel(signal) {
  const pro = signal?.pro
  const pattern = signal?.patterns?.best
  const gap = pro?.gaps?.nearestOpen
  let score = 0
  const factors = []

  if (pattern?.direction === 'bullish') {
    score += clamp(Math.abs(pattern.weight ?? 0) / 25, 0.7, 2)
    factors.push(`תבנית חיובית: ${pattern.label}`)
  }
  if (pattern?.direction === 'bearish') {
    score -= clamp(Math.abs(pattern.weight ?? 0) / 25, 0.7, 2)
    factors.push(`תבנית שלילית: ${pattern.label}`)
  }

  if (pro?.supportResistance?.breakoutUp) {
    score += 1.1
    factors.push('פריצה מעל התנגדות')
  }
  if (pro?.supportResistance?.breakoutDown) {
    score -= 1.1
    factors.push('שבירה מתחת לתמיכה')
  }
  if (pro?.supportResistance?.nearResistance) {
    score -= 0.5
    factors.push('קרוב להתנגדות')
  }
  if (pro?.supportResistance?.nearSupport) {
    score += 0.5
    factors.push('קרוב לתמיכה')
  }

  if (gap?.direction === 'down' && gap.position === 'above') {
    score += gap.distancePct <= 3 ? 0.8 : 0.35
    factors.push('גאפ פתוח מעל המחיר')
  }
  if (gap?.direction === 'up' && gap.position === 'below') {
    score -= gap.distancePct <= 3 ? 0.8 : 0.35
    factors.push('גאפ פתוח מתחת למחיר')
  }

  return modelResult({
    key: 'structure_patterns',
    label: 'Structure / Patterns',
    probability: normalizeProbability(score),
    factors,
    weight: 0.16,
  })
}

export function computeEnsembleConsensus(ohlcv, indicators, signal) {
  if (!ohlcv?.length || !indicators || !signal) return null

  const models = [
    trendModel(ohlcv, indicators),
    momentumModel(ohlcv, indicators),
    meanReversionModel(ohlcv, indicators),
    volumeInstitutionalModel(ohlcv, indicators, signal),
    structurePatternModel(signal),
  ]

  const totalWeight = models.reduce((sum, model) => sum + model.weight, 0)
  const probability = models.reduce((sum, model) => sum + model.probability * model.weight, 0) / totalWeight
  const buyVotes = models.filter(model => model.vote === 'BUY').length
  const sellVotes = models.length - buyVotes
  const agreementPct = Math.round((Math.max(buyVotes, sellVotes) / models.length) * 100)
  const confidence = confidenceFromVotes(buyVotes, models.length)
  const bias = probability >= 0.58 && buyVotes >= 3
    ? 'bullish'
    : probability <= 0.42 && sellVotes >= 3
      ? 'bearish'
      : 'neutral'

  const score = round((probability - 0.5) * 10, 2)
  const action = bias === 'bullish'
    ? buyVotes >= 4 && probability >= 0.65 ? 'STRONG_BUY' : 'BUY'
    : bias === 'bearish'
      ? sellVotes >= 4 && probability <= 0.35 ? 'STRONG_SELL' : 'SELL'
      : 'HOLD'

  return {
    version: 'v3 ensemble-style',
    probability: round(probability, 3),
    probabilityPct: Math.round(probability * 100),
    buyVotes,
    sellVotes,
    totalModels: models.length,
    agreementPct,
    confidence,
    bias,
    action,
    score,
    models,
    factors: models
      .flatMap(model => model.factors.map(factor => `${model.label}: ${factor}`))
      .slice(0, 6),
  }
}
