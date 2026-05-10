export function generateAnalysis(ohlcv, indicators, signal, patterns) {
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
    HOLD:        'סיכום: הסיגנלים מעורבים — המתן לאיתות ברור יותר.',
    SELL:        'סיכום: האינדיקטורים מצביעים על נטייה למכירה.',
    STRONG_SELL: 'סיכום: רוב האינדיקטורים מצביעים על לחץ מכירה חזק.',
  }
  parts.push(conclusions[signal.action] ?? '')

  return parts.join(' ')
}
