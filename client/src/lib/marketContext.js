const SECTOR_MAP = {
  AAPL: 'XLK',
  MSFT: 'XLK',
  NVDA: 'XLK',
  AMD: 'XLK',
  GOOGL: 'XLK',
  META: 'XLK',
  TSLA: 'XLK',
  TSLL: 'XLK',
  SMCI: 'XLK',
  PLTR: 'XLK',
  AMZN: 'XLY',
  NFLX: 'XLC',
  AVGO: 'XLK',
  JPM: 'XLF',
  BAC: 'XLF',
  GS: 'XLF',
  XOM: 'XLE',
  CVX: 'XLE',
  SPY: 'SPY',
  QQQ: 'QQQ',
  SOXL: 'XLK',
  TQQQ: 'QQQ',
}

export function getSectorEtf(ticker) {
  return SECTOR_MAP[ticker?.toUpperCase()] ?? 'QQQ'
}

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function pct(from, to) {
  if (!from || to == null) return null
  return (to - from) / from
}

function assetStats(symbol, bars) {
  if (!bars?.length || bars.length < 2) return null

  const last = bars[bars.length - 1]
  const close = last.c
  const valueAt = offset => bars[Math.max(0, bars.length - 1 - offset)]?.c
  const return1d = pct(valueAt(1), close) ?? 0
  const return3d = pct(valueAt(3), close) ?? 0
  const return5d = pct(valueAt(5), close) ?? 0
  const return10d = pct(valueAt(10), close) ?? 0
  const trendBase = valueAt(5) ?? bars[0]?.c

  return {
    symbol,
    current: round(close, symbol === '^VIX' ? 1 : 2),
    return1d: round(return1d * 100, 2),
    return3d: round(return3d * 100, 2),
    return5d: round(return5d * 100, 2),
    return10d: round(return10d * 100, 2),
    trend: close >= trendBase ? 'UP' : 'DOWN',
  }
}

function classifyMarket(score, vixLevel) {
  if (vixLevel > 35) return 'PANIC'
  if (score >= 2) return 'BULL'
  if (score >= 0.5) return 'MILD_BULL'
  if (score <= -2) return 'BEAR'
  if (score <= -0.5) return 'MILD_BEAR'
  return 'NEUTRAL'
}

function conditionLabel(condition) {
  return {
    PANIC: 'פאניקה',
    BULL: 'שוק בוליש',
    MILD_BULL: 'שוק חיובי',
    NEUTRAL: 'שוק ניטרלי',
    MILD_BEAR: 'שוק שלילי',
    BEAR: 'שוק בריש',
  }[condition] ?? 'לא ידוע'
}

function addFactor(factors, text, tone = 'neutral') {
  if (text) factors.push({ text, tone })
}

