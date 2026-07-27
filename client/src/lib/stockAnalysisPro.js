/**
 * Stock Analysis Pro — the `stock-analysis-pro` skill implemented as an
 * in-app analysis engine.
 *
 * The skill's core rule is "never invent prices, financial results, dates,
 * estimates, news, analyst targets, technical levels, or probabilities". This
 * module therefore never derives a number it was not given: every field is
 * either computed from the OHLCV/indicator inputs or reported as unavailable
 * with a stated reason.
 *
 * Two more skill rules are enforced structurally rather than by convention:
 *   • A score is not a probability. `signal.buyProbability` is deliberately not
 *     surfaced here; confidence is Low / Moderate / High with an explanation.
 *   • No trade plan below the data-quality gate. `tradePlan.noValidSetup` is
 *     the expected output whenever the requirements are not met — preferred
 *     over forcing a setup.
 *
 * Pure and dependency-free on purpose: no React, no axios, no network. All
 * inputs arrive from the existing hooks (see `useStockAnalysisPro`).
 */

export const DATA_QUALITY = {
  VERIFIED: 'VERIFIED',
  ACCEPTABLE: 'ACCEPTABLE',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
}

const QUALITY_RANK = {
  [DATA_QUALITY.VERIFIED]: 3,
  [DATA_QUALITY.ACCEPTABLE]: 2,
  [DATA_QUALITY.DEGRADED]: 1,
  [DATA_QUALITY.UNAVAILABLE]: 0,
}

// Leverage multiples are only listed for funds whose structure has been stable.
// Anything matched by name heuristics alone gets `leverage: null` — the skill
// forbids inventing a multiple, and issuers do change them (TSLS went from -2x
// to -1x). `needsIssuerVerification` stays true either way.
const LEVERAGED_ETFS = {
  TQQQ: { leverage: 3, benchmark: 'QQQ / Nasdaq-100' },
  SQQQ: { leverage: -3, benchmark: 'QQQ / Nasdaq-100' },
  UPRO: { leverage: 3, benchmark: 'S&P 500' },
  SPXU: { leverage: -3, benchmark: 'S&P 500' },
  SPXL: { leverage: 3, benchmark: 'S&P 500' },
  SPXS: { leverage: -3, benchmark: 'S&P 500' },
  UDOW: { leverage: 3, benchmark: 'Dow Jones 30' },
  SDOW: { leverage: -3, benchmark: 'Dow Jones 30' },
  TNA: { leverage: 3, benchmark: 'Russell 2000' },
  TZA: { leverage: -3, benchmark: 'Russell 2000' },
  SOXL: { leverage: 3, benchmark: 'Semiconductor index' },
  SOXS: { leverage: -3, benchmark: 'Semiconductor index' },
  LABU: { leverage: 3, benchmark: 'Biotech index' },
  LABD: { leverage: -3, benchmark: 'Biotech index' },
  YINN: { leverage: 3, benchmark: 'China large-cap index' },
  YANG: { leverage: -3, benchmark: 'China large-cap index' },
  TSLL: { leverage: 2, benchmark: 'TSLA' },
  NVDL: { leverage: 2, benchmark: 'NVDA' },
  CONL: { leverage: 2, benchmark: 'COIN' },
}

const LEVERAGE_NAME_HINTS = /\b(2x|3x|1\.5x|ultra|ultrapro|inverse|bull\s*\d?x?|bear\s*\d?x?|daily\s+target|leveraged)\b/i
const ETF_NAME_HINTS = /\b(etf|etn|fund|trust|index|shares)\b/i

const MIN_BARS_FOR_ANALYSIS = 60
const MIN_RR_SWING = 1.5
const MIN_RR_ELEVATED_RISK = 2.0
const EARNINGS_BLOCK_DAYS = 7

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null
  return Number(Number(value).toFixed(digits))
}

function pct(from, to) {
  if (!from || to == null || !Number.isFinite(from) || !Number.isFinite(to)) return null
  return round(((to - from) / from) * 100)
}

function lastOf(values) {
  if (!Array.isArray(values)) return null
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null && Number.isFinite(values[i])) return values[i]
  }
  return null
}

function lowerQuality(current, candidate) {
  return QUALITY_RANK[candidate] < QUALITY_RANK[current] ? candidate : current
}

/** Localized string helper — mirrors the he/en split used across the app. */
function makeT(language) {
  return (he, en) => (language === 'en' ? en : he)
}

/**
 * Market session in US Eastern time, derived from a timestamp. Used by the
 * data-quality gate: an intraday claim made outside the regular session is a
 * different kind of claim than one made during it.
 */
export function marketSession(timestamp, language = 'he') {
  const t = makeT(language)
  if (!timestamp) return { session: 'unknown', label: t('לא ידוע', 'Unknown') }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(timestamp))

  const get = type => parts.find(part => part.type === type)?.value
  const weekday = get('weekday')
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))

  if (weekday === 'Sat' || weekday === 'Sun') {
    return { session: 'closed', label: t('שוק סגור (סוף שבוע)', 'Market closed (weekend)') }
  }
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return { session: 'pre', label: t('טרום-מסחר', 'Pre-market') }
  }
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return { session: 'regular', label: t('מסחר רגיל', 'Regular session') }
  }
  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return { session: 'after', label: t('אחרי המסחר', 'After hours') }
  }
  return { session: 'closed', label: t('שוק סגור', 'Market closed') }
}

/** Step 1 — validate the instrument. */
function classifyInstrument({ ticker, snapshot, profile, language }) {
  const t = makeT(language)
  const symbol = (ticker ?? '').toUpperCase()
  const name = profile?.name ?? snapshot?.name ?? null
  const known = LEVERAGED_ETFS[symbol]
  const nameHint = name ? LEVERAGE_NAME_HINTS.test(name) : false
  const isLeveraged = Boolean(known) || nameHint
  const looksEtf = Boolean(known) || (name ? ETF_NAME_HINTS.test(name) : false)
  const notes = []

  if (!name) {
    notes.push(t(
      'שם המכשיר לא אומת מול מקור חיצוני — סיווג המכשיר חלקי.',
      'The instrument name was not verified against an external source — classification is partial.',
    ))
  }
  if (isLeveraged) {
    notes.push(t(
      'זוהה כקרן ממונפת/הופכית. מכפיל המינוף, יחס ההוצאות ומדיניות האיזון היומי חייבים אימות מול מנפיק הקרן — הם אינם זמינים מהנתונים במערכת.',
      'Flagged as a leveraged/inverse fund. The leverage multiple, expense ratio, and daily reset policy must be verified with the issuer — they are not available from the data in this system.',
    ))
  }
  if (known && !profile) {
    notes.push(t(
      'הסיווג מבוסס על טבלה מקומית ולא על נתוני מנפיק חיים.',
      'Classification comes from a local table, not live issuer data.',
    ))
  }

  return {
    ticker: symbol,
    name,
    exchange: profile?.exchange ?? null,
    currency: profile?.currency ?? (profile ? null : null),
    industry: profile?.finnhubIndustry ?? null,
    marketCap: profile?.marketCap ?? null,
    ipo: profile?.ipo ?? null,
    type: isLeveraged ? 'leveraged_etf' : looksEtf ? 'etf' : profile ? 'stock' : 'unknown',
    isLeveraged,
    leverage: known?.leverage ?? null,
    inverse: known ? known.leverage < 0 : null,
    benchmark: known?.benchmark ?? null,
    needsIssuerVerification: isLeveraged,
    verified: Boolean(profile),
    notes,
  }
}

