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
  return round(((to - from) / from) * 100, 2)
}

function returnPct(ohlcv, periods) {
  if (!ohlcv?.length || ohlcv.length <= periods) return null
  const last = ohlcv[ohlcv.length - 1]
  const previous = ohlcv[ohlcv.length - 1 - periods]
  return pct(previous?.c, last?.c)
}

function horizonLabel(interval, language = 'he') {
  if (language === 'en') {
    return {
      '1m': 'minutes timeframe',
      '5m': 'short intraday timeframe',
      '15m': 'intraday timeframe',
      '1h': 'hourly timeframe',
      '4h': 'short swing timeframe',
      '1d': 'daily timeframe',
      '1mo': 'monthly timeframe',
      '1y': 'yearly timeframe',
      '5y': 'multi-year timeframe',
    }[interval] ?? 'selected timeframe'
  }
  return {
    '1m': 'טווח דקות',
    '5m': 'טווח תוך יומי קצר',
    '15m': 'טווח תוך יומי',
    '1h': 'טווח שעות',
    '4h': 'טווח סווינג קצר',
    '1d': 'טווח יומי',
    '1mo': 'טווח חודשי',
    '1y': 'טווח שנתי',
    '5y': 'טווח רב־שנתי',
  }[interval] ?? 'טווח נבחר'
}

function biasCopy(bias, language = 'he') {
  if (language === 'en') {
    return {
      bullish: {
        label: 'Bullish',
        tone: 'bullish',
        expectation: 'Upside bias',
        action: 'Hold / look for staged entries',
      },
      bearish: {
        label: 'Bearish',
        tone: 'bearish',
        expectation: 'Downside pressure',
        action: 'Be cautious / reduce below protection levels',
      },
      neutral: {
        label: 'Neutral',
        tone: 'neutral',
        expectation: 'Mixed movement expected',
        action: 'Wait for clearer confirmation',
      },
    }[bias] ?? {
      label: 'Neutral',
      tone: 'neutral',
      expectation: 'Mixed movement expected',
      action: 'Wait for clearer confirmation',
    }
  }
  return {
    bullish: {
      label: 'בוליש',
      tone: 'bullish',
      expectation: 'צפי לעלייה',
      action: 'להחזיק / לחפש כניסה מדורגת',
    },
    bearish: {
      label: 'בריש',
      tone: 'bearish',
      expectation: 'צפי ללחץ יורד',
      action: 'להיזהר / לצמצם מתחת לרמות ההגנה',
    },
    neutral: {
      label: 'ניטרלי',
      tone: 'neutral',
      expectation: 'צפי לתנועה מעורבת',
      action: 'להמתין לאישור ברור',
    },
  }[bias] ?? {
    label: 'ניטרלי',
    tone: 'neutral',
    expectation: 'צפי לתנועה מעורבת',
    action: 'להמתין לאישור ברור',
  }
}

function addDriver(list, text) {
  if (text && !list.includes(text)) list.push(text)
}

function addRisk(list, text) {
  if (text && !list.includes(text)) list.push(text)
}

function scoreSignalLayer(signal, drivers, risks) {
  let bullish = 0
  let bearish = 0

  if (!signal) return { bullish, bearish }

  if (signal.action === 'STRONG_BUY') bullish += 2.5
  if (signal.action === 'BUY') bullish += 1.8
  if (signal.action === 'SELL') bearish += 1.8
  if (signal.action === 'STRONG_SELL') bearish += 2.5

  if (signal.buyProbability != null && signal.sellProbability != null) {
    const diff = signal.buyProbability - signal.sellProbability
    if (diff > 10) {
      bullish += clamp(diff / 25, 0.4, 1.4)
      addDriver(drivers, `מודל האות מעדיף קנייה (${signal.buyProbability}% מול ${signal.sellProbability}%).`)
    } else if (diff < -10) {
      bearish += clamp(Math.abs(diff) / 25, 0.4, 1.4)
      addRisk(risks, `מודל האות מעדיף מכירה (${signal.sellProbability}% מול ${signal.buyProbability}%).`)
    }
  }

  const trend = signal.gates?.trend?.regime
  if (trend === 'uptrend') {
    bullish += 1.2
    addDriver(drivers, 'שער המגמה מאשר מגמה עולה.')
  }
  if (trend === 'downtrend') {
    bearish += 1.4
    addRisk(risks, 'שער המגמה מצביע על מגמה יורדת.')
  }
  if (signal.gates?.confluence?.passed && signal.score >= 0) {
    bullish += 0.8
    addDriver(drivers, `${signal.gates.confluence.active}/${signal.gates.confluence.total} אינדיקטורים מיושרים לצד הקנייה.`)
  }

  return { bullish, bearish }
}