export function computeMarketContext(ticker, assetBars) {
  const sectorEtf = getSectorEtf(ticker)
  const spy = assetStats('SPY', assetBars?.SPY)
  const qqq = assetStats('QQQ', assetBars?.QQQ)
  const sector = sectorEtf !== 'SPY' && sectorEtf !== 'QQQ'
    ? assetStats(sectorEtf, assetBars?.[sectorEtf])
    : null
  const vix = assetStats('^VIX', assetBars?.['^VIX'])
  const dollar = assetStats('DX-Y.NYB', assetBars?.['DX-Y.NYB'])
  const tlt = assetStats('TLT', assetBars?.TLT)
  const gld = assetStats('GLD', assetBars?.GLD)
  const factors = []
  let score = 0

  if (spy) {
    if (spy.return5d > 2) {
      score += 1
      addFactor(factors, `SPY חזק השבוע: +${spy.return5d}%`, 'bullish')
    } else if (spy.return5d > 0) {
      score += 0.5
      addFactor(factors, `SPY חיובי: +${spy.return5d}%`, 'bullish')
    } else if (spy.return5d < -2) {
      score -= 1.5
      addFactor(factors, `SPY חלש השבוע: ${spy.return5d}%`, 'bearish')
    } else if (spy.return5d < 0) {
      score -= 0.5
      addFactor(factors, `SPY שלילי קל: ${spy.return5d}%`, 'bearish')
    }
  }

  if (qqq) {
    if (qqq.return5d > 2) {
      score += 0.6
      addFactor(factors, `QQQ חזק: +${qqq.return5d}%`, 'bullish')
    } else if (qqq.return5d < -2) {
      score -= 0.7
      addFactor(factors, `QQQ חלש: ${qqq.return5d}%`, 'bearish')
    }
  }

  if (sector) {
    if (sector.return5d > 1.5) {
      score += 0.9
      addFactor(factors, `הסקטור ${sectorEtf} עולה: +${sector.return5d}%`, 'bullish')
    } else if (sector.return5d < -1.5) {
      score -= 0.9
      addFactor(factors, `הסקטור ${sectorEtf} יורד: ${sector.return5d}%`, 'bearish')
    }
  }

  const vixLevel = vix?.current ?? 20
  if (vix) {
    if (vixLevel > 35) {
      score -= 2
      addFactor(factors, `VIX גבוה מאוד (${vixLevel}) - מצב פאניקה`, 'bearish')
    } else if (vixLevel > 25) {
      score -= 1
      addFactor(factors, `VIX מוגבר (${vixLevel}) - לעבוד בזהירות`, 'bearish')
    } else if (vixLevel < 15) {
      score += 0.5
      addFactor(factors, `VIX נמוך (${vixLevel}) - שוק רגוע`, 'bullish')
    } else {
      addFactor(factors, `VIX תקין (${vixLevel})`, 'neutral')
    }
  }

  if (dollar) {
    if (dollar.return5d > 1) {
      score -= 0.4
      addFactor(factors, 'הדולר מתחזק - רוח נגדית למניות צמיחה', 'bearish')
    } else if (dollar.return5d < -1) {
      score += 0.4
      addFactor(factors, 'הדולר נחלש - רוח גבית למניות צמיחה', 'bullish')
    }
  }

  if (tlt) {
    if (tlt.return5d < -2) {
      score -= 0.5
      addFactor(factors, `TLT יורד ${tlt.return5d}% - תשואות עולות`, 'bearish')
    } else if (tlt.return5d > 2) {
      score += 0.5
      addFactor(factors, `TLT עולה +${tlt.return5d}% - לחץ ריביות יורד`, 'bullish')
    }
  }

  if (gld && gld.return5d > 2 && spy?.return5d < 0) {
    score -= 0.35
    addFactor(factors, 'זהב עולה כשהשוק חלש - נטייה ל-risk off', 'bearish')
  }

  const marketLeaders = [spy, qqq].filter(Boolean)
  const bullishLeaders = marketLeaders.filter(asset => asset.trend === 'UP').length
  const alignmentPct = marketLeaders.length ? Math.round((bullishLeaders / marketLeaders.length) * 100) : 0

  if (alignmentPct === 100) addFactor(factors, 'SPY ו-QQQ מיושרים למעלה', 'bullish')
  if (alignmentPct === 0 && marketLeaders.length) addFactor(factors, 'SPY ו-QQQ מיושרים למטה', 'bearish')

  const cappedScore = round(clamp(score, -3, 3))
  const condition = classifyMarket(cappedScore, vixLevel)
  const shouldBlockBuy = condition === 'PANIC' || condition === 'BEAR'

  return {
    version: 'v4 multi-asset',
    ticker,
    sectorEtf,
    score: cappedScore,
    condition,
    label: conditionLabel(condition),
    alignmentPct,
    shouldBlockBuy,
    factors: factors.slice(0, 8),
    assets: {
      spy,
      qqq,
      sector,
      vix,
      dollar,
      tlt,
      gld,
    },
  }
}