/** Step 2 — data-quality gate. */
function assessDataQuality({ ohlcv, indicators, snapshot, interval, profile, earnings, instrument, now, language }) {
  const t = makeT(language)
  const reasons = []
  const sources = []
  let level = DATA_QUALITY.ACCEPTABLE

  // ACCEPTABLE is the ceiling by design: the Yahoo-backed feed behind
  // /api/market/* is delayed for many symbols and carries no real-time
  // attestation, so VERIFIED is never claimed automatically.
  reasons.push(t(
    'התקרה היא ACCEPTABLE: הזנת המחירים (Yahoo דרך ‎/api/market‎) עלולה להיות מושהית ואינה מסופקת כנתון זמן-אמת מאומת.',
    'Ceiling is ACCEPTABLE: the price feed (Yahoo via /api/market) may be delayed and is not supplied as verified real-time data.',
  ))

  if (!ohlcv?.length || !indicators) {
    return {
      level: DATA_QUALITY.UNAVAILABLE,
      reasons: [t('אין נרות או אינדיקטורים מחושבים — לא ניתן להסיק מסקנות.', 'No bars or computed indicators — no conclusions can be drawn.')],
      sources,
      barCount: ohlcv?.length ?? 0,
      interval,
      timestamp: null,
      session: marketSession(null, language),
      ageMinutes: null,
      fundamentals: DATA_QUALITY.UNAVAILABLE,
      catalysts: DATA_QUALITY.UNAVAILABLE,
    }
  }

  sources.push({
    name: t('נרות OHLCV', 'OHLCV bars'),
    endpoint: `/api/market/bars/${instrument.ticker}?interval=${interval}`,
    status: t('מושהה/היסטורי', 'Delayed/historical'),
  })

  if (ohlcv.length < MIN_BARS_FOR_ANALYSIS) {
    level = lowerQuality(level, DATA_QUALITY.DEGRADED)
    reasons.push(t(
      `רק ${ohlcv.length} נרות זמינים (נדרשים ${MIN_BARS_FOR_ANALYSIS}+ לניתוח מבני יציב).`,
      `Only ${ohlcv.length} bars available (${MIN_BARS_FOR_ANALYSIS}+ needed for stable structural analysis).`,
    ))
  }

  const snapshotTs = snapshot?.timestamp ?? null
  const lastBarTs = ohlcv[ohlcv.length - 1]?.t ?? null
  const timestamp = snapshotTs ?? lastBarTs
  const session = marketSession(timestamp, language)
  const ageMinutes = timestamp ? Math.round((now - timestamp) / 60000) : null

  if (snapshot?.price == null) {
    level = lowerQuality(level, DATA_QUALITY.DEGRADED)
    reasons.push(t('אין מחיר snapshot עדכני — נעשה שימוש בסגירת הנר האחרון.', 'No current snapshot price — the last bar close is used instead.'))
  } else {
    sources.push({
      name: t('מחיר נוכחי', 'Current price'),
      endpoint: `/api/market/snapshot/${instrument.ticker}`,
      status: session.label,
    })
  }

  if (session.session === 'regular' && ageMinutes != null && ageMinutes > 15) {
    level = lowerQuality(level, DATA_QUALITY.DEGRADED)
    reasons.push(t(
      `הנתון האחרון בן ${ageMinutes} דקות בזמן מסחר רגיל — ישן מדי להוראות ביצוע.`,
      `The latest datapoint is ${ageMinutes} minutes old during the regular session — too stale for execution instructions.`,
    ))
  }

  // Snapshot and last bar disagreeing materially is exactly the "contradictory
  // sources" case the skill's gate is meant to catch.
  if (snapshot?.price != null && lastBarTs && ohlcv[ohlcv.length - 1]?.c) {
    const divergence = Math.abs(pct(ohlcv[ohlcv.length - 1].c, snapshot.price) ?? 0)
    if (divergence > 3) {
      level = lowerQuality(level, DATA_QUALITY.DEGRADED)
      reasons.push(t(
        `פער של ${divergence.toFixed(1)}% בין מחיר ה-snapshot לסגירת הנר האחרון — מקורות סותרים.`,
        `${divergence.toFixed(1)}% gap between the snapshot price and the last bar close — contradictory sources.`,
      ))
    }
  }

  const fundamentals = profile ? DATA_QUALITY.ACCEPTABLE : DATA_QUALITY.UNAVAILABLE
  if (!profile) {
    reasons.push(t(
      'פרופיל החברה לא נטען (נדרש FINNHUB_API_KEY בשרת) — סעיפי הפונדמנטלס והתמחור מסומנים כלא זמינים ולא מולאו מהזיכרון.',
      'The company profile did not load (server needs FINNHUB_API_KEY) — the fundamentals and valuation sections are marked unavailable rather than filled in from memory.',
    ))
  } else {
    sources.push({ name: t('פרופיל חברה', 'Company profile'), endpoint: `/api/finnhub/profile/${instrument.ticker}`, status: t('סטטי', 'Static') })
  }

  const catalysts = earnings?.nextReport?.date
    ? (earnings.nextReport.isEstimated ? DATA_QUALITY.DEGRADED : DATA_QUALITY.ACCEPTABLE)
    : DATA_QUALITY.UNAVAILABLE
  if (earnings?.nextReport?.isEstimated) {
    reasons.push(t(
      'תאריך הדוח הבא הוא הערכה (נגזר מהדוח הקודם) ולא תאריך מאושר.',
      'The next earnings date is an estimate derived from the prior report, not a confirmed date.',
    ))
  }
  if (earnings?.nextReport?.date) {
    sources.push({ name: t('תאריכי דוחות', 'Earnings dates'), endpoint: `/api/market/earnings/${instrument.ticker}`, status: earnings.source ?? 'Nasdaq' })
  }

  return { level, reasons, sources, barCount: ohlcv.length, interval, timestamp, session, ageMinutes, fundamentals, catalysts }
}

/** Step 3 — market context. Facts and interpretation are kept apart. */
function buildMarketContext({ marketContext, multiTimeframe, fearGreed, language }) {
  const t = makeT(language)
  const facts = []
  const interpretation = []

  const assets = marketContext?.assets ?? {}
  const addAsset = (asset, label) => {
    if (asset?.changePct == null) return
    facts.push(`${label}: ${asset.changePct >= 0 ? '+' : ''}${round(asset.changePct, 2)}%`)
  }
  addAsset(assets.spy, 'SPY')
  addAsset(assets.qqq, 'QQQ')
  if (marketContext?.sectorEtf && assets.sector) addAsset(assets.sector, `${t('סקטור', 'Sector')} (${marketContext.sectorEtf})`)
  addAsset(assets.vix, 'VIX')

  if (fearGreed?.value != null) facts.push(`Fear & Greed: ${fearGreed.value} (${fearGreed.classification})`)
  if (multiTimeframe?.alignmentPct != null) {
    facts.push(t(
      `יישור טווחי זמן: ${multiTimeframe.alignmentPct}% (${multiTimeframe.bullish} חיובי / ${multiTimeframe.bearish} שלילי / ${multiTimeframe.neutral} ניטרלי)`,
      `Timeframe alignment: ${multiTimeframe.alignmentPct}% (${multiTimeframe.bullish} bullish / ${multiTimeframe.bearish} bearish / ${multiTimeframe.neutral} neutral)`,
    ))
  }

  if (marketContext?.label) {
    interpretation.push(t(
      `מצב השוק הרחב מסווג כ-${marketContext.label}.`,
      `The broad market regime is classified as ${marketContext.label}.`,
    ))
  }
  if (marketContext?.shouldBlockBuy) {
    interpretation.push(t(
      'הקשר השוק אינו תומך בפתיחת חשיפה לונג אגרסיבית חדשה.',
      'Market context does not support aggressive new long exposure.',
    ))
  }
  if (multiTimeframe?.recommendation) interpretation.push(multiTimeframe.recommendation)

  return {
    available: Boolean(marketContext || multiTimeframe),
    regime: marketContext?.condition ?? null,
    regimeLabel: marketContext?.label ?? null,
    score: marketContext?.score ?? null,
    shouldBlockBuy: Boolean(marketContext?.shouldBlockBuy),
    sectorEtf: marketContext?.sectorEtf ?? null,
    facts,
    interpretation,
    factors: marketContext?.factors ?? [],
  }
}