function scoreIndicatorLayer(ohlcv, indicators, drivers, risks) {
  let bullish = 0
  let bearish = 0
  if (!ohlcv?.length || !indicators) return { bullish, bearish }

  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const rsi = latest(indicators.rsi14, index)
  const sma20 = latest(indicators.sma20, index)
  const sma50 = latest(indicators.sma50, index)
  const sma200 = latest(indicators.sma200, index)
  const atr = latest(indicators.atr14, index)
  const macdLine = latest(indicators.macd?.line, index)
  const macdSignal = latest(indicators.macd?.signal, index)
  const volumeRatio = latest(indicators.volRatio, index)
  const ret5 = returnPct(ohlcv, 5)
  const ret20 = returnPct(ohlcv, Math.min(20, ohlcv.length - 2))
  const volatilityPct = atr && price ? (atr / price) * 100 : null

  if (sma50 != null && sma200 != null) {
    if (price > sma50 && price > sma200 && sma50 >= sma200) {
      bullish += 1.7
      addDriver(drivers, 'המחיר מעל SMA50 ו-SMA200, מבנה מגמה בריא.')
    } else if (price < sma50 && price < sma200) {
      bearish += 1.7
      addRisk(risks, 'המחיר מתחת לממוצעים המרכזיים, המבנה חלש.')
    }
  } else if (sma20 != null && price > sma20) {
    bullish += 0.7
    addDriver(drivers, 'המחיר מעל SMA20 בטווח הנבחר.')
  } else if (sma20 != null) {
    bearish += 0.7
    addRisk(risks, 'המחיר מתחת SMA20 בטווח הנבחר.')
  }

  if (rsi != null) {
    if (rsi >= 48 && rsi <= 65) {
      bullish += 0.8
      addDriver(drivers, `RSI ${round(rsi, 1)} באזור מומנטום בריא.`)
    } else if (rsi > 72) {
      bearish += 0.9
      addRisk(risks, `RSI ${round(rsi, 1)} גבוה, יש סיכון למימוש.`)
    } else if (rsi < 30) {
      bullish += 0.6
      addDriver(drivers, `RSI ${round(rsi, 1)} נמוך, ייתכן ריבאונד טכני.`)
    } else if (rsi < 42) {
      bearish += 0.5
      addRisk(risks, `RSI ${round(rsi, 1)} חלש יחסית.`)
    }
  }

  if (macdLine != null && macdSignal != null) {
    if (macdLine > macdSignal) {
      bullish += 0.9
      addDriver(drivers, 'MACD מעל קו הסיגנל.')
    } else {
      bearish += 0.9
      addRisk(risks, 'MACD מתחת לקו הסיגנל.')
    }
  }

  if (ret20 != null) {
    if (ret20 > 5) {
      bullish += 0.8
      addDriver(drivers, `מומנטום אחרון חיובי: ${ret20 > 0 ? '+' : ''}${ret20}%.`)
    } else if (ret20 < -5) {
      bearish += 0.8
      addRisk(risks, `מומנטום אחרון שלילי: ${ret20}%.`)
    }
  } else if (ret5 != null) {
    if (ret5 > 3) bullish += 0.45
    if (ret5 < -3) bearish += 0.45
  }

  if (volumeRatio != null && volumeRatio > 1.5) {
    const last = ohlcv[index]
    if (last.c >= last.o) {
      bullish += 0.6
      addDriver(drivers, `נפח חריג חיובי (${round(volumeRatio, 2)}x).`)
    } else {
      bearish += 0.6
      addRisk(risks, `נפח חריג בירידה (${round(volumeRatio, 2)}x).`)
    }
  }

  if (volatilityPct != null && volatilityPct > 4) {
    addRisk(risks, `תנודתיות גבוהה (${round(volatilityPct, 1)}% ATR), עדיף לעבוד עם סטופ ברור.`)
  }

  return { bullish, bearish }
}

