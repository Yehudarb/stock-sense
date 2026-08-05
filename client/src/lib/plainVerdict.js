// One plain-language paragraph: should you enter now or not, and under
// what condition entering/exiting would make sense. No tables, no
// indicator names - just the bottom line a trader can act on, built from
// the same signal.decision (lib/analystDecision.js) every other panel
// already uses. Two numbers (entry zone, protection level) are woven into
// the sentence itself instead of a separate metrics grid.

function fmt(value) {
  if (value == null || !Number.isFinite(value)) return null
  return `$${value.toFixed(2)}`
}

function checklistNote(checklist, language) {
  if (checklist?.score == null) return ''
  return language === 'he'
    ? ` (${checklist.score}/10 בצ'קליסט הכניסה)`
    : ` (${checklist.score}/10 on the entry checklist)`
}

export function buildPlainVerdict({ decision, checklist, language = 'he' }) {
  if (!decision) return null

  const isHebrew = language === 'he'
  const note = checklistNote(checklist, language)
  const entryLow = fmt(decision.entryLow)
  const entryHigh = fmt(decision.entryHigh ?? decision.buyAbove)
  const target = fmt(decision.holdUntil)
  const stop = fmt(decision.invalidation)
  const signalStrength = decision.signalStrength
  const cup = decision.cupHandle
  const cupBreakout = decision.cupHandleBreakout === true
  const breakoutActive = cupBreakout || decision.breakoutConfirmed === true

  if (breakoutActive && decision.action !== 'BUY' && decision.action !== 'STRONG_BUY') {
    const pivot = fmt(cup?.pivot ?? decision.buyAbove ?? decision.entryHigh)
    const cupStop = fmt(cup?.stopLoss)
    const patternName = cupBreakout ? 'Cup & Handle' : 'פריצת מחיר טכנית'
    const volumeText = Number.isFinite(cup?.breakoutVolumeRatio)
      ? `, עם נפח פריצה של ${Number(cup.breakoutVolumeRatio).toFixed(2)}x`
      : ''
    return isHebrew
      ? `זוהתה ${patternName} מאושרת מעל ${pivot}${volumeText}. עם זאת, מנוע ההחלטה הראשי עדיין אינו מאשר כניסה חדשה בגלל חולשה במגמה או ביחס הסיכון־סיכוי. מי שכבר בפנים יכול להחזיק רק עם הגנה סביב ${stop ?? cupStop}; יציאה נדרשת אם המחיר יורד מתחת לסטופ או אם הפריצה מתבטלת. אין לרדוף אחרי המחיר.`
      : `A confirmed ${cupBreakout ? 'Cup & Handle' : 'technical price'} breakout was detected above ${pivot}${volumeText}. However, the main decision engine does not approve a new entry because the trend or risk/reward gate is still weak. Existing holders should keep protection around ${stop ?? cupStop}; exit if price breaks the stop or the breakout is invalidated. Do not chase price.`
  }

  if (decision.action === 'BUY' || decision.action === 'STRONG_BUY') {
    return isHebrew
      ? `כדאי לשקול כניסה עכשיו${note}. הכיוון חיובי עם עוצמת אות ${signalStrength}/100, שאינה הסתברות. אזור כניסה סביר: ${entryLow}–${entryHigh}. שימו סטופ הגנה סביב ${stop} ואל תזיזו אותו כלפי מטה, עם יעד עבודה ראשון סביב ${target}. אם המחיר יורד מתחת ל-${stop} — צאו מהעסקה, התכנית לא עבדה הפעם.`
      : `Worth considering an entry now${note}. Direction is positive with a signal strength of ${signalStrength}/100; this is not a probability. A reasonable entry zone is ${entryLow}–${entryHigh}. Set a protective stop around ${stop} and never move it lower, with a first working target near ${target}. If price drops below ${stop}, exit - the setup didn't work this time.`
  }

  if (decision.action === 'HOLD') {
    return isHebrew
      ? `כרגע אין סיבה מספיק ברורה להיכנס לעסקה חדשה${note}. מי שכבר בפוזיציה יכול להמשיך להחזיק עם סטופ הגנה סביב ${stop}. כדי שכניסה חדשה תהיה הגיונית, המחיר צריך לפרוץ מעל ${entryHigh} בנפח גבוה, או להראות התאוששות ברורה מעל תמיכה. עד אז — עדיף להישאר בצד.`
      : `There isn't a clear enough edge for a new entry right now${note}. Anyone already in the position can keep holding with a protective stop around ${stop}. For a new entry to make sense, price needs to break above ${entryHigh} on strong volume, or show a clear recovery above support. Until then, staying on the sidelines is the better call.`
  }

  // SELL / STRONG_SELL
  return isHebrew
    ? `כרגע לא כדאי להיכנס או להחזיק פוזיציית קנייה — הלחץ השלילי גובר על הסיכוי${note}. מי שכבר בפנים כדאי שישקול לצמצם חשיפה או לצאת אם המחיר יורד מתחת ל-${stop}. כניסה מחודשת תהיה הגיונית רק אחרי שהמחיר יתייצב ויחזור מעל רמה ברורה, עם נפח תומך.`
    : `This isn't a good time to enter or hold a long position - downside pressure outweighs the upside${note}. Anyone already in should consider trimming exposure or exiting if price drops below ${stop}. A fresh entry only makes sense once price stabilizes and reclaims a clear level on supportive volume.`
}
