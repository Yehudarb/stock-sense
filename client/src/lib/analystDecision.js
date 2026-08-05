function roundPrice(value) {
  if (value == null || Number.isNaN(value)) return null
  return Number(value.toFixed(value >= 100 ? 2 : 3))
}

function pct(from, to) {
  if (!from || to == null) return null
  return Number((((to - from) / from) * 100).toFixed(2))
}

function latestValue(values, index) {
  return values?.[index] ?? null
}

function recentHigh(ohlcv, periods = 20) {
  const bars = ohlcv.slice(Math.max(0, ohlcv.length - periods - 1), -1)
  if (!bars.length) return ohlcv.at(-1)?.h ?? null
  return Math.max(...bars.map(bar => bar.h))
}

function recentLow(ohlcv, periods = 20) {
  const bars = ohlcv.slice(Math.max(0, ohlcv.length - periods - 1), -1)
  if (!bars.length) return ohlcv.at(-1)?.l ?? null
  return Math.min(...bars.map(bar => bar.l))
}

function actionCopy(action) {
  return {
    STRONG_BUY: {
      label: 'קנייה חזקה',
      headline: 'אפשר לשקול כניסה, עם סטופ ברור ויעד מוגדר.',
      tone: 'bullish',
    },
    BUY: {
      label: 'קנייה',
      headline: 'הכיוון חיובי, עדיף כניסה מדורגת ולא רדיפה אחרי מחיר.',
      tone: 'bullish',
    },
    HOLD: {
      label: 'החזקה / המתנה',
      headline: 'אין יתרון מספיק ברור לכניסה חדשה; מי שכבר בפנים מחזיק עם סטופ.',
      tone: 'neutral',
    },
    SELL: {
      label: 'מכירה',
      headline: 'הסיכון הטכני גבוה יותר מהסיכוי כרגע; עדיף לצמצם חשיפה.',
      tone: 'bearish',
    },
    STRONG_SELL: {
      label: 'מכירה חזקה',
      headline: 'הלחץ השלילי משמעותי; ההגנה על ההון קודמת לחיפוש ריבאונד.',
      tone: 'bearish',
    },
  }[action] ?? {
    label: 'המתנה',
    headline: 'אין מסקנה ברורה כרגע.',
    tone: 'neutral',
  }
}

function buildReasons({ signal, trend, rsi, macdLine, macdSig, price, sma20, sma50, sma200, volumeRatio }) {
  const reasons = []
  const pro = signal.pro
  const bestPattern = signal.patterns?.best

  if (trend?.regime === 'uptrend') reasons.push('המניה מעל ממוצעים מרכזיים והמגמה תומכת.')
  if (trend?.regime === 'downtrend') reasons.push('המניה מתחת לממוצעים מרכזיים והמגמה חלשה.')
  if (trend?.regime === 'sideways') reasons.push('המניה בטווח צדדי, לכן האות פחות חד.')
  if (pro?.professional?.confluencePct != null) reasons.push(`קונפלואנס מקצועי: ${pro.professional.confluencePct}% (${pro.professional.confidenceLevel}).`)
  if (pro?.gaps?.nearestOpen) {
    const gap = pro.gaps.nearestOpen
    const status = gap.status === 'partial' ? `נסגר חלקית ${gap.fillPct}%` : 'עדיין פתוח'
    // ⁦...⁩ (LRI/PDI) force the "$low-$high" run to render in its
    // own left-to-right order - without it, the hyphen between two LTR
    // number runs sits inside RTL Hebrew text and the bidi algorithm can
    // visually flip which number appears first.
    reasons.push(`גאפ ${gap.direction === 'up' ? 'עולה' : 'יורד'} ${status} באזור ⁦$${gap.zoneLow}-$${gap.zoneHigh}⁩.`)
  }
  if (pro?.gaps?.recentlyClosed?.closeAgeBars != null && pro.gaps.recentlyClosed.closeAgeBars <= 15) {
    const gap = pro.gaps.recentlyClosed
    reasons.push(`גאפ נסגר באזור ⁦$${gap.zoneLow}-$${gap.zoneHigh}⁩.`)
  }
  if (pro?.supportResistance?.nearSupport) reasons.push(`המחיר קרוב לתמיכה סביב $${pro.supportResistance.nearestSupport}.`)
  if (pro?.supportResistance?.nearResistance) reasons.push(`המחיר קרוב להתנגדות סביב $${pro.supportResistance.nearestResistance}.`)
  if (pro?.institutional?.institutionalBuying) reasons.push(`זוהתה פעילות נפח חריגה: ${pro.institutional.spikeCount} קפיצות נפח.`)
  if (pro?.divergences?.bullish) reasons.push('יש divergence חיובי בין מחיר ל-RSI.')
  if (pro?.divergences?.bearish) reasons.push('יש divergence שלילי בין מחיר ל-RSI.')
  if (bestPattern) reasons.push(`תבנית מובילה: ${bestPattern.label}, יעד משוער $${bestPattern.targetPrice} (${bestPattern.potentialPct}%).`)
  if (signal?.ensemble) {
    const ensemble = signal.ensemble
    const direction = ensemble.bias === 'bullish' ? 'בוליש' : ensemble.bias === 'bearish' ? 'בריש' : 'מעורב'
    reasons.push(`Ensemble v3 ${direction}: ${ensemble.buyVotes}/${ensemble.totalModels} מודלים בעד קנייה, ציון כיווני ${ensemble.directionalScore}/100, הסכמה ${ensemble.agreementPct}%.`)
  }

  if (rsi != null && rsi < 35) reasons.push('RSI נמוך ומרמז על מכירת יתר אפשרית.')
  if (rsi != null && rsi > 70) reasons.push('RSI גבוה ומרמז על קניית יתר.')

  if (macdLine != null && macdSig != null && macdLine > macdSig) reasons.push('MACD מעל קו הסיגנל ותומך במומנטום חיובי.')
  if (macdLine != null && macdSig != null && macdLine < macdSig) reasons.push('MACD מתחת לקו הסיגנל ומאותת חולשה.')

  if (price != null && sma20 != null && price > sma20) reasons.push('המחיר מעל SMA20, הקונים עדיין שולטים בטווח הקצר.')
  if (price != null && sma50 != null && sma200 != null && price < sma50 && price < sma200) reasons.push('המחיר מתחת ל-SMA50 ול-SMA200, כניסה חדשה מסוכנת יותר.')
  if (volumeRatio != null && volumeRatio > 1.5) reasons.push('נפח המסחר גבוה מהממוצע ומחזק את האות.')
  if (signal?.gates?.confluence?.active != null && signal.score >= 0) {
    reasons.push(`${signal.gates.confluence.active}/${signal.gates.confluence.total} אינדיקטורים מיושרים לצד הקנייה.`)
  }

  return reasons.slice(0, 4)
}