/** Step 4 — fundamentals for a company, structure for a fund. */
function buildFundamentals({ instrument, profile, language }) {
  const t = makeT(language)

  if (instrument.type === 'leveraged_etf' || instrument.type === 'etf') {
    const structuralRisks = instrument.isLeveraged ? [
      t('איפוס יומי: החשיפה נקבעת מחדש בכל יום מסחר.', 'Daily reset: exposure is re-struck every trading day.'),
      t('תלות מסלול: התשואה המצטברת תלויה בסדר התנועות, לא רק בכיוון.', 'Path dependency: compounded return depends on the order of moves, not only the direction.'),
      t('שחיקת תנודתיות: תנועה דו-כיוונית שוחקת ערך גם כשהנכס הבסיסי חוזר לנקודת המוצא.', 'Volatility decay: choppy two-way movement erodes value even when the underlying returns to its starting point.'),
      t('טעות עקיבה מול הנכס הבסיסי.', 'Tracking error versus the underlying.'),
      t('יחס הוצאות גבוה מקרנות רגילות.', 'Expense ratio higher than plain funds.'),
      t('אינו מתאים להחזקה ארוכת טווח ללא מעקב תדיר.', 'Not suitable for long-term holding without frequent review.'),
    ] : []

    return {
      kind: 'fund',
      status: DATA_QUALITY.DEGRADED,
      benchmark: instrument.benchmark,
      leverage: instrument.leverage,
      inverse: instrument.inverse,
      structuralRisks,
      unavailable: [
        t('יחס הוצאות', 'Expense ratio'),
        t('נכסים מנוהלים (AUM)', 'Assets under management'),
        t('מתודולוגיית המדד והרכב האחזקות', 'Index methodology and holdings'),
        t('טעות עקיבה בפועל', 'Realized tracking difference'),
        t('מרווח קנייה/מכירה ממוצע', 'Average bid/ask spread'),
      ],
      note: t(
        'המערכת אינה מחוברת למקור נתוני קרנות. הפרטים המבניים לעיל נכונים לקרנות ממונפות בכלל — הנתונים המספריים הספציפיים לקרן הזו חייבים אימות מול המנפיק.',
        'The system is not connected to a fund-data source. The structural points above hold for leveraged funds generally — the fund-specific numbers must be verified with the issuer.',
      ),
    }
  }

  return {
    kind: 'company',
    status: profile ? DATA_QUALITY.DEGRADED : DATA_QUALITY.UNAVAILABLE,
    known: profile ? [
      profile.name ? { label: t('שם', 'Name'), value: profile.name } : null,
      profile.exchange ? { label: t('בורסה', 'Exchange'), value: profile.exchange } : null,
      profile.finnhubIndustry ? { label: t('ענף', 'Industry'), value: profile.finnhubIndustry } : null,
      profile.marketCap ? { label: t('שווי שוק', 'Market cap'), value: `${round(profile.marketCap / 1000, 1)}B` } : null,
      profile.ipo ? { label: t('הנפקה', 'IPO'), value: profile.ipo } : null,
    ].filter(Boolean) : [],
    unavailable: [
      t('צמיחת הכנסות ומרווחים', 'Revenue growth and margins'),
      t('תזרים מזומנים חופשי ואיכות רווח', 'Free cash flow and earnings quality'),
      t('מאזן, חוב ונזילות', 'Balance sheet, debt, and liquidity'),
      t('דילול ותגמול הוני', 'Dilution and stock-based compensation'),
      t('תחזית הנהלה וקונצנזוס אנליסטים', 'Management guidance and analyst consensus'),
    ],
    note: t(
      'למערכת אין מקור לדוחות כספיים. הסעיף הזה נשאר לא זמין במכוון במקום להיות ממולא מהזיכרון.',
      'The system has no financial-statements source. This section is deliberately left unavailable rather than filled in from memory.',
    ),
  }
}

/** Step 5 — valuation. Reported honestly as unavailable without a data source. */
function buildValuation({ instrument, profile, language }) {
  const t = makeT(language)
  return {
    status: DATA_QUALITY.UNAVAILABLE,
    available: profile?.marketCap ? [{ label: t('שווי שוק', 'Market cap'), value: `${round(profile.marketCap / 1000, 1)}B` }] : [],
    missing: ['P/E', 'Forward P/E', 'PEG', 'EV/EBITDA', 'EV/Sales', 'P/S', 'P/FCF', 'FCF yield', 'P/B'],
    note: instrument.type === 'etf' || instrument.type === 'leveraged_etf'
      ? t(
        'מכפילי תמחור אינם רלוונטיים לקרן ממונפת; מה שקובע הוא מבנה הקרן והנכס הבסיסי.',
        'Valuation multiples do not apply to a leveraged fund; fund structure and the underlying asset are what matter.',
      )
      : t(
        'אין במערכת מקור למכפילי תמחור, ולכן לא מוצגים תרחישי שווי דוב/בסיס/שור. תרחישי המחיר בהמשך הם טכניים בלבד ואינם תחליף להערכת שווי.',
        'No valuation-multiple source exists in the system, so no bear/base/bull valuation cases are shown. The price scenarios below are technical only and are not a substitute for a valuation.',
      ),
  }
}

/** Step 6 — technicals, across the timeframes the app already computes. */
function buildTechnicals({ ohlcv, indicators, signal, multiTimeframe, language }) {
  const t = makeT(language)
  const index = ohlcv.length - 1
  const price = ohlcv[index].c
  const structure = signal?.structure ?? null
  const sr = signal?.pro?.supportResistance ?? null

  const rsi = lastOf(indicators.rsi14)
  const macdLine = lastOf(indicators.macd?.line)
  const macdSignal = lastOf(indicators.macd?.signal)
  const macdHist = lastOf(indicators.macd?.histogram)
  const atr = lastOf(indicators.atr14)
  const adx = lastOf(indicators.adx?.adx)
  const volRatio = lastOf(indicators.volRatio)
  const percentB = lastOf(indicators.bb20?.percentB)
  const bandwidth = lastOf(indicators.bb20?.width)
  const vwap = lastOf(indicators.vwap)

  const mas = [
    { label: 'SMA20', value: lastOf(indicators.sma20) },
    { label: 'SMA50', value: lastOf(indicators.sma50) },
    { label: 'SMA100', value: lastOf(indicators.sma100) },
    { label: 'SMA200', value: lastOf(indicators.sma200) },
    { label: 'EMA20', value: lastOf(indicators.ema20) },
    { label: 'EMA50', value: lastOf(indicators.ema50) },
  ].filter(item => item.value != null).map(item => ({
    ...item,
    value: round(item.value),
    distancePct: pct(item.value, price),
    above: price > item.value,
  }))

  // Bollinger squeeze/expansion is measured against this series' own recent
  // bandwidth range — an absolute threshold would not survive a change of
  // ticker or interval.
  const widthSeries = (indicators.bb20?.width ?? []).filter(value => value != null && Number.isFinite(value)).slice(-120)
  let bollingerState = null
  if (bandwidth != null && widthSeries.length >= 30) {
    const sorted = [...widthSeries].sort((a, b) => a - b)
    const p20 = sorted[Math.floor(sorted.length * 0.2)]
    const p80 = sorted[Math.floor(sorted.length * 0.8)]
    bollingerState = bandwidth <= p20 ? 'squeeze' : bandwidth >= p80 ? 'expansion' : 'normal'
  }

  const overextension = []
  const sma20 = mas.find(item => item.label === 'SMA20')
  if (sma20?.distancePct != null && Math.abs(sma20.distancePct) > 8) {
    overextension.push(t(
      `המחיר מרוחק ${sma20.distancePct > 0 ? '+' : ''}${sma20.distancePct}% מ-SMA20 — מתיחה חריגה.`,
      `Price is ${sma20.distancePct > 0 ? '+' : ''}${sma20.distancePct}% from SMA20 — unusually stretched.`,
    ))
  }
  if (percentB != null && percentB > 1) {
    overextension.push(t('המחיר מעל הרצועה העליונה של בולינגר.', 'Price is above the upper Bollinger band.'))
  }
  if (percentB != null && percentB < 0) {
    overextension.push(t('המחיר מתחת לרצועה התחתונה של בולינגר.', 'Price is below the lower Bollinger band.'))
  }
  if (rsi != null && (rsi > 75 || rsi < 25)) {
    overextension.push(t(`RSI על ${round(rsi, 1)} — קיצוני.`, `RSI at ${round(rsi, 1)} — extreme.`))
  }

  return {
    price: round(price),
    lastBarTime: ohlcv[index].t,
    structure: structure ? {
      trend: structure.trend,
      strength: structure.strength,
      bos: structure.bosDirection,
      choch: structure.chochDirection,
      lastSwingHigh: round(structure.keyLevels?.lastSwingHigh),
      lastSwingLow: round(structure.keyLevels?.lastSwingLow),
    } : null,
    regime: signal?.gates?.trend?.regime ?? null,
    // With no clustered pivot levels the recent-range fallback (nearestSupport /
    // nearestResistance) is the only level actually in play — surface it rather
    // than showing an empty list next to scenarios that reference it.
    support: sr?.support?.length ? sr.support.slice(0, 3).map(level => round(level)) : [round(sr?.nearestSupport)].filter(level => level != null),
    resistance: sr?.resistance?.length ? sr.resistance.slice(0, 3).map(level => round(level)) : [round(sr?.nearestResistance)].filter(level => level != null),
    nearestSupport: round(sr?.nearestSupport),
    nearestResistance: round(sr?.nearestResistance),
    movingAverages: mas,
    rsi: round(rsi, 1),
    macd: { line: round(macdLine, 4), signal: round(macdSignal, 4), histogram: round(macdHist, 4) },
    atr: round(atr),
    atrPct: atr != null ? round((atr / price) * 100) : null,
    adx: round(adx, 1),
    volumeRatio: round(volRatio, 2),
    vwap: round(vwap),
    bollinger: { percentB: round(percentB, 2), bandwidth: round(bandwidth, 4), state: bollingerState },
    overextension,
    timeframes: (multiTimeframe?.timeframes ?? []).map(frame => ({
      interval: frame.interval,
      label: frame.label,
      bias: frame.bias,
      rsi: round(frame.rsi, 1),
      trend: frame.trend,
      hasData: frame.hasData,
    })),
    // The skill requires confirmed signals to come from completed candles only.
    confirmedOnCompletedCandle: true,
  }
}

