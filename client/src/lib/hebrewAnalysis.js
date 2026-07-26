function generateEnglishAnalysis(ohlcv, indicators, signal, patterns) {
  if (!signal || !indicators || !ohlcv?.length) return ''

  const last = ohlcv.length - 1
  const price = ohlcv[last].c
  const rsi = indicators.rsi14[last]
  const stochK = indicators.stoch?.k[last]
  const willR = indicators.willR?.[last]
  const macdLine = indicators.macd.line[last]
  const macdSig = indicators.macd.signal[last]
  const sma50 = indicators.sma50?.[last]
  const sma200 = indicators.sma200?.[last]
  const bbUpper = indicators.bb20.upper[last]
  const bbLower = indicators.bb20.lower[last]
  const parts = []

  if (sma50 && sma200) {
    if (price > sma50 && price > sma200 && sma50 > sma200) {
      parts.push('The stock is in an uptrend: price is above SMA50 and SMA200, with SMA50 above SMA200.')
    } else if (price < sma50 && price < sma200) {
      parts.push('The stock is in a downtrend: price is below SMA50 and SMA200, so new entries require extra caution.')
    } else {
      parts.push('The stock is trading sideways, with no clear trend advantage.')
    }
  }

  if (rsi != null) {
    if (rsi < 30) parts.push(`RSI is ${rsi.toFixed(1)}, an oversold area that can support a technical rebound.`)
    else if (rsi < 40) parts.push(`RSI is ${rsi.toFixed(1)}, showing mild negative momentum.`)
    else if (rsi < 55) parts.push(`RSI is ${rsi.toFixed(1)}, a neutral zone with no clear edge.`)
    else if (rsi < 70) parts.push(`RSI is ${rsi.toFixed(1)}, showing constructive momentum without being overbought.`)
    else parts.push(`RSI is ${rsi.toFixed(1)}, an overbought area where chasing new entries is riskier.`)
  }

  if (stochK != null) {
    if (stochK < 20) parts.push(`Stochastic %K is ${stochK.toFixed(1)}, an oversold reading that may support a rebound setup.`)
    else if (stochK > 80) parts.push(`Stochastic %K is ${stochK.toFixed(1)}, an overbought reading where profit-taking risk rises.`)
  }

  if (willR != null) {
    if (willR < -80) parts.push(`Williams %R is ${willR.toFixed(1)}, showing stretched selling pressure.`)
    else if (willR > -20) parts.push(`Williams %R is ${willR.toFixed(1)}, showing an overbought momentum zone.`)
  }

  if (macdLine != null && macdSig != null) {
    if (macdLine > macdSig) parts.push(`MACD is above its signal line by ${(macdLine - macdSig).toFixed(4)}, supporting positive momentum.`)
    else parts.push('MACD is below its signal line, showing weaker momentum.')
  }

  if (bbUpper != null && bbLower != null) {
    if (price < bbLower) parts.push('Price is below the lower Bollinger Band, a stretched downside move that can mean-revert.')
    else if (price > bbUpper) parts.push('Price is above the upper Bollinger Band, so the move is extended and reversal risk is higher.')
    else {
      const bandPct = ((price - bbLower) / (bbUpper - bbLower) * 100).toFixed(0)
      parts.push(`Price is ${bandPct}% through the Bollinger range, still inside the normal band.`)
    }
  }

  if (patterns?.patterns?.length > 0) {
    const bullish = patterns.patterns.filter(p => p.weight > 0).map(p => p.label)
    const bearish = patterns.patterns.filter(p => p.weight < 0).map(p => p.label)
    if (bullish.length > 0) parts.push(`Bullish patterns detected: ${bullish.join(', ')}.`)
    if (bearish.length > 0) parts.push(`Bearish patterns detected: ${bearish.join(', ')}.`)
  }

  if (signal.gates) {
    const { confluence, reversal } = signal.gates
    if (confluence?.active != null && signal.score >= 0) {
      parts.push(`${confluence.active} of ${confluence.total} indicators are aligned with the buy side.`)
    }
    if (reversal?.passed) parts.push('A bullish candle reversal was confirmed.')
  }

  const conclusions = {
    STRONG_BUY: 'Summary: most indicators point to a strong buy opportunity.',
    BUY: 'Summary: indicators lean toward a buy setup.',
    BUY_SETUP: 'Summary: a bullish setup is confirmed at the pivot — buy the breakout with the pattern stop.',
    SETUP_HOLD: 'Summary: a bullish base is in play; the current pullback is part of the setup, not a sell signal. Wait at the pivot.',
    SELL_SETUP: 'Summary: a topping pattern broke its neckline — exit longs / short with the pattern stop.',
    SETUP_AVOID: 'Summary: a valid topping pattern is still intact — do not buy here. Wait for the pattern to invalidate or break down before acting.',
    HOLD: 'Summary: signals are mixed, so waiting for clearer confirmation is preferable.',
    SELL: 'Summary: indicators lean toward reducing exposure.',
    STRONG_SELL: 'Summary: most indicators point to strong selling pressure.',
  }
  parts.push(conclusions[signal.action] ?? 'Summary: there is no clear conclusion right now.')

  return parts.join(' ')
}