function scoreProfessionalLayer(signal, drivers, risks) {
  let bullish = 0
  let bearish = 0
  const pro = signal?.pro
  if (!pro) return { bullish, bearish }

  if (pro.professional?.confluencePct >= 65) {
    const score = signal.score >= 0 ? 1.2 : -1.2
    if (score > 0) {
      bullish += score
      addDriver(drivers, `קונפלואנס מקצועי גבוה: ${pro.professional.confluencePct}%.`)
    } else {
      bearish += Math.abs(score)
      addRisk(risks, `קונפלואנס מקצועי שלילי גבוה: ${pro.professional.confluencePct}%.`)
    }
  }

  if (pro.supportResistance?.breakoutUp) {
    bullish += 1
    addDriver(drivers, 'זוהתה פריצה מעל טווח אחרון.')
  }
  if (pro.supportResistance?.breakoutDown) {
    bearish += 1
    addRisk(risks, 'זוהתה שבירה מתחת לטווח אחרון.')
  }
  if (pro.supportResistance?.nearSupport) {
    bullish += 0.55
    addDriver(drivers, `המחיר קרוב לתמיכה סביב $${pro.supportResistance.nearestSupport}.`)
  }
  if (pro.supportResistance?.nearResistance) {
    bearish += 0.55
    addRisk(risks, `המחיר קרוב להתנגדות סביב $${pro.supportResistance.nearestResistance}.`)
  }

  if (pro.divergences?.bullish) {
    bullish += 1.1
    addDriver(drivers, 'קיימת סטייה חיובית מול RSI.')
  }
  if (pro.divergences?.bearish) {
    bearish += 1.1
    addRisk(risks, 'קיימת סטייה שלילית מול RSI.')
  }
  if (pro.institutional?.institutionalBuying) {
    bullish += 0.9
    addDriver(drivers, `זוהתה פעילות נפח חריגה (${pro.institutional.spikeCount} קפיצות).`)
  }

  const gap = pro.gaps?.nearestOpen
  if (gap) {
    const zone = `$${gap.zoneLow}-${gap.zoneHigh}`
    if (gap.direction === 'up' && gap.position === 'below') {
      bearish += gap.distancePct <= 3 ? 0.7 : 0.35
      addRisk(risks, `גאפ פתוח מתחת למחיר באזור ${zone}; ייתכן לחץ לסגירה.`)
    } else if (gap.direction === 'down' && gap.position === 'above') {
      bullish += gap.distancePct <= 3 ? 0.65 : 0.3
      addDriver(drivers, `גאפ פתוח מעל המחיר באזור ${zone}; יעד אפשרי לסגירה.`)
    } else {
      addRisk(risks, `המחיר בתוך אזור גאפ ${zone}, התנודתיות שם גבוהה יותר.`)
    }
  }

  return { bullish, bearish }
}

function scorePatternLayer(signal, drivers, risks) {
  let bullish = 0
  let bearish = 0
  const pattern = signal?.patterns?.best
  if (!pattern) return { bullish, bearish }

  const impact = clamp(Math.abs(pattern.weight ?? 0) / 40, 0.4, 1.4)
  if (pattern.direction === 'bullish') {
    bullish += impact
    addDriver(drivers, `תבנית מובילה חיובית: ${pattern.label}.`)
  } else if (pattern.direction === 'bearish') {
    bearish += impact
    addRisk(risks, `תבנית מובילה שלילית: ${pattern.label}.`)
  }

  return { bullish, bearish }
}

function scoreMultiTimeframeLayer(multiTimeframe, drivers, risks) {
  let bullish = 0
  let bearish = 0
  if (!multiTimeframe?.total) return { bullish, bearish }

  const strength = clamp(Math.abs(multiTimeframe.compositeScore) / 2.8, 0.4, 1.8)
  const alignmentBoost = multiTimeframe.alignmentPct >= 70 ? 0.45 : multiTimeframe.alignmentPct >= 55 ? 0.2 : 0

  if (multiTimeframe.bias === 'bullish') {
    bullish += strength + alignmentBoost
    addDriver(drivers, `הסכמה בין טווחים: ${multiTimeframe.bullish}/${multiTimeframe.total} בוליש (${multiTimeframe.alignmentPct}%).`)
  } else if (multiTimeframe.bias === 'bearish') {
    bearish += strength + alignmentBoost
    addRisk(risks, `הסכמה בין טווחים: ${multiTimeframe.bearish}/${multiTimeframe.total} בריש (${multiTimeframe.alignmentPct}%).`)
  } else {
    addRisk(risks, 'הטווחים לא מסכימים ביניהם, הצפי פחות חד.')
  }

  return { bullish, bearish }
}