/** Step 7 — catalysts and event risk. Dates come from the API, never memory. */
function buildCatalysts({ earnings, news, language }) {
  const t = makeT(language)
  const items = []

  const next = earnings?.nextReport
  if (next?.date) {
    items.push({
      date: next.date,
      daysUntil: next.daysUntil,
      event: t('דוח רבעוני', 'Quarterly earnings'),
      estimated: Boolean(next.isEstimated),
      bull: next.consensusEPS != null
        ? t(`הכאה מעל קונצנזוס EPS של ${next.consensusEPS} עשויה לתמוך בפריצה.`, `A beat above the ${next.consensusEPS} EPS consensus could support a breakout.`)
        : t('הפתעה חיובית עשויה לשמש זרז.', 'A positive surprise could act as a catalyst.'),
      bear: t('פספוס או תחזית חלשה עלולים לייצר פער מחיר שלילי שעוקף כל סטופ.', 'A miss or weak guidance can gap the price through any stop.'),
      invalidates: t('דוח שסותר את תזת ההשקעה מבטל את הסטאפ ללא קשר לתמונה הטכנית.', 'An earnings result that contradicts the thesis invalidates the setup regardless of the technical picture.'),
      source: earnings?.source ?? 'Nasdaq',
    })
  }

  const last = earnings?.lastReport
  if (last?.date) {
    items.push({
      date: last.date,
      daysUntil: null,
      event: t(`דוח קודם (${last.result === 'beat' ? 'מעל צפי' : last.result === 'miss' ? 'מתחת לצפי' : 'בהתאם'})`, `Prior report (${last.result})`),
      estimated: false,
      bull: null,
      bear: null,
      invalidates: null,
      source: earnings?.source ?? 'Nasdaq',
      detail: last.surprisePct != null ? `${last.surprisePct > 0 ? '+' : ''}${last.surprisePct}% surprise` : null,
    })
  }

  const headlines = (news ?? []).slice(0, 5).map(item => ({
    date: item.datetime ?? item.date ?? null,
    headline: item.headline ?? item.title ?? null,
    source: item.source ?? null,
    url: item.url ?? null,
  })).filter(item => item.headline)

  return {
    status: items.length ? DATA_QUALITY.ACCEPTABLE : DATA_QUALITY.UNAVAILABLE,
    items,
    headlines,
    note: headlines.length
      ? t('הכותרות מוצגות כמידע גולמי ולא כניתוח סנטימנט מאומת.', 'Headlines are shown as raw information, not verified sentiment analysis.')
      : t('אין הזנת חדשות זמינה (נדרש FINNHUB_API_KEY) — אירועים שאינם דוחות אינם מכוסים.', 'No news feed available (needs FINNHUB_API_KEY) — non-earnings events are not covered.'),
  }
}

/** Step 8 — risk analysis. */
function buildRisks({ instrument, technicals, signal, earnings, marketContextSection, dataQuality, language }) {
  const t = makeT(language)
  const risks = []
  const add = (severity, category, text) => risks.push({ severity, category, text })

  if (instrument.isLeveraged) {
    add('high', t('מינוף', 'Leverage'), t(
      'מכשיר ממונף: תנודתיות מוגברת, שחיקת תנודתיות ותלות מסלול. נדרש ניהול סיכון הדוק ומעקב תכוף יותר.',
      'Leveraged instrument: amplified volatility, volatility decay, and path dependency. Requires tighter risk control and more frequent review.',
    ))
  }

  const daysUntil = earnings?.nextReport?.daysUntil
  if (daysUntil != null && daysUntil >= 0 && daysUntil <= 14) {
    add(daysUntil <= EARNINGS_BLOCK_DAYS ? 'high' : 'medium', t('אירוע', 'Event'), t(
      `דוח בעוד ${daysUntil} ימים — סיכון פער מחיר שסטופ אינו מגן מפניו.`,
      `Earnings in ${daysUntil} days — gap risk that a stop does not protect against.`,
    ))
  }

  if (technicals.atrPct != null && technicals.atrPct > 4) {
    add('medium', t('תנודתיות', 'Volatility'), t(
      `ATR הוא ${technicals.atrPct}% מהמחיר — תנועה יומית רחבה מחייבת פוזיציה קטנה יותר.`,
      `ATR is ${technicals.atrPct}% of price — a wide daily range demands a smaller position.`,
    ))
  }

  if (technicals.volumeRatio != null && technicals.volumeRatio < 0.7) {
    add('medium', t('נזילות', 'Liquidity'), t(
      `נפח של ${technicals.volumeRatio}x מהממוצע — תנועות ללא נפח פחות אמינות.`,
      `Volume at ${technicals.volumeRatio}x average — moves without volume are less reliable.`,
    ))
  }

  if (marketContextSection.shouldBlockBuy) {
    add('high', t('שוק רחב', 'Broad market'), t(
      'הקשר השוק הרחב שלילי — סיכון מערכתי שאינו תלוי במניה עצמה.',
      'Broad market context is negative — systemic risk independent of the security itself.',
    ))
  }

  if (technicals.structure?.trend === 'bearish' && !technicals.structure?.choch) {
    add('high', t('מבנה', 'Structure'), t(
      'מבנה שוק יורד ללא שינוי אופי — קנייה כאן היא מסחר נגד המגמה.',
      'Bearish market structure with no change of character — buying here trades against the trend.',
    ))
  }

  if (QUALITY_RANK[dataQuality.level] <= QUALITY_RANK[DATA_QUALITY.DEGRADED]) {
    add('high', t('נתונים', 'Data'), t(
      'איכות הנתונים ירודה — כל רמה מספרית כאן פחות אמינה.',
      'Data quality is degraded — every numeric level here is less reliable.',
    ))
  }

  if (dataQuality.fundamentals === DATA_QUALITY.UNAVAILABLE) {
    add('medium', t('כיסוי חסר', 'Coverage gap'), t(
      'אין כיסוי פונדמנטלי: סיכוני מאזן, דילול, רגולציה ותביעות אינם נבדקים כאן כלל.',
      'No fundamental coverage: balance-sheet, dilution, regulatory, and litigation risks are not examined here at all.',
    ))
  }

  const rr = signal?.risk?.rrRatio
  if (rr != null && rr < MIN_RR_SWING) {
    add('high', t('יחס סיכוי/סיכון', 'Risk/reward'), t(
      `יחס סיכוי/סיכון של ${rr} מתחת לסף המינימלי ${MIN_RR_SWING}.`,
      `Risk/reward of ${rr} is below the ${MIN_RR_SWING} minimum.`,
    ))
  }

  return risks
}