export function generateAnalysis(ohlcv, indicators, signal, patterns, language = 'he') {
  if (language === 'en') return generateEnglishAnalysis(ohlcv, indicators, signal, patterns)
  if (!signal || !indicators || !ohlcv?.length) return ''

  const last     = ohlcv.length - 1
  const rsi      = indicators.rsi14[last]
  const stochK   = indicators.stoch?.k[last]
  const willR    = indicators.willR?.[last]
  const macdLine = indicators.macd.line[last]
  const macdSig  = indicators.macd.signal[last]
  const macdPrev = indicators.macd.line[last - 1]
  const macdSigP = indicators.macd.signal[last - 1]
  const price    = ohlcv[last].c
  const bbUpper  = indicators.bb20.upper[last]
  const bbLower  = indicators.bb20.lower[last]
  const sma50    = indicators.sma50?.[last]
  const sma200   = indicators.sma200?.[last]

  const parts = []
  const fmtLevel = (v) => v == null ? '—' : (v >= 100 ? v.toFixed(2) : v.toFixed(3))

  // Market structure — described FIRST, before setups and indicators.
  // Analysts read the chart as a sequence of pivots; whether the last two swings
  // made a HH/HL (bullish continuation) or an LH/LL (bearish continuation) tells
  // you more about the regime than any oscillator. BOS / CHoCH events, when
  // present, are called out because they're the actionable structural triggers.
  const structure = signal?.structure
  if (structure && structure.lastPivots?.length) {
    const trendText = {
      bullish:       'מבנה שוק עולה — רצף של שיאים גבוהים ושפלים גבוהים (HH/HL)',
      bearish:       'מבנה שוק יורד — רצף של שיאים נמוכים ושפלים נמוכים (LH/LL)',
      consolidating: 'מבנה שוק צדדי — אין רצף פיוטים דומיננטי',
    }[structure.trend] || 'מבנה השוק לא מובהק'
    const strengthTxt = structure.strength >= 80 ? ' (מבנה נקי)'
                     : structure.strength >= 60 ? ''
                     : ' (מבנה מעורב)'
    parts.push(`${trendText}${strengthTxt}. חוזק מבנה: ${structure.strength}%.`)

    const kl = structure.keyLevels
    if (structure.trend === 'bullish') {
      if (kl.lastSwingHigh != null) parts.push(`שיא אחרון: $${fmtLevel(kl.lastSwingHigh)} (השבירה מעליו מאשרת BOS).`)
      if (kl.lastSwingLow  != null) parts.push(`שפל תמיכה קריטי (HL אחרון): $${fmtLevel(kl.lastSwingLow)} — שבירתו למטה = CHoCH ראשוני של היפוך.`)
    } else if (structure.trend === 'bearish') {
      if (kl.lastSwingLow  != null) parts.push(`שפל אחרון: $${fmtLevel(kl.lastSwingLow)} (השבירה מתחתיו מאשרת BOS).`)
      if (kl.lastSwingHigh != null) parts.push(`שיא התנגדות קריטי (LH אחרון): $${fmtLevel(kl.lastSwingHigh)} — פריצה מעליו = CHoCH ראשוני של היפוך.`)
    }

    if (structure.bosDirection === 'up') {
      parts.push('BOS ↑ מאושר — המחיר שבר את השיא המבני הקודם וממשיך את המגמה.')
    } else if (structure.bosDirection === 'down') {
      parts.push('BOS ↓ מאושר — המחיר שבר את השפל המבני הקודם וממשיך את המגמה.')
    }
    if (structure.chochDirection === 'up') {
      parts.push('⚠️ CHoCH ↑ — לראשונה נשבר שיא מבני נגד המגמה היורדת. אזהרה מוקדמת של אפשרות היפוך. עדיין דורש BOS למעלה כדי לפעול לונג.')
    } else if (structure.chochDirection === 'down') {
      parts.push('⚠️ CHoCH ↓ — לראשונה נשבר שפל מבני נגד המגמה העולה. אזהרה מוקדמת של אפשרות היפוך. עדיין דורש BOS למטה כדי לפעול שורט.')
    }
  }

  // Setup-first framing: when a strong base/continuation pattern is in play the
  // setup story anchors the analysis, so lead with it. Indicator readings that
  // follow are then interpreted through that lens (weakness in a handle is
  // expected, strength inside a right-shoulder is expected).
  const setup = signal?.setup
  if (setup) {
    const isBearish = setup.direction === 'bearish'
    const fmt = (v) => v == null ? '—' : (v >= 100 ? v.toFixed(2) : v.toFixed(3))
    const bullStageText = {
      cup_forming:    'הגביע עדיין בגיבוש (הצד הימני עוד לא הושלם)',
      in_handle:      'המחיר בתוך ההידית — פולבק צפוי אחרי הגביע',
      near_breakout:  'המחיר קרוב מאוד לנקודת הפריצה — לצפות בסניף לפריצה בנפח',
      broken_out:     'התבנית פרצה מעל הפיווט — כניסה בברייקאאוט מאושרת',
      developing:     'התבנית בפיתוח',
    }
    const bearStageText = {
      in_handle:      'המחיר עוד מעל קו הצוואר / התמיכה — הבסיס בישי אך טרם שבור',
      near_breakout:  'המחיר קרוב מאוד לקו הצוואר / התמיכה — לצפות לשבירה כלפי מטה',
      broken_out:     'התבנית שברה את קו הצוואר — יעד מדוד למטה מאושר',
      developing:     'התבנית בפיתוח',
    }
    const stageText = (isBearish ? bearStageText : bullStageText)[setup.stage] || 'התבנית בפיתוח'
    const distTxt = setup.distanceToBreakoutPct != null
      ? isBearish
        ? ` (${(setup.distanceToBreakoutPct * 100).toFixed(1)}% מעל קו הצוואר)`
        : ` (${(setup.distanceToBreakoutPct * 100).toFixed(1)}% מתחת לפיווט)`
      : ''
    const setupLabel = setup.key === 'CUP_HANDLE' ? 'קאפ אנד הנדל (Cup & Handle)'
      : setup.key === 'HEAD_SHOULDERS' ? 'ראש וכתפיים (Head & Shoulders)'
      : setup.key === 'INVERSE_HEAD_SHOULDERS' ? 'ראש וכתפיים הפוכה (Inverse H&S)'
      : setup.key === 'SYMMETRICAL_TRIANGLE_BREAK_UP' ? 'פריצת משולש מתכנס כלפי מעלה'
      : setup.key === 'SYMMETRICAL_TRIANGLE_BREAK_DOWN' ? 'שבירת משולש מתכנס כלפי מטה'
      : setup.key === 'TRENDLINE_BREAK_UP' ? 'פריצת קו מגמה יורד (Downtrend Line Break)'
      : setup.key === 'TRENDLINE_BREAK_DOWN' ? 'שבירת קו מגמה עולה (Uptrend Line Break)'
      : setup.label || setup.key
    const patternType = isBearish ? 'תבנית טופ בישית' : 'תבנית בסיס בישית'
    parts.push(`זוהתה ${patternType} — ${setupLabel}. ${stageText}${distTxt}.`)
    if (setup.pivot != null) {
      const pivotLabel = isBearish ? 'קו צוואר / תמיכה' : 'נקודת פריצה (Pivot)'
      parts.push(`${pivotLabel}: $${fmt(setup.pivot)}.`)
    }
    if (setup.target != null) {
      const targetLabel = isBearish ? 'יעד מדוד למטה לאחר שבירה' : 'יעד מדוד לאחר פריצה'
      parts.push(`${targetLabel}: $${fmt(setup.target)}.`)
    }
    if (setup.stopLoss != null) {
      const stopLabel = isBearish
        ? `Stop / Invalidation: מעל $${fmt(setup.stopLoss)} — סגירה שם מבטלת את התבנית.`
        : `Stop / Invalidation: מתחת ל-$${fmt(setup.stopLoss)} — סגירה שם מבטלת את התבנית.`
      parts.push(stopLabel)
    }
    parts.push(isBearish
      ? 'התחזקות אינדיקטורים בתוך הכתף הימנית / בסיס הטופ היא חלק מהמבנה, לא סיבה לקנות.'
      : 'חולשת אינדיקטורים בתוך התבנית היא חלק מהמבנה, לא סיבה למכור.')
  }

  // Trend / Regime
  if (sma50 && sma200) {
    if (price > sma50 && price > sma200 && sma50 > sma200)
      parts.push('המניה נמצאת במגמה עולה — מחיר מעל SMA50 ו-SMA200, עם SMA50 מעל SMA200.')
    else if (price < sma50 && price < sma200)
      parts.push('המניה נמצאת במגמה יורדת — מחיר מתחת ל-SMA50 ו-SMA200. זהירות בכניסות חדשות.')
    else
      parts.push('המניה נמצאת בטווח מסחר צדדי — אין מגמה ברורה.')
  }

  // RSI
  if (rsi != null) {
    if (rsi < 30)      parts.push(`RSI עומד על ${rsi.toFixed(1)} — אזור מכירת יתר קיצוני. פוטנציאל לתיקון מעלה.`)
    else if (rsi < 40) parts.push(`RSI עומד על ${rsi.toFixed(1)} — מומנטום שלילי קל, לחץ מצד המוכרים.`)
    else if (rsi < 55) parts.push(`RSI עומד על ${rsi.toFixed(1)} — אזור ניטרלי, אין העדפה ברורה.`)
    else if (rsi < 70) parts.push(`RSI עומד על ${rsi.toFixed(1)} — מומנטום חיובי, עדיין לא בקנייה יתר.`)
    else               parts.push(`RSI עומד על ${rsi.toFixed(1)} — שוק מחומם, קנייה יתר. היזהר מכניסות חדשות.`)
  }

  // Stochastic
  if (stochK != null) {
    if (stochK < 20)      parts.push(`Stochastic %K עומד על ${stochK.toFixed(1)} — מכירת יתר. אות קנייה פוטנציאלי.`)
    else if (stochK > 80) parts.push(`Stochastic %K עומד על ${stochK.toFixed(1)} — קנייה יתר. שקול נטילת רווחים.`)
  }

  // Williams %R
  if (willR != null) {
    if (willR < -80)      parts.push(`Williams %R עומד על ${willR.toFixed(1)} — אזור מכירת יתר, לחץ מוכרים מוגזם.`)
    else if (willR > -20) parts.push(`Williams %R עומד על ${willR.toFixed(1)} — קנייה יתר, מומנטום יורד.`)
  }

  // MACD
  if (macdLine != null && macdSig != null && macdPrev != null && macdSigP != null) {
    const crossedUp   = macdPrev < macdSigP && macdLine >= macdSig
    const crossedDown = macdPrev > macdSigP && macdLine <= macdSig
    if (crossedUp)        parts.push('MACD חצה מעלה את קו הסיגנל — סיגנל בולישי חזק.')
    else if (crossedDown) parts.push('MACD חצה מטה את קו הסיגנל — סיגנל דובי, המומנטום מתהפך.')
    else if (macdLine > macdSig) parts.push(`MACD מעל קו הסיגנל (פרש: ${(macdLine - macdSig).toFixed(4)}) — מומנטום עולה.`)
    else parts.push('MACD מתחת לקו הסיגנל — חולשה במומנטום.')
  }

  // Bollinger Bands
  if (bbUpper != null && bbLower != null) {
    if (price < bbLower)      parts.push('המחיר מתחת ל-Bollinger Band תחתון — מחיר קיצוני, צפוי חזרה לממוצע.')
    else if (price > bbUpper) parts.push('המחיר מעל ה-Bollinger Band העליון — מחיר מתוח, שים לב להיפוך.')
    else {
      const pct = ((price - bbLower) / (bbUpper - bbLower) * 100).toFixed(0)
      parts.push(`המחיר ב-${pct}% מרוחב רצועות Bollinger — בתוך הטווח הנורמלי.`)
    }
  }

  // Patterns
  if (patterns?.patterns?.length > 0) {
    const bullish = patterns.patterns.filter(p => p.weight > 0).map(p => p.label)
    const bearish = patterns.patterns.filter(p => p.weight < 0).map(p => p.label)
    if (bullish.length > 0) parts.push(`תבניות בוליות זוהו: ${bullish.join(', ')}.`)
    if (bearish.length > 0) parts.push(`תבניות דוביות זוהו: ${bearish.join(', ')}.`)
  }

  // Gates
  if (signal.gates) {
    const { confluence, reversal } = signal.gates
    if (confluence?.active != null)
      parts.push(`${confluence.active} מתוך ${confluence.total} אינדיקטורים מיושרים לכיוון ${signal.score >= 0 ? 'קנייה' : 'מכירה'}.`)
    if (reversal?.passed)
      parts.push('אושרה נר בולישי עם עלייה בנפח — אישור היפוך.')
  }

  // Conclusion
  const conclusions = {
    STRONG_BUY:  'סיכום: רוב האינדיקטורים מצביעים על הזדמנות קנייה חזקה.',
    BUY:         'סיכום: האינדיקטורים מצביעים על נטייה לקנייה.',
    BUY_SETUP:   'סיכום: התבנית הבישית פרצה את הפיווט — כניסת ברייקאאוט עם עצירה של התבנית.',
    SETUP_HOLD:  'סיכום: תבנית בסיס בישית בפיתוח — הפולבק הנוכחי חלק מהמבנה, לא סיבה למכור. להמתין ולעקוב לפריצת הפיווט.',
    SELL_SETUP:  'סיכום: תבנית טופ שברה את קו הצוואר / התמיכה — יציאה מלונג / כניסת שורט עם עצירה של התבנית.',
    SETUP_AVOID: 'סיכום: תבנית טופ בישית עדיין תקפה — לא הזמן להיכנס בלונג. להמתין לביטול התבנית או לשבירה כדי לפעול.',
    HOLD:        'סיכום: הסיגנלים מעורבים — המתן לאיתות ברור יותר.',
    SELL:        'סיכום: האינדיקטורים מצביעים על נטייה למכירה.',
    STRONG_SELL: 'סיכום: רוב האינדיקטורים מצביעים על לחץ מכירה חזק.',
  }
  parts.push(conclusions[signal.action] ?? '')

  return parts.join(' ')
}