function scoreEarningsLayer(earnings, drivers, risks) {
  let bullish = 0
  let bearish = 0
  if (!earnings) return { bullish, bearish }

  const lastReport = earnings.lastReport
  const nextReport = earnings.nextReport

  if (lastReport?.surprisePct != null) {
    if (lastReport.surprisePct > 5) {
      bullish += 0.45
      addDriver(drivers, `הדוח האחרון הפתיע לטובה (${lastReport.surprisePct}%).`)
    } else if (lastReport.surprisePct < -5) {
      bearish += 0.45
      addRisk(risks, `הדוח האחרון פספס צפי (${lastReport.surprisePct}%).`)
    }
  }

  if (nextReport?.date) {
    const daysToReport = nextReport.daysUntil
    const fallbackReportTime = new Date(`${nextReport.date}T00:00:00Z`).getTime()
    const fallbackDays = Number.isFinite(fallbackReportTime)
      ? Math.ceil((fallbackReportTime - Date.now()) / (1000 * 60 * 60 * 24))
      : null
    const resolvedDays = daysToReport ?? fallbackDays
    if (resolvedDays != null && resolvedDays >= 0 && resolvedDays <= 14) {
      addRisk(risks, `דוח קרוב בעוד ${resolvedDays} ימים - תנודתיות צפויה סביב האירוע.`)
    }
  }

  return { bullish, bearish }
}

function scoreEnsembleLayer(signal, drivers, risks) {
  let bullish = 0
  let bearish = 0
  const ensemble = signal?.ensemble
  if (!ensemble) return { bullish, bearish }

  const strength = clamp(Math.abs(ensemble.probability - 0.5) * 5, 0.25, 1.8)
  const agreementBoost = ensemble.agreementPct >= 80 ? 0.55 : ensemble.agreementPct >= 60 ? 0.25 : 0

  if (ensemble.bias === 'bullish') {
    bullish += strength + agreementBoost
    addDriver(drivers, `Ensemble v3: ${ensemble.buyVotes}/${ensemble.totalModels} מודלים מצביעים קנייה (${ensemble.probabilityPct}%).`)
  } else if (ensemble.bias === 'bearish') {
    bearish += strength + agreementBoost
    addRisk(risks, `Ensemble v3: ${ensemble.sellVotes}/${ensemble.totalModels} מודלים מצביעים מכירה (${100 - ensemble.probabilityPct}% לחץ מכירה).`)
  } else {
    addRisk(risks, `Ensemble v3 מעורב: ${ensemble.buyVotes} קנייה מול ${ensemble.sellVotes} מכירה.`)
  }

  return { bullish, bearish }
}

function scoreMarketContextLayer(marketContext, drivers, risks) {
  let bullish = 0
  let bearish = 0
  if (!marketContext) return { bullish, bearish }

  const strength = clamp(Math.abs(marketContext.score) / 2, 0.25, 1.6)

  if (['BULL', 'MILD_BULL'].includes(marketContext.condition)) {
    bullish += strength
    addDriver(drivers, `Market v4 תומך: ${marketContext.label}, התאמת SPY/QQQ ${marketContext.alignmentPct}%.`)
  } else if (['BEAR', 'MILD_BEAR', 'PANIC'].includes(marketContext.condition)) {
    bearish += marketContext.condition === 'PANIC' ? 2 : strength
    addRisk(risks, `Market v4 מזהיר: ${marketContext.label}, Score ${marketContext.score}.`)
  } else {
    addRisk(risks, 'Market v4 ניטרלי - אין רוח גבית ברורה מהשוק הרחב.')
  }

  if (marketContext.shouldBlockBuy) {
    bearish += 0.8
    addRisk(risks, 'שכבת השוק הרחב חוסמת קנייה אגרסיבית ללא אישור חזק.')
  }

  return { bullish, bearish }
}

function pickTarget({ bias, price, atr, decision, signal }) {
  const sr = signal?.pro?.supportResistance
  const pattern = signal?.patterns?.best
  const support = sr?.nearestSupport ?? null
  const resistance = sr?.nearestResistance ?? null

  if (bias === 'bullish') {
    const candidates = [
      decision?.holdUntil,
      pattern?.direction === 'bullish' ? pattern.targetPrice : null,
      resistance,
      atr ? price + atr * 2.2 : null,
    ].filter(value => value != null && value > price)
    const target = candidates.length ? Math.max(...candidates) : price * 1.04
    return round(target)
  }

  if (bias === 'bearish') {
    const candidates = [
      support,
      decision?.invalidation,
      pattern?.direction === 'bearish' ? pattern.targetPrice : null,
      atr ? price - atr * 2 : null,
    ].filter(value => value != null && value < price)
    const target = candidates.length ? Math.min(...candidates) : price * 0.96
    return round(target)
  }

  const candidates = [support, resistance].filter(value => value != null)
  if (candidates.length === 2) return round((support + resistance) / 2)
  return decision?.holdUntil ?? round(price)
}