/** Step 9 — bear / base / bull, anchored to real levels only. */
function buildScenarios({ technicals, signal, instrument, language }) {
  const t = makeT(language)
  const price = technicals.price
  const atr = technicals.atr
  if (price == null || atr == null) return []

  const support = technicals.nearestSupport
  const resistance = technicals.nearestResistance
  const swingLow = technicals.structure?.lastSwingLow
  const swingHigh = technicals.structure?.lastSwingHigh
  const patternTarget = signal?.decision?.patternTarget ?? null

  const bearFloor = Math.min(...[support, swingLow, price - 3 * atr].filter(value => value != null))
  const bullCeiling = Math.max(...[resistance, swingHigh, patternTarget, price + 3 * atr].filter(value => value != null))

  // A zone needs width to be a zone. When the floor and the nearest support
  // collapse onto the same level, widen by one ATR rather than printing a
  // single price twice.
  const widen = (low, high) => (low != null && high != null && low >= high - 0.01
    ? { low: round(high - atr), high: round(high) }
    : { low: round(low), high: round(high) })

  return [
    {
      key: 'bear',
      label: t('תרחיש דובי', 'Bear case'),
      trigger: support != null
        ? t(`שבירה וסגירה מתחת ל-$${round(support)}.`, `A close below $${round(support)}.`)
        : t('שבירת השפל האחרון בנפח גבוה.', 'A high-volume break of the recent low.'),
      outcome: t(
        'המבנה עובר לשפלים יורדים והלחץ נמשך עד אזור התמיכה הבא.',
        'Structure shifts to lower lows and pressure continues toward the next support area.',
      ),
      zone: widen(bearFloor, support ?? price - 1.5 * atr),
      zonePct: pct(price, bearFloor),
      invalidation: t(
        `חזרה וסגירה מעל $${round(price)} מבטלת את התרחיש.`,
        `A close back above $${round(price)} invalidates this scenario.`,
      ),
    },
    {
      key: 'base',
      label: t('תרחיש בסיס', 'Base case'),
      trigger: t('המשך המצב הנוכחי ללא זרז חדש.', 'Current conditions persist with no new catalyst.'),
      outcome: t(
        'המחיר נע בטווח שבין התמיכה להתנגדות הקרובות עד להכרעה.',
        'Price ranges between nearby support and resistance until a resolution.',
      ),
      zone: widen(support ?? price - atr, resistance ?? price + atr),
      zonePct: null,
      invalidation: t(
        'סגירה מחוץ לטווח בנפח גבוה מעבירה לתרחיש דובי או שורי.',
        'A high-volume close outside the range moves to the bear or bull scenario.',
      ),
    },
    {
      key: 'bull',
      label: t('תרחיש שורי', 'Bull case'),
      trigger: resistance != null
        ? t(`פריצה וסגירה מעל $${round(resistance)} בנפח מאשר.`, `A close above $${round(resistance)} on confirming volume.`)
        : t('פריצת השיא האחרון בנפח גבוה.', 'A high-volume break of the recent high.'),
      outcome: t(
        'המבנה ממשיך בשיאים עולים לעבר ההתנגדות הבאה.',
        'Structure continues in higher highs toward the next resistance.',
      ),
      zone: widen(resistance ?? price + atr, bullCeiling),
      zonePct: pct(price, bullCeiling),
      invalidation: t(
        `כישלון להחזיק את רמת הפריצה (סגירה חזרה מתחתיה) מבטל את התרחיש.`,
        'Failure to hold the breakout level (a close back below it) invalidates this scenario.',
      ),
    },
  ].map(scenario => ({
    ...scenario,
    note: instrument.isLeveraged
      ? t('במכשיר ממונף התנועה בפועל תהיה מוגברת ותלוית מסלול.', 'On a leveraged instrument the realized move is amplified and path-dependent.')
      : null,
  }))
}

/** Step 10 — trade plan, produced only when the gate is passed. */
function buildTradePlan({ technicals, signal, instrument, earnings, dataQuality, marketContextSection, language }) {
  const t = makeT(language)
  const blockers = []
  const price = technicals.price
  const atr = technicals.atr
  const risk = signal?.risk ?? null
  const decision = signal?.decision ?? null

  const daysUntil = earnings?.nextReport?.daysUntil
  const eventRisk = daysUntil != null && daysUntil >= 0 && daysUntil <= EARNINGS_BLOCK_DAYS
  const minRr = instrument.isLeveraged || eventRisk ? MIN_RR_ELEVATED_RISK : MIN_RR_SWING

  if (QUALITY_RANK[dataQuality.level] < QUALITY_RANK[DATA_QUALITY.ACCEPTABLE]) {
    blockers.push(t(
      `איכות נתונים ${dataQuality.level} — מתחת לסף הנדרש לתוכנית מסחר.`,
      `Data quality is ${dataQuality.level} — below the threshold required for a trade plan.`,
    ))
  }
  if (price == null || atr == null || !risk) {
    blockers.push(t('חסרים ATR או רמות סיכון מחושבות.', 'ATR or computed risk levels are missing.'))
  }
  if (eventRisk) {
    blockers.push(t(
      `דוח בעוד ${daysUntil} ימים — סיכון אירוע חוסם כניסה חדשה.`,
      `Earnings in ${daysUntil} days — event risk blocks a new entry.`,
    ))
  }
  if (risk?.rrRatio != null && risk.rrRatio < minRr) {
    blockers.push(t(
      `יחס סיכוי/סיכון ${risk.rrRatio} מתחת לסף ${minRr}.`,
      `Risk/reward ${risk.rrRatio} is below the ${minRr} threshold.`,
    ))
  }
  if (technicals.structure?.trend === 'bearish' && !technicals.structure?.choch) {
    blockers.push(t(
      'מבנה שוק יורד ללא שינוי אופי — אין טריגר מבני לכניסה.',
      'Bearish structure with no change of character — no structural entry trigger.',
    ))
  }
  if (marketContextSection.shouldBlockBuy) {
    blockers.push(t('הקשר השוק הרחב חוסם כניסה חדשה.', 'Broad market context blocks a new entry.'))
  }
  if (technicals.volumeRatio != null && technicals.volumeRatio < 0.8) {
    blockers.push(t(
      `אין אישור נפח (${technicals.volumeRatio}x מהממוצע).`,
      `No volume confirmation (${technicals.volumeRatio}x average).`,
    ))
  }

  if (blockers.length || !risk || price == null) {
    return {
      noValidSetup: true,
      reasons: blockers,
      minRr,
      note: t(
        '"אין סטאפ תקף" עדיף על כפיית עסקה. הרמות בתרחישים לעיל נשארות למעקב.',
        '"No valid setup" is preferred over forcing a trade. The scenario levels above remain for monitoring.',
      ),
    }
  }

  const entryLow = decision?.entryLow ?? round(price - 0.25 * atr)
  const entryHigh = decision?.entryHigh ?? round(price + 0.25 * atr)
  const stop = risk.stopLoss
  const target1 = technicals.nearestResistance != null && technicals.nearestResistance > price
    ? technicals.nearestResistance
    : risk.takeProfit
  const target2 = decision?.patternTarget != null && decision.patternTarget > target1
    ? decision.patternTarget
    : round(price + 3 * atr)

  return {
    noValidSetup: false,
    minRr,
    watchZone: zoneText(technicals.nearestSupport, technicals.nearestResistance),
    entryTrigger: t(
      `סגירת נר מעל $${round(entryHigh)} עם נפח מעל הממוצע.`,
      `A completed candle closing above $${round(entryHigh)} on above-average volume.`,
    ),
    entryZone: { low: round(entryLow), high: round(entryHigh) },
    invalidation: round(decision?.invalidation ?? stop),
    stopConcept: risk.stopContext?.recommended
      ? `${risk.stopContext.recommended.type} — $${risk.stopContext.recommended.price} (${risk.stopContext.recommended.riskPct}%)`
      : `ATR — $${stop}`,
    target1: round(target1),
    target2: round(target2),
    timeStop: t(
      'אם הטריגר לא הופעל תוך 5-10 נרות בטווח הנבחר — הסטאפ מתיישן ויש לבטלו.',
      'If the trigger has not fired within 5-10 bars on the working interval, the setup is stale and should be cancelled.',
    ),
    riskReward: risk.rrRatio,
    cancelConditions: [
      t('סגירה מתחת לרמת הביטול.', 'A close below the invalidation level.'),
      t('הודעה על אירוע חדש בטווח החזקה המתוכנן.', 'A newly announced event inside the planned holding window.'),
      t('התדרדרות איכות הנתונים מתחת ל-ACCEPTABLE.', 'Data quality falling below ACCEPTABLE.'),
      instrument.isLeveraged
        ? t('החזקה מעבר לטווח שנקבע במכשיר ממונף.', 'Holding a leveraged instrument beyond the planned window.')
        : null,
    ].filter(Boolean),
  }

  function zoneText(support, resistance) {
    if (support == null && resistance == null) return t('אין רמות מוגדרות.', 'No defined levels.')
    if (support == null) return `< $${round(resistance)}`
    if (resistance == null) return `> $${round(support)}`
    return `$${round(support)} - $${round(resistance)}`
  }
}

