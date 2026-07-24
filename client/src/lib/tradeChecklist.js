// Pre-trade checklist: scores the setup against the same 10 checks a
// discretionary trader would run manually (trend, structure, price action,
// RSI, MACD, Bollinger, volume, ATR, divergence, earnings proximity).
// Every input already exists elsewhere in the app (indicators.js, signals.js,
// professionalFeatures.js, forecastOpinion.js) - this module only assembles
// them into a single pass/fail scorecard instead of computing anything new.

function round(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function latest(values, index) {
  return values?.[index] ?? null
}

function checklistCopy(language) {
  if (language === 'en') {
    return {
      trend: 'Trend',
      structure: 'Support / Resistance',
      priceAction: 'Price action pattern',
      rsi: 'RSI zone',
      macd: 'MACD crossover',
      bollinger: 'Bollinger position',
      volume: 'Volume confirmation',
      atr: 'Volatility (ATR) fits a sane stop',
      divergence: 'Divergence',
      news: 'No earnings in the next 2 days',
    }
  }
  return {
    trend: 'מגמה',
    structure: 'תמיכה / התנגדות',
    priceAction: 'תבנית נרות',
    rsi: 'אזור RSI',
    macd: 'חצייה ב-MACD',
    bollinger: 'מיקום מול Bollinger',
    volume: 'אישור נפח',
    atr: 'תנודתיות (ATR) מתאימה לסטופ הגיוני',
    divergence: 'Divergence',
    news: 'אין דוח רווחים ב-48 השעות הקרובות',
  }
}

/**
 * Build the 10-item pre-trade checklist described in the trading guide.
 * Every item is evaluated relative to forecast.bias - the checklist asks
 * "does the data confirm THIS trade direction," not "is everything bullish."
 *
 * @returns {object|null} { bias, score, total, recommendation, items } or
 *   null if there isn't enough data, or a neutral-bias placeholder if the
 *   forecast has no clear direction to check against.
 */
export function buildTradeChecklist({ ohlcv, indicators, signal, forecast, earnings, language = 'he' }) {
  if (!ohlcv?.length || !indicators || !signal || !forecast) return null

  const copy = checklistCopy(language)
  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const bias = forecast.bias

  if (bias === 'neutral') {
    return { bias, score: null, total: 10, recommendation: 'no-bias', items: [] }
  }

  const bullish = bias === 'bullish'
  const items = []

  // 1. Trend
  const regime = signal?.gates?.trend?.regime
  items.push({
    key: 'trend',
    label: copy.trend,
    pass: bullish ? regime === 'uptrend' : regime === 'downtrend',
    detail: regime ?? (language === 'en' ? 'unknown' : 'לא ידוע'),
  })

  // 2. Structure - do we have identified support/resistance to work with
  const support = forecast.support
  const resistance = forecast.resistance
  items.push({
    key: 'structure',
    label: copy.structure,
    pass: support != null && resistance != null,
    detail: support != null && resistance != null
      ? `S ${round(support, 2)} / R ${round(resistance, 2)}`
      : (language === 'en' ? 'not identified' : 'לא זוהו'),
  })

  // 3. Price action - leading pattern aligned with the trade direction
  const pattern = signal?.patterns?.best
  items.push({
    key: 'priceAction',
    label: copy.priceAction,
    pass: Boolean(pattern) && ((bullish && pattern.direction === 'bullish') || (!bullish && pattern.direction === 'bearish')),
    detail: pattern?.label ?? (language === 'en' ? 'none detected' : 'לא זוהתה תבנית'),
  })

  // 4. RSI zone (guide: <35 oversold for longs, >65 overbought for shorts)
  const rsi = latest(indicators.rsi14, index)
  items.push({
    key: 'rsi',
    label: copy.rsi,
    pass: rsi != null && (bullish ? rsi < 35 : rsi > 65),
    detail: rsi != null ? `RSI ${round(rsi)}` : '-',
  })

  // 5. MACD crossover direction
  const macdLine = latest(indicators.macd?.line, index)
  const macdSignal = latest(indicators.macd?.signal, index)
  items.push({
    key: 'macd',
    label: copy.macd,
    pass: macdLine != null && macdSignal != null && (bullish ? macdLine > macdSignal : macdLine < macdSignal),
    detail: macdLine != null && macdSignal != null ? `${round(macdLine, 3)} vs ${round(macdSignal, 3)}` : '-',
  })

  // 6. Bollinger position - price hugging the band on the trade's side
  const bbUpper = latest(indicators.bb20?.upper, index)
  const bbLower = latest(indicators.bb20?.lower, index)
  items.push({
    key: 'bollinger',
    label: copy.bollinger,
    pass: bullish ? (bbLower != null && price <= bbLower * 1.02) : (bbUpper != null && price >= bbUpper * 0.98),
    detail: bbUpper != null && bbLower != null ? `${round(bbLower, 2)} - ${round(bbUpper, 2)}` : '-',
  })

  // 7. Volume confirmation
  const volRatio = latest(indicators.volRatio, index)
  items.push({
    key: 'volume',
    label: copy.volume,
    pass: volRatio != null && volRatio >= 1.5,
    detail: volRatio != null ? `${round(volRatio, 2)}x` : '-',
  })

  // 8. ATR / volatility sane enough for a reasonable stop (guide caps
  // aggressive stops around 5-8% of price)
  const atr = latest(indicators.atr14, index)
  const atrPct = atr != null && price ? (atr / price) * 100 : null
  items.push({
    key: 'atr',
    label: copy.atr,
    pass: atrPct != null && atrPct <= 8,
    detail: atrPct != null ? `ATR ${round(atrPct)}%` : '-',
  })

  // 9. Divergence supporting the direction
  const divergences = signal?.pro?.divergences
  items.push({
    key: 'divergence',
    label: copy.divergence,
    pass: bullish ? Boolean(divergences?.bullish) : Boolean(divergences?.bearish),
    detail: divergences?.bullish
      ? (language === 'en' ? 'bullish divergence' : 'divergence חיובי')
      : divergences?.bearish
        ? (language === 'en' ? 'bearish divergence' : 'divergence שלילי')
        : (language === 'en' ? 'none' : 'אין'),
  })

  // 10. No earnings event imminent
  const daysUntil = earnings?.nextReport?.daysUntil
  items.push({
    key: 'news',
    label: copy.news,
    pass: daysUntil == null || daysUntil > 2 || daysUntil < 0,
    detail: daysUntil != null && daysUntil >= 0
      ? (language === 'en' ? `${daysUntil}d away` : `בעוד ${daysUntil} ימים`)
      : (language === 'en' ? 'none scheduled' : 'לא ידוע/אין'),
  })

  const score = items.filter(item => item.pass).length
  const recommendation = score >= 7 ? 'ready' : score >= 6 ? 'borderline' : 'wait'

  return { bias, score, total: items.length, recommendation, items }
}