function englishForecastText({ bias, interval, targetPrice, signal, ohlcv, indicators, multiTimeframe, marketContext, earnings }) {
  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const rsi = latest(indicators.rsi14, index)
  const sma50 = latest(indicators.sma50, index)
  const sma200 = latest(indicators.sma200, index)
  const macdLine = latest(indicators.macd?.line, index)
  const macdSignal = latest(indicators.macd?.signal, index)
  const volumeRatio = latest(indicators.volRatio, index)
  const drivers = []
  const risks = []
  const marketLabel = {
    PANIC: 'panic',
    BEAR: 'bearish',
    MILD_BEAR: 'mildly bearish',
    NEUTRAL: 'neutral',
    MILD_BULL: 'mildly bullish',
    BULL: 'bullish',
  }[marketContext?.condition] ?? marketContext?.label

  if (signal.buyProbability > signal.sellProbability + 10) {
    drivers.push(`The signal model favors buying (${signal.buyProbability}% vs ${signal.sellProbability}%).`)
  } else if (signal.sellProbability > signal.buyProbability + 10) {
    risks.push(`The signal model favors selling (${signal.sellProbability}% vs ${signal.buyProbability}%).`)
  }

  if (sma50 != null && sma200 != null) {
    if (price > sma50 && price > sma200 && sma50 >= sma200) drivers.push('Price is above SMA50 and SMA200, supporting a healthy trend structure.')
    if (price < sma50 && price < sma200) risks.push('Price is below the main moving averages, showing a weaker structure.')
  }
  if (rsi != null) {
    if (rsi >= 48 && rsi <= 65) drivers.push(`RSI ${round(rsi, 1)} is in a constructive momentum zone.`)
    if (rsi > 72) risks.push(`RSI ${round(rsi, 1)} is elevated, so pullback risk is higher.`)
    if (rsi < 30) drivers.push(`RSI ${round(rsi, 1)} is oversold, which can support a technical rebound.`)
    if (rsi < 42 && rsi >= 30) risks.push(`RSI ${round(rsi, 1)} is relatively weak.`)
  }
  if (macdLine != null && macdSignal != null) {
    if (macdLine > macdSignal) drivers.push('MACD is above the signal line.')
    else risks.push('MACD is below the signal line.')
  }
  if (volumeRatio != null && volumeRatio > 1.5) {
    const last = ohlcv[index]
    if (last.c >= last.o) drivers.push(`Positive high-volume move detected (${round(volumeRatio, 2)}x).`)
    else risks.push(`High-volume downside move detected (${round(volumeRatio, 2)}x).`)
  }
  if (signal.patterns?.best) {
    const pattern = signal.patterns.best
    if (pattern.direction === 'bullish') drivers.push(`Leading bullish pattern: ${pattern.label}.`)
    if (pattern.direction === 'bearish') risks.push(`Leading bearish pattern: ${pattern.label}.`)
  }
  if (multiTimeframe?.total) {
    if (multiTimeframe.bias === 'bullish') drivers.push(`Multi-timeframe alignment: ${multiTimeframe.bullish}/${multiTimeframe.total} bullish (${multiTimeframe.alignmentPct}%).`)
    if (multiTimeframe.bias === 'bearish') risks.push(`Multi-timeframe alignment: ${multiTimeframe.bearish}/${multiTimeframe.total} bearish (${multiTimeframe.alignmentPct}%).`)
    if (multiTimeframe.bias === 'neutral') risks.push('Timeframes are mixed, so the outlook is less decisive.')
  }
  if (marketContext) {
    if (['BULL', 'MILD_BULL'].includes(marketContext.condition)) drivers.push(`Broad market context supports the setup: ${marketLabel}.`)
    if (['BEAR', 'MILD_BEAR', 'PANIC'].includes(marketContext.condition)) risks.push(`Broad market context is a headwind: ${marketLabel}.`)
    if (marketContext.shouldBlockBuy) risks.push('Broad market conditions call for stronger confirmation before new aggressive buys.')
  }
  if (earnings?.nextReport?.daysUntil != null && earnings.nextReport.daysUntil >= 0 && earnings.nextReport.daysUntil <= 14) {
    risks.push(`Earnings are due in ${earnings.nextReport.daysUntil} days, so volatility can rise around the event.`)
  }

  const summary = bias === 'bullish'
    ? `The current outlook is bullish on the ${horizonLabel(interval, 'en')}. As long as price holds above the protection area, the next technical target is around $${targetPrice}.`
    : bias === 'bearish'
      ? `The current outlook is bearish on the ${horizonLabel(interval, 'en')}. Negative pressure is stronger, with a downside technical target around $${targetPrice}.`
      : `The current outlook is neutral on the ${horizonLabel(interval, 'en')}. There is no clear edge yet, so waiting for a break above resistance or below support is preferable.`

  return { summary, drivers: drivers.slice(0, 5), risks: risks.slice(0, 5) }
}