/** Step 11 — confidence as a label with reasons, never a probability. */
function buildConfidence({ dataQuality, technicals, signal, multiTimeframe, marketContextSection, language }) {
  const t = makeT(language)
  const reasons = []
  let score = 0

  if (dataQuality.level === DATA_QUALITY.ACCEPTABLE) score += 1
  if (QUALITY_RANK[dataQuality.level] <= QUALITY_RANK[DATA_QUALITY.DEGRADED]) {
    score -= 2
    reasons.push(t('איכות הנתונים אינה מספקת לקביעות מדויקות.', 'Data quality does not support precise claims.'))
  }
  if (dataQuality.fundamentals === DATA_QUALITY.UNAVAILABLE) {
    score -= 1
    reasons.push(t('אין כיסוי פונדמנטלי — הניתוח טכני בעיקרו.', 'No fundamental coverage — the analysis is primarily technical.'))
  }

  const alignment = multiTimeframe?.alignmentPct ?? null
  if (alignment != null && alignment >= 70) {
    score += 1
    reasons.push(t(`${alignment}% מטווחי הזמן מיושרים.`, `${alignment}% of timeframes are aligned.`))
  } else if (alignment != null && alignment < 50) {
    score -= 1
    reasons.push(t('טווחי הזמן סותרים זה את זה.', 'Timeframes contradict each other.'))
  }

  if (signal?.gates?.confluence?.passed) {
    score += 1
    reasons.push(t('נדרש מספר האינדיקטורים המיושרים עבר את הסף.', 'The required number of aligned indicators passed the threshold.'))
  }
  if (technicals.structure?.trend && technicals.structure.trend !== 'consolidating') {
    score += 1
    reasons.push(t(`מבנה השוק ברור (${technicals.structure.trend}).`, `Market structure is clear (${technicals.structure.trend}).`))
  }
  if (marketContextSection.shouldBlockBuy) {
    score -= 1
    reasons.push(t('הקשר השוק הרחב מנוגד לכיוון החיובי.', 'Broad market context runs against the bullish direction.'))
  }
  if (technicals.overextension.length) {
    score -= 1
    reasons.push(t('המחיר במצב מתיחה — הסיכון לתיקון גבוה.', 'Price is stretched — pullback risk is elevated.'))
  }

  const level = score >= 3 ? 'high' : score >= 1 ? 'moderate' : 'low'
  return {
    level,
    label: { high: t('ביטחון גבוה', 'High confidence'), moderate: t('ביטחון בינוני', 'Moderate confidence'), low: t('ביטחון נמוך', 'Low confidence') }[level],
    reasons,
    note: t(
      'זו הערכת ביטחון איכותנית. הציון של מנוע האותות אינו הסתברות ואינו מוצג ככזו.',
      'This is a qualitative confidence assessment. The signal engine score is not a probability and is not presented as one.',
    ),
  }
}

/** Existing-position math. Runs only with user-supplied inputs. */
function buildPositionAnalysis({ position, technicals, tradePlan, language }) {
  const t = makeT(language)
  if (!position?.avgPrice || !position?.quantity) return null

  const price = technicals.price
  const avgPrice = Number(position.avgPrice)
  const quantity = Number(position.quantity)
  if (!Number.isFinite(avgPrice) || !Number.isFinite(quantity) || avgPrice <= 0 || quantity <= 0) return null

  const cost = avgPrice * quantity
  const value = price * quantity
  const unrealized = value - cost
  const breakEvenPct = pct(price, avgPrice)
  const portfolioSize = Number(position.portfolioSize)
  const concentration = Number.isFinite(portfolioSize) && portfolioSize > 0 ? round((value / portfolioSize) * 100) : null
  const invalidation = tradePlan?.invalidation ?? technicals.nearestSupport ?? null
  const riskToInvalidation = invalidation != null ? round((price - invalidation) * quantity) : null

  return {
    avgPrice: round(avgPrice),
    quantity,
    cost: round(cost),
    value: round(value),
    unrealized: round(unrealized),
    unrealizedPct: pct(cost, value),
    breakEvenPct,
    concentration,
    invalidation,
    riskToInvalidation,
    riskToInvalidationPct: invalidation != null ? pct(price, invalidation) : null,
    warnings: [
      concentration != null && concentration > 25
        ? t(`ריכוזיות של ${concentration}% מהתיק במכשיר אחד.`, `${concentration}% of the portfolio sits in a single instrument.`)
        : null,
      unrealized < 0
        ? t(
          `נדרשת תשואה של ${breakEvenPct}% רק כדי לחזור לנקודת האיזון. ירידת מחיר כשלעצמה אינה סיבה להגדיל פוזיציה.`,
          `A ${breakEvenPct}% return is needed just to break even. A price decline on its own is not a reason to add.`,
        )
        : null,
    ].filter(Boolean),
  }
}

