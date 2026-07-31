// Moving-average trend structure.
//
// The classic long-side template: price above the long averages, the averages
// stacked in order, and the slowest one rising. It is a participation filter,
// not a timing signal — it says whether the trend is intact enough to be
// trading the long side at all, which is a different question from whether to
// buy today.
//
// Each condition is reported separately rather than collapsed into a single
// verdict, because a stock failing only "200 rising" is in a very different
// state from one failing every test, and a score alone cannot tell them apart.

// Bars used to measure the 200's direction. Roughly a trading month on daily
// bars — long enough that a week of noise does not flip the reading.
const SLOPE_LOOKBACK = 21
// Below this the slope is treated as flat rather than rising. A 200-period
// average drifting a hundredth of a percent is not an uptrend.
const MIN_SLOPE_PCT = 0.5

function latest(series) {
  if (!Array.isArray(series)) return null
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const v = series[i]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

function slopePct(series, lookback = SLOPE_LOOKBACK) {
  if (!Array.isArray(series) || series.length < lookback + 1) return null
  const now = latest(series)
  const then = series[series.length - 1 - lookback]
  if (now == null || then == null || !Number.isFinite(then) || then === 0) return null
  return ((now - then) / then) * 100
}

/**
 * @param {Object} indicators computeAll() output
 * @param {number} price      current price
 * @returns {Object|null} { checks, passed, total, state, aligned, slope200Pct, distances }
 */
export function maTrendStructure(indicators, price) {
  if (!indicators || !Number.isFinite(price)) return null

  const sma50 = latest(indicators.sma50)
  const sma150 = latest(indicators.sma150)
  const sma200 = latest(indicators.sma200)
  // Without the long averages there is no structure to read. Saying so beats
  // grading a stock on the two checks that happen to be computable.
  if (sma150 == null || sma200 == null) return null

  const slope200Pct = slopePct(indicators.sma200)

  const checks = [
    { key: 'priceAbove150', label: 'מחיר מעל 150', labelEn: 'Price above 150 MA', pass: price > sma150 },
    { key: 'priceAbove200', label: 'מחיר מעל 200', labelEn: 'Price above 200 MA', pass: price > sma200 },
    { key: 'ma150Above200', label: '150 מעל 200', labelEn: '150 above 200', pass: sma150 > sma200 },
    {
      key: 'ma50Above150',
      label: '50 מעל 150 ו-200',
      labelEn: '50 above 150 and 200',
      // Null when the 50 is unavailable rather than a silent failure: an
      // unknown is not the same as a broken stack.
      pass: sma50 == null ? null : (sma50 > sma150 && sma50 > sma200),
    },
    {
      key: 'ma200Rising',
      label: '200 בעלייה',
      labelEn: '200 MA rising',
      pass: slope200Pct == null ? null : slope200Pct > MIN_SLOPE_PCT,
    },
  ]

  const known = checks.filter(c => c.pass !== null)
  const passed = known.filter(c => c.pass).length
  const total = known.length
  const aligned = total > 0 && passed === total

  // Three states, because the middle one is the useful distinction: a stock
  // above its long averages with the stack not yet in order is repairing, and
  // that is neither an uptrend nor a downtrend.
  let state
  if (aligned) state = 'aligned'
  else if (price > sma200 || price > sma150) state = 'repairing'
  else state = 'broken'

  return {
    checks,
    passed,
    total,
    aligned,
    state,
    slope200Pct,
    values: { sma50, sma150, sma200 },
    distances: {
      to150Pct: ((price - sma150) / sma150) * 100,
      to200Pct: ((price - sma200) / sma200) * 100,
    },
  }
}

/**
 * The action the structure supports. Deliberately about participation, not
 * entry: an intact structure permits long trades, it does not call one.
 */
export function structureReading(structure, language = 'he') {
  if (!structure) {
    return language === 'he'
      ? 'אין מספיק היסטוריה לקרוא את מבנה הממוצעים.'
      : 'Not enough history to read the moving-average structure.'
  }
  const he = language === 'he'
  if (structure.state === 'aligned') {
    return he
      ? `מבנה מלא: ${structure.passed}/${structure.total} תנאים. הצד הארוך פתוח — זה לא אות כניסה אלא היתר השתתפות.`
      : `Full alignment: ${structure.passed}/${structure.total}. The long side is open — a participation filter, not an entry.`
  }
  if (structure.state === 'repairing') {
    return he
      ? `מבנה חלקי: ${structure.passed}/${structure.total} תנאים. המחיר מעל אחד הממוצעים הארוכים אך הסדר עוד לא נקבע.`
      : `Partial: ${structure.passed}/${structure.total}. Price is above a long average but the stack is not in order yet.`
  }
  return he
    ? `מבנה שבור: ${structure.passed}/${structure.total} תנאים. המחיר מתחת לממוצעים הארוכים.`
    : `Broken: ${structure.passed}/${structure.total}. Price is below the long averages.`
}