export function computeForecastOpinion({ ohlcv, indicators, signal, interval, earnings, multiTimeframe, marketContext, language = 'he' }) {
  if (!ohlcv?.length || !indicators || !signal) return null

  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const atr = latest(indicators.atr14, index)
  const decision = signal.decision
  const drivers = []
  const risks = []

  const layers = [
    scoreSignalLayer(signal, drivers, risks),
    scoreIndicatorLayer(ohlcv, indicators, drivers, risks),
    scoreProfessionalLayer(signal, drivers, risks),
    scorePatternLayer(signal, drivers, risks),
    scoreMultiTimeframeLayer(multiTimeframe, drivers, risks),
    scoreEarningsLayer(earnings, drivers, risks),
    scoreEnsembleLayer(signal, drivers, risks),
    scoreMarketContextLayer(marketContext, drivers, risks),
  ]

  const bullishScore = round(layers.reduce((sum, layer) => sum + layer.bullish, 0), 2)
  const bearishScore = round(layers.reduce((sum, layer) => sum + layer.bearish, 0), 2)
  const net = bullishScore - bearishScore
  const bias = net >= 1.8 ? 'bullish' : net <= -1.8 ? 'bearish' : 'neutral'
  const copy = biasCopy(bias, language)
  const confidenceBase = 48 + Math.abs(net) * 7 + (multiTimeframe?.alignmentPct ?? 0) * 0.08
  const confidence = Math.round(clamp(confidenceBase, 45, 92))
  const targetPrice = pickTarget({ bias, price, atr, decision, signal })
  const targetPct = pct(price, targetPrice)
  const support = signal.pro?.supportResistance?.nearestSupport ?? decision?.support ?? null
  const resistance = signal.pro?.supportResistance?.nearestResistance ?? decision?.resistance ?? null
  const invalidBelow = decision?.invalidation ?? (atr ? price - atr * 1.5 : support)
  const buyAbove = decision?.buyAbove ?? resistance
  const holdAbove = support ?? decision?.trailingStop ?? invalidBelow

  const summary = language === 'en'
    ? englishForecastText({ bias, interval, targetPrice, signal, ohlcv, indicators, multiTimeframe, marketContext, earnings }).summary
    : bias === 'bullish'
    ? `הצפי כרגע בוליש ב${horizonLabel(interval)}: כל עוד המחיר מחזיק מעל אזור ההגנה, היעד הטכני הבא הוא סביב $${targetPrice}.`
    : bias === 'bearish'
      ? `הצפי כרגע בריש ב${horizonLabel(interval)}: הלחץ השלילי גובר, והיעד הטכני למטה נמצא סביב $${targetPrice}.`
      : `הצפי כרגע ניטרלי ב${horizonLabel(interval)}: אין יתרון מספיק חד, עדיף להמתין לפריצה מעל התנגדות או שבירה מתחת לתמיכה.`

  return {
    bias,
    label: copy.label,
    tone: copy.tone,
    expectation: copy.expectation,
    suggestedAction: copy.action,
    confidence,
    currentPrice: round(price),
    targetPrice,
    targetPct,
    bullishScore,
    bearishScore,
    netScore: round(net, 2),
    horizon: horizonLabel(interval, language),
    holdAbove: round(holdAbove),
    buyAbove: round(buyAbove),
    invalidBelow: round(invalidBelow),
    support: round(support),
    resistance: round(resistance),
    summary,
    drivers: language === 'en' ? englishForecastText({ bias, interval, targetPrice, signal, ohlcv, indicators, multiTimeframe, marketContext, earnings }).drivers : drivers.slice(0, 5),
    risks: language === 'en' ? englishForecastText({ bias, interval, targetPrice, signal, ohlcv, indicators, multiTimeframe, marketContext, earnings }).risks : risks.slice(0, 5),
    multiTimeframe,
    marketContext,
  }
}