/** Step 12 — final conclusion. */
function buildConclusion({ technicals, signal, confidence, tradePlan, dataQuality, marketContextSection, instrument, language }) {
  const t = makeT(language)
  let score = 0

  if (technicals.structure?.trend === 'bullish') score += 2
  if (technicals.structure?.trend === 'bearish') score -= 2
  if (technicals.regime === 'uptrend') score += 1
  if (technicals.regime === 'downtrend') score -= 1
  if (signal?.score != null) score += signal.score > 60 ? 1 : signal.score < -60 ? -1 : 0
  if (marketContextSection.shouldBlockBuy) score -= 1
  if (technicals.overextension.length) score -= 1

  const stance = score >= 3 ? 'bullish'
    : score >= 1 ? 'cautiously_bullish'
      : score <= -3 ? 'bearish'
        : score <= -1 ? 'cautiously_bearish'
          : 'neutral'

  const stanceLabel = {
    bullish: t('חיובי', 'Bullish'),
    cautiously_bullish: t('חיובי בזהירות', 'Cautiously bullish'),
    neutral: t('ניטרלי', 'Neutral'),
    cautiously_bearish: t('שלילי בזהירות', 'Cautiously bearish'),
    bearish: t('שלילי', 'Bearish'),
  }[stance]

  const supporting = []
  const opposing = []
  if (technicals.structure?.trend === 'bullish') supporting.push(t('מבנה של שיאים ושפלים עולים.', 'Higher-high / higher-low structure.'))
  if (technicals.structure?.trend === 'bearish') opposing.push(t('מבנה של שיאים ושפלים יורדים.', 'Lower-high / lower-low structure.'))
  if (technicals.volumeRatio != null && technicals.volumeRatio > 1.3) supporting.push(t(`נפח ${technicals.volumeRatio}x מהממוצע מאשר את התנועה.`, `Volume at ${technicals.volumeRatio}x average confirms the move.`))

  // Position versus the long moving averages is the plainest observable fact
  // available, and belongs on whichever side of the thesis it actually falls.
  ;['SMA200', 'SMA50'].forEach(label => {
    const ma = technicals.movingAverages.find(item => item.label === label)
    if (!ma || ma.distancePct == null) return
    const text = t(
      `המחיר ${ma.above ? 'מעל ' : 'מתחת ל-'}${ma.label} (${ma.distancePct > 0 ? '+' : ''}${ma.distancePct}%).`,
      `Price is ${ma.above ? 'above' : 'below'} ${ma.label} (${ma.distancePct > 0 ? '+' : ''}${ma.distancePct}%).`,
    )
    ;(ma.above ? supporting : opposing).push(text)
  })
  if (technicals.rsi != null && technicals.rsi >= 50 && technicals.rsi <= 70) {
    supporting.push(t(`RSI על ${technicals.rsi} — מומנטום חיובי ללא קיצוניות.`, `RSI at ${technicals.rsi} — positive momentum without an extreme.`))
  }
  if (technicals.rsi != null && technicals.rsi < 40) {
    opposing.push(t(`RSI על ${technicals.rsi} — מומנטום חלש.`, `RSI at ${technicals.rsi} — weak momentum.`))
  }

  // The signal engine's score moves the stance, so it has to appear as evidence
  // — otherwise the conclusion looks unexplained next to the other rows. It is
  // stated as a score, never as a likelihood.
  if (signal?.score != null && Math.abs(signal.score) > 60) {
    const text = t(
      `ציון מנוע האותות ${signal.score} (ציון, לא הסתברות).`,
      `Signal engine score ${signal.score} (a score, not a probability).`,
    )
    ;(signal.score > 0 ? supporting : opposing).push(text)
  }
  if (marketContextSection.regimeLabel) {
    (marketContextSection.shouldBlockBuy ? opposing : supporting).push(t(`הקשר שוק: ${marketContextSection.regimeLabel}.`, `Market context: ${marketContextSection.regimeLabel}.`))
  }
  if (technicals.volumeRatio != null && technicals.volumeRatio < 0.8) {
    opposing.push(t(
      `נפח ${technicals.volumeRatio}x מהממוצע — אין אישור נפח לתנועה.`,
      `Volume at ${technicals.volumeRatio}x average — the move has no volume confirmation.`,
    ))
  }
  technicals.overextension.forEach(item => opposing.push(item))
  if (dataQuality.fundamentals === DATA_QUALITY.UNAVAILABLE) {
    opposing.push(t('אין אימות פונדמנטלי לתזה.', 'The thesis has no fundamental verification.'))
  }

  // Showing the conflict is required; an empty column would read as "nothing to
  // say" when the truth is "nothing was found in what this engine examines".
  const nothingFound = t(
    'לא נמצאה ראיה משמעותית בכיוון הזה בנתונים שהמנוע בודק (טכניקה, מבנה, זרזים, הקשר שוק). אין בכך אישור להיעדר סיכון.',
    'No material evidence in this direction was found in what the engine examines (technicals, structure, catalysts, market context). That is not confirmation that none exists.',
  )
  if (!supporting.length) supporting.push(nothingFound)
  if (!opposing.length) opposing.push(nothingFound)

  const keyLevel = tradePlan?.noValidSetup === false
    ? t(`רמת הביטול $${tradePlan.invalidation}.`, `The invalidation level at $${tradePlan.invalidation}.`)
    : technicals.nearestSupport != null
      ? t(`התמיכה הקרובה $${technicals.nearestSupport}.`, `Nearest support at $${technicals.nearestSupport}.`)
      : t('אין רמה מוגדרת.', 'No defined level.')

  return {
    stance,
    stanceLabel,
    supporting: supporting.slice(0, 3),
    opposing: opposing.slice(0, 3),
    keyLevel,
    whatChanges: [
      technicals.nearestResistance != null
        ? t(`סגירה מעל $${technicals.nearestResistance} משנה את התמונה לחיובית.`, `A close above $${technicals.nearestResistance} turns the picture positive.`)
        : null,
      technicals.nearestSupport != null
        ? t(`סגירה מתחת ל-$${technicals.nearestSupport} משנה אותה לשלילית.`, `A close below $${technicals.nearestSupport} turns it negative.`)
        : null,
      t('שינוי באיכות הנתונים או אירוע חדש שנקבע ליומן.', 'A change in data quality or a newly scheduled event.'),
    ].filter(Boolean),
    horizonSuitability: instrument.isLeveraged
      ? t(
        'מתאים לטווח קצר בלבד ובמעקב יומי. אינו מתאים להחזקה ארוכה בשל האיפוס היומי ושחיקת התנודתיות.',
        'Suitable for short holding periods with daily review only. Not suitable for long-term holding because of the daily reset and volatility decay.',
      )
      : t(
        'הניתוח מכוון לטווח סווינג לפי הטווח הנבחר. מסקנות ארוכות-טווח מחייבות נתונים פונדמנטליים שאינם זמינים כאן.',
        'The analysis targets a swing horizon on the selected interval. Long-term conclusions require fundamental data that is not available here.',
      ),
    dataQualityLabel: dataQuality.level,
    confidenceLabel: confidence.label,
  }
}

/**
 * Assemble the full report. Returns null when there is nothing honest to say.
 */
export function buildStockAnalysisPro({
  ticker,
  interval = '1d',
  ohlcv,
  indicators,
  signal,
  snapshot,
  earnings,
  marketContext,
  multiTimeframe,
  fearGreed,
  profile,
  news,
  position,
  language = 'he',
  now = Date.now(),
} = {}) {
  if (!ticker) return null

  const instrument = classifyInstrument({ ticker, snapshot, profile, language })
  const dataQuality = assessDataQuality({
    ohlcv, indicators, snapshot, interval, profile, earnings, instrument, now, language,
  })

  if (dataQuality.level === DATA_QUALITY.UNAVAILABLE) {
    return {
      ticker: instrument.ticker,
      interval,
      language,
      generatedAt: now,
      instrument,
      dataQuality,
      unavailable: true,
    }
  }

  const marketContextSection = buildMarketContext({ marketContext, multiTimeframe, fearGreed, language })
  const fundamentals = buildFundamentals({ instrument, profile, language })
  const valuation = buildValuation({ instrument, profile, language })
  const technicals = buildTechnicals({ ohlcv, indicators, signal, multiTimeframe, language })
  const catalysts = buildCatalysts({ earnings, news, language })
  const risks = buildRisks({ instrument, technicals, signal, earnings, marketContextSection, dataQuality, language })
  const scenarios = buildScenarios({ technicals, signal, instrument, language })
  const tradePlan = buildTradePlan({ technicals, signal, instrument, earnings, dataQuality, marketContextSection, language })
  const confidence = buildConfidence({ dataQuality, technicals, signal, multiTimeframe, marketContextSection, language })
  const positionAnalysis = buildPositionAnalysis({ position, technicals, tradePlan, language })
  const conclusion = buildConclusion({
    technicals, signal, confidence, tradePlan, dataQuality, marketContextSection, instrument, language,
  })

  return {
    ticker: instrument.ticker,
    interval,
    language,
    generatedAt: now,
    unavailable: false,
    instrument,
    dataQuality,
    marketContext: marketContextSection,
    fundamentals,
    valuation,
    technicals,
    catalysts,
    risks,
    scenarios,
    tradePlan,
    confidence,
    position: positionAnalysis,
    conclusion,
  }
}

/**
 * Render the report in the section order of the skill's output template
 * (`.claude/skills/stock-analysis-pro/references/output-template.md`), so the
 * in-app report and the skill-generated report are interchangeable.
 */