export function computeAnalystDecision(ohlcv, indicators, signal, risk, _language = 'he', cupHandle = null) {
  if (!ohlcv?.length || !indicators || !signal) return null

  const last = ohlcv.length - 1
  const price = ohlcv[last].c
  const atr = indicators.atr14?.[last] ?? 0
  const sma20 = latestValue(indicators.sma20, last)
  const sma50 = latestValue(indicators.sma50, last)
  const sma200 = latestValue(indicators.sma200, last)
  const rsi = latestValue(indicators.rsi14, last)
  const macdLine = latestValue(indicators.macd?.line, last)
  const macdSig = latestValue(indicators.macd?.signal, last)
  const volumeRatio = latestValue(indicators.volRatio, last)
  const high20 = recentHigh(ohlcv)
  const low20 = recentLow(ohlcv)
  const requestedAction = signal.action
  const pro = signal.pro
  const bestPattern = signal.patterns?.best
  const nearestGap = pro?.gaps?.nearestOpen ?? null
  const nearestSupport = pro?.supportResistance?.nearestSupport ?? null
  const nearestResistance = pro?.supportResistance?.nearestResistance ?? null
  const breakoutConfirmed = Boolean(pro?.supportResistance?.breakoutUp && (volumeRatio ?? 0) >= 1.2)
  const cupHandleBreakout = Boolean(
    cupHandle?.stage === 'broken_out' &&
    cupHandle.breakoutConfirmed === true &&
    Number.isFinite(cupHandle.pivot) &&
    price >= cupHandle.pivot &&
    (!Number.isFinite(cupHandle.stopLoss) || price > cupHandle.stopLoss),
  )

  const stopLoss = risk?.stopLoss ?? roundPrice(price - atr * 1.5)
  const takeProfit = risk?.takeProfit ?? roundPrice(price + atr * 2)
  const trailingStop = risk?.trailingStop ?? roundPrice(price - atr * 1.2)
  const breakoutBuy = roundPrice(high20 + atr * 0.15)
  const breakdownSell = roundPrice(Math.max(stopLoss, low20 - atr * 0.1))

  let entryLow = roundPrice(price - atr * 0.6)
  let entryHigh = roundPrice(price + atr * 0.2)
  let holdUntil = takeProfit
  let invalidation = stopLoss
  let primaryAction = actionCopy(requestedAction).label

  if (signal.action === 'STRONG_BUY') {
    entryLow = roundPrice(Math.min(price, sma20 ?? price) - atr * 0.25)
    entryHigh = roundPrice(price + atr * 0.35)
    holdUntil = roundPrice(price + atr * 2.4)
  } else if (signal.action === 'BUY') {
    entryLow = roundPrice(Math.min(price, sma20 ?? price) - atr * 0.35)
    entryHigh = roundPrice(price + atr * 0.15)
  } else if (signal.action === 'HOLD') {
    primaryAction = 'להחזיק אם כבר בפנים, להמתין אם בחוץ'
    entryLow = roundPrice(Math.min(sma20 ?? price, price - atr * 0.5))
    entryHigh = breakoutBuy
    holdUntil = roundPrice(Math.max(takeProfit, high20))
    invalidation = trailingStop
  } else {
    primaryAction = 'למכור / לצמצם חשיפה'
    entryLow = null
    entryHigh = null
    holdUntil = roundPrice(Math.max(price, sma20 ?? price))
    invalidation = breakdownSell
  }

  if (nearestSupport != null && signal.action !== 'SELL' && signal.action !== 'STRONG_SELL') {
    entryLow = roundPrice(Math.min(entryLow ?? price, nearestSupport))
    invalidation = roundPrice(Math.min(invalidation, nearestSupport - atr * 0.35))
  }

  if (nearestResistance != null && nearestResistance > price) {
    holdUntil = breakoutConfirmed
      ? roundPrice(Math.max(holdUntil, nearestResistance))
      : roundPrice(Math.min(holdUntil, nearestResistance))
  }

  if (pro?.professional?.confluencePct >= 80 && signal.action !== 'SELL' && signal.action !== 'STRONG_SELL') {
    holdUntil = roundPrice(holdUntil + atr * 0.5)
  }

  if (bestPattern?.targetPrice != null) {
    if (bestPattern.direction === 'bullish' && signal.action !== 'SELL' && signal.action !== 'STRONG_SELL') {
      holdUntil = roundPrice(Math.max(holdUntil, bestPattern.targetPrice))
    }
    if (bestPattern.direction === 'bearish') {
      invalidation = roundPrice(Math.min(invalidation, bestPattern.targetPrice))
      if (signal.action === 'HOLD') {
        primaryAction = 'להחזיק בזהירות / לצמצם אם נשבר יעד התבנית'
      }
    }
  }

  // A projected pattern target does not cancel real overhead supply. Until a
  // closed candle breaks resistance on volume, the first target is capped at
  // that resistance and the trade must pass the resulting R:R check.
  if (!breakoutConfirmed && nearestResistance != null && nearestResistance > price) {
    holdUntil = roundPrice(Math.min(holdUntil, nearestResistance))
  }

  // Final sanity clamp. Every adjustment above can independently push
  // entry/invalidation/holdUntil further out (stale support/resistance
  // from anywhere in history, a 20-bar high/low from before a sharp move,
  // ATR that's currently inflated by a violent multi-day swing, a pattern
  // target, etc). Any one of those alone is a reasonable input; combined,
  // and especially right after a fast crash or spike, they can drift to
  // levels no professional trader would actually call an "entry," a
  // "stop," or a "target" - e.g. an entry zone reaching 2x the current
  // price isn't an entry zone, and a stop 60% away isn't protecting
  // anything. Cap all of them to a sane distance from the current price
  // regardless of which branch/adjustment produced them, with the target
  // ceiling roughly 2.5x the entry/stop ceiling to keep a plausible
  // risk/reward shape.
  const MAX_STOP_DISTANCE_PCT = 0.08
  const MAX_TARGET_DISTANCE_PCT = 0.12

  if (invalidation != null) {
    invalidation = invalidation < price
      ? roundPrice(Math.max(invalidation, price * (1 - MAX_STOP_DISTANCE_PCT)))
      : roundPrice(Math.min(invalidation, price * (1 + MAX_STOP_DISTANCE_PCT)))
  }

  if (holdUntil != null) {
    holdUntil = holdUntil > price
      ? roundPrice(Math.min(holdUntil, price * (1 + MAX_TARGET_DISTANCE_PCT)))
      : roundPrice(Math.max(holdUntil, price * (1 - MAX_TARGET_DISTANCE_PCT)))
  }

  if (entryLow != null) {
    entryLow = entryLow < price
      ? roundPrice(Math.max(entryLow, price * (1 - MAX_STOP_DISTANCE_PCT)))
      : roundPrice(Math.min(entryLow, price * (1 + MAX_STOP_DISTANCE_PCT)))
  }

  if (entryHigh != null) {
    entryHigh = entryHigh < price
      ? roundPrice(Math.max(entryHigh, price * (1 - MAX_STOP_DISTANCE_PCT)))
      : roundPrice(Math.min(entryHigh, price * (1 + MAX_STOP_DISTANCE_PCT)))
  }

  // breakoutBuy/buyAbove feeds the same stale-high failure mode and is
  // surfaced on its own (forecastOpinion.js falls back to it as a
  // resistance level), so it needs the same cap.
  const buyAbove = breakoutBuy > price
    ? roundPrice(Math.min(breakoutBuy, price * (1 + MAX_STOP_DISTANCE_PCT)))
    : roundPrice(breakoutBuy)

  // Keep the whole picture internally consistent after clamping: an entry
  // zone with a target below its own top, or a stop above its own bottom,
  // would mean the "take profit"/"protection" level is a guaranteed loss
  // relative to part of the entry zone - exactly the contradiction this
  // fix exists to remove.
  if (holdUntil != null && entryHigh != null && holdUntil <= entryHigh) {
    holdUntil = roundPrice(Math.min(entryHigh * 1.05, price * (1 + MAX_TARGET_DISTANCE_PCT)))
  }
  if (invalidation != null && entryLow != null && invalidation >= entryLow) {
    invalidation = roundPrice(Math.max(entryLow * 0.95, price * (1 - MAX_STOP_DISTANCE_PCT * 1.5)))
  }
  if (!breakoutConfirmed && nearestResistance != null && nearestResistance > price) {
    holdUntil = roundPrice(Math.min(holdUntil, nearestResistance))
  }

  const entryReference = entryLow != null && entryHigh != null
    ? (entryLow + entryHigh) / 2
    : null
  const plannedRisk = entryReference != null && invalidation != null ? entryReference - invalidation : null
  const plannedReward = entryReference != null && holdUntil != null ? holdUntil - entryReference : null
  const plannedRiskReward = plannedRisk > 0 && plannedReward > 0
    ? Number((plannedReward / plannedRisk).toFixed(2))
    : null
  const targetPct = entryReference != null && holdUntil != null ? pct(entryReference, holdUntil) : null
  const isLongRequest = requestedAction === 'BUY' || requestedAction === 'STRONG_BUY'
  const entryApproved = !isLongRequest || (
    risk?.tradeValid !== false &&
    plannedRiskReward != null && plannedRiskReward >= 1.5 &&
    targetPct != null && targetPct >= 5 && targetPct <= 12 &&
    invalidation < entryLow
  )
  const finalAction = isLongRequest && !entryApproved ? 'HOLD' : requestedAction
  const copy = actionCopy(finalAction)
  if (isLongRequest && !entryApproved) {
    primaryAction = 'להמתין - יחס סיכון/סיכוי או יעד אינם תקינים'
    entryLow = null
    entryHigh = null
  }

  const reasons = buildReasons({
    signal,
    trend: signal.gates?.trend,
    rsi,
    macdLine,
    macdSig,
    price,
    sma20,
    sma50,
    sma200,
    volumeRatio,
  })
  if (isLongRequest && !entryApproved) {
    reasons.unshift(`הכניסה נחסמה: נדרש יעד של 5%-12% ויחס סיכון/סיכוי של לפחות 1:1.5; כרגע ${plannedRiskReward ?? '-'} ויעד ${targetPct ?? '-'}%.`)
  }

  return {
    action: finalAction,
    requestedAction,
    tone: copy.tone,
    label: copy.label,
    primaryAction,
    headline: copy.headline,
    signalStrength: signal.confidence,
    currentPrice: roundPrice(price),
    entryLow,
    entryHigh,
    buyAbove,
    holdUntil: roundPrice(holdUntil),
    takeProfit: roundPrice(holdUntil),
    stopLoss: roundPrice(invalidation),
    atrStop: roundPrice(stopLoss),
    trailingStop: roundPrice(trailingStop),
    invalidation: roundPrice(invalidation),
    stopContext: risk?.stopContext ?? null,
    riskReward: plannedRiskReward,
    entryApproved,
    targetPct,
    breakoutConfirmed,
    cupHandle: cupHandle ? {
      ...cupHandle,
      activeBreakout: cupHandleBreakout,
    } : null,
    cupHandleBreakout,
    proConfluence: pro?.professional?.confluencePct ?? null,
    support: nearestSupport,
    resistance: nearestResistance,
    regime: pro?.marketRegime ?? null,
    patternTarget: bestPattern?.targetPrice ?? null,
    patternPotentialPct: bestPattern?.potentialPct ?? null,
    patternLabel: bestPattern?.label ?? null,
    gapZone: nearestGap ? `${roundPrice(nearestGap.zoneLow)} - ${roundPrice(nearestGap.zoneHigh)}` : null,
    gapStatus: nearestGap?.status ?? null,
    gapFillPct: nearestGap?.fillPct ?? null,
    gapDirection: nearestGap?.direction ?? null,
    upsidePct: pct(price, holdUntil),
    downsidePct: pct(price, invalidation),
    reasons,
    shortConclusion: `${primaryAction}. יעד עבודה: ${roundPrice(holdUntil) ? `$${roundPrice(holdUntil)}` : '-'}, הגנה: ${roundPrice(invalidation) ? `$${roundPrice(invalidation)}` : '-'}.`,
  }
}