export function toMarkdown(report) {
  if (!report) return ''
  const t = makeT(report.language)
  const lines = []
  const money = value => (value == null ? '-' : `$${value}`)
  const stamp = report.dataQuality?.timestamp ? new Date(report.dataQuality.timestamp).toISOString() : '-'

  lines.push(`# ${report.ticker} — Stock Analysis Pro`, '')
  lines.push(`## ${t('מסקנה מנהלים', 'Executive conclusion')}`)
  lines.push(`- **${t('נייר', 'Security')}:** ${report.ticker}${report.instrument.name ? ` (${report.instrument.name})` : ''}`)
  lines.push(`- **${t('טווח', 'Horizon')}:** ${report.interval}`)
  lines.push(`- **${t('עמדה', 'Stance')}:** ${report.conclusion?.stanceLabel ?? '-'}`)
  lines.push(`- **${t('ביטחון', 'Confidence')}:** ${report.confidence?.label ?? '-'}`)
  lines.push(`- **${t('איכות נתונים', 'Data quality')}:** ${report.dataQuality.level}`)
  lines.push(`- **${t('חותמת זמן', 'Data timestamp')}:** ${stamp} (${report.dataQuality.session?.label ?? '-'})`, '')

  if (report.unavailable) {
    lines.push(t('הנתונים אינם זמינים — לא הופק ניתוח.', 'Data unavailable — no analysis produced.'))
    report.dataQuality.reasons.forEach(reason => lines.push(`- ${reason}`))
    return lines.join('\n')
  }

  lines.push(`## ${t('מה תומך בתזה', 'What supports the thesis')}`)
  report.conclusion.supporting.forEach((item, i) => lines.push(`${i + 1}. ${item}`))
  lines.push('', `## ${t('מה מחליש את התזה', 'What weakens the thesis')}`)
  report.conclusion.opposing.forEach((item, i) => lines.push(`${i + 1}. ${item}`))

  lines.push('', `## ${t('הקשר שוק וסקטור', 'Market and sector context')}`)
  report.marketContext.facts.forEach(fact => lines.push(`- ${fact}`))
  report.marketContext.interpretation.forEach(item => lines.push(`- _${item}_`))

  lines.push('', `## ${t('פונדמנטלס / מבנה הקרן', 'Fundamentals or ETF structure')} — ${report.fundamentals.status}`)
  ;(report.fundamentals.known ?? []).forEach(item => lines.push(`- ${item.label}: ${item.value}`))
  ;(report.fundamentals.structuralRisks ?? []).forEach(item => lines.push(`- ${item}`))
  lines.push(`- ${t('לא זמין', 'Unavailable')}: ${(report.fundamentals.unavailable ?? []).join(', ')}`)
  lines.push(`- _${report.fundamentals.note}_`)

  lines.push('', `## ${t('תמחור', 'Valuation')} — ${report.valuation.status}`)
  lines.push(`- _${report.valuation.note}_`)

  const tech = report.technicals
  lines.push('', `## ${t('תמונה טכנית', 'Technical picture')}`)
  lines.push(`- ${t('מגמה', 'Trend')}: ${tech.regime ?? '-'}`)
  lines.push(`- ${t('מבנה', 'Structure')}: ${tech.structure?.trend ?? '-'}${tech.structure?.choch ? ` (CHoCH ${tech.structure.choch})` : ''}`)
  lines.push(`- ${t('תמיכה', 'Support')}: ${tech.support.map(money).join(', ') || '-'}`)
  lines.push(`- ${t('התנגדות', 'Resistance')}: ${tech.resistance.map(money).join(', ') || '-'}`)
  lines.push(`- ${t('ממוצעים נעים', 'Moving averages')}: ${tech.movingAverages.map(ma => `${ma.label} ${money(ma.value)} (${ma.distancePct > 0 ? '+' : ''}${ma.distancePct}%)`).join(', ') || '-'}`)
  lines.push(`- RSI: ${tech.rsi ?? '-'}`)
  lines.push(`- MACD: ${tech.macd.line ?? '-'} / ${t('סיגנל', 'signal')} ${tech.macd.signal ?? '-'}`)
  lines.push(`- ATR: ${tech.atr ?? '-'} (${tech.atrPct ?? '-'}%)`)
  lines.push(`- ${t('נפח', 'Volume')}: ${tech.volumeRatio ?? '-'}x`)
  lines.push(`- Bollinger: %B ${tech.bollinger.percentB ?? '-'}, ${t('רוחב', 'bandwidth')} ${tech.bollinger.bandwidth ?? '-'}, ${tech.bollinger.state ?? '-'}`)
  lines.push(`- ${t('מתיחה', 'Overextension')}: ${tech.overextension.join(' ') || t('אין', 'None')}`)

  lines.push('', `## ${t('זרזים', 'Catalysts')}`)
  lines.push(`| ${t('תאריך', 'Date')} | ${t('אירוע', 'Event')} | ${t('השפעה אפשרית', 'Potential impact')} |`, '|---|---|---|')
  if (!report.catalysts.items.length) {
    lines.push(`| - | ${t('אין זרז מאומת בטווח הקרוב', 'No verified near-term catalyst')} | - |`)
  }
  report.catalysts.items.forEach(item => {
    lines.push(`| ${item.date ?? '-'}${item.estimated ? ' *' : ''} | ${item.event} | ${item.bear ?? item.detail ?? '-'} |`)
  })
  lines.push(`- _${report.catalysts.note}_`)

  lines.push('', `## ${t('סיכונים עיקריים', 'Main risks')}`)
  report.risks.forEach(risk => lines.push(`- [${risk.severity}] ${risk.category}: ${risk.text}`))

  lines.push('', `## ${t('טבלת תרחישים', 'Scenario table')}`)
  lines.push(`| ${t('תרחיש', 'Scenario')} | ${t('טריגר', 'Trigger')} | ${t('תוצאה צפויה', 'Expected outcome')} | ${t('ביטול', 'Invalidation')} |`, '|---|---|---|---|')
  report.scenarios.forEach(scenario => {
    lines.push(`| ${scenario.label} ${money(scenario.zone.low)}-${money(scenario.zone.high)} | ${scenario.trigger} | ${scenario.outcome} | ${scenario.invalidation} |`)
  })

  lines.push('', `## ${t('מסגרת תוכנית מסחר', 'Trade-plan framework')}`)
  if (report.tradePlan.noValidSetup) {
    lines.push(`**${t('אין סטאפ תקף', 'No valid setup')}**`)
    report.tradePlan.reasons.forEach(reason => lines.push(`- ${reason}`))
    lines.push(`- _${report.tradePlan.note}_`)
  } else {
    const plan = report.tradePlan
    lines.push(`- ${t('אזור מעקב', 'Watch zone')}: ${plan.watchZone}`)
    lines.push(`- ${t('טריגר כניסה', 'Entry trigger')}: ${plan.entryTrigger}`)
    lines.push(`- ${t('אזור כניסה', 'Entry zone')}: ${money(plan.entryZone.low)} - ${money(plan.entryZone.high)}`)
    lines.push(`- ${t('ביטול', 'Invalidation')}: ${money(plan.invalidation)}`)
    lines.push(`- ${t('תפיסת סטופ', 'Stop concept')}: ${plan.stopConcept}`)
    lines.push(`- ${t('יעד 1', 'Target 1')}: ${money(plan.target1)}`)
    lines.push(`- ${t('יעד 2', 'Target 2')}: ${money(plan.target2)}`)
    lines.push(`- ${t('סטופ זמן', 'Time stop')}: ${plan.timeStop}`)
    lines.push(`- ${t('סיכוי/סיכון', 'Risk/reward')}: 1:${plan.riskReward} (${t('סף', 'threshold')} ${plan.minRr})`)
    plan.cancelConditions.forEach(condition => lines.push(`- ${t('ביטול סטאפ', 'Setup cancellation')}: ${condition}`))
  }

  if (report.position) {
    lines.push('', `## ${t('ניתוח פוזיציה קיימת', 'Existing-position analysis')}`)
    lines.push(`- ${t('מחיר ממוצע', 'Average price')}: ${money(report.position.avgPrice)}`)
    lines.push(`- ${t('כמות', 'Position size')}: ${report.position.quantity}`)
    lines.push(`- ${t('רווח/הפסד לא ממומש', 'Unrealized P&L')}: ${money(report.position.unrealized)} (${report.position.unrealizedPct}%)`)
    lines.push(`- ${t('תשואה לנקודת איזון', 'Return needed to break even')}: ${report.position.breakEvenPct}%`)
    lines.push(`- ${t('ריכוזיות', 'Portfolio concentration')}: ${report.position.concentration ?? '-'}%`)
    lines.push(`- ${t('סיכון עד ביטול', 'Risk to invalidation')}: ${money(report.position.riskToInvalidation)} (${report.position.riskToInvalidationPct}%)`)
    report.position.warnings.forEach(warning => lines.push(`- ${warning}`))
  }

  lines.push('', `## ${t('החלטה סופית', 'Final decision')}`)
  lines.push(`- **${t('מסקנה נוכחית', 'Current conclusion')}:** ${report.conclusion.stanceLabel}`)
  lines.push(`- **${t('תנאי מפתח למעקב', 'Key condition to watch')}:** ${report.conclusion.keyLevel}`)
  lines.push(`- **${t('מה משנה את המסקנה', 'What changes the conclusion')}:** ${report.conclusion.whatChanges.join(' ')}`)
  lines.push(`- **${t('טווח מתאים', 'Best-suited horizon')}:** ${report.conclusion.horizonSuitability}`)

  lines.push('', `## ${t('מקורות ומגבלות', 'Sources and limitations')}`)
  report.dataQuality.sources.forEach(source => lines.push(`- ${source.name}: \`${source.endpoint}\` — ${source.status}`))
  report.dataQuality.reasons.forEach(reason => lines.push(`- ${reason}`))
  report.confidence.reasons.forEach(reason => lines.push(`- ${reason}`))
  lines.push(`- _${report.confidence.note}_`)

  return lines.join('\n')
}
