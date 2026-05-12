const CONFIG = {
  he: {
    PANIC: ['השוק במצב פאניקה', 'לא כדאי לפתוח קנייה אגרסיבית בלי אישור חריג וחזק מאוד.', 'עצור'],
    BEAR: ['השוק נגד העסקה', 'השוק הרחב בריש. קנייה חדשה מסוכנת יותר ועדיף להמתין לאישור.', 'בריש'],
    MILD_BEAR: ['השוק חלש', 'יש רוח נגדית מהשוק הרחב. אפשר לעקוב, אבל לא לרדוף אחרי מחיר.', 'זהירות'],
    NEUTRAL: ['השוק ניטרלי', 'אין תמיכה חזקה מהשוק הרחב. עדיף להסתמך על פריצה או תמיכה ברורה בגרף.', 'המתנה'],
    MILD_BULL: ['השוק תומך בעסקה', 'יש רוח גבית מהשוק הרחב, אבל עדיין כדאי לעבוד לפי רמות ההגנה.', 'חיובי'],
    BULL: ['השוק תומך בקנייה', 'השוק הרחב בוליש ומחזק עסקאות בכיוון חיובי, כל עוד הגרף מאשר.', 'בוליש'],
  },
  en: {
    PANIC: ['Market is in panic mode', 'Avoid aggressive new buys unless confirmation is unusually strong.', 'Stop'],
    BEAR: ['Market is against the trade', 'The broad market is bearish. New buys are riskier and should wait for confirmation.', 'Bearish'],
    MILD_BEAR: ['Market is weak', 'There is broad-market headwind. Track the setup, but avoid chasing price.', 'Caution'],
    NEUTRAL: ['Market is neutral', 'There is no strong broad-market support. Rely on a clear breakout or support level.', 'Wait'],
    MILD_BULL: ['Market supports the trade', 'The broad market is a tailwind, but protection levels still matter.', 'Positive'],
    BULL: ['Market supports buying', 'The broad market is bullish and supports positive trades when the chart confirms.', 'Bullish'],
  },
}

const CLASS_NAME = {
  PANIC: 'border-red-600/50 bg-red-950/20 text-red-100',
  BEAR: 'border-red-700/50 bg-red-950/20 text-red-100',
  MILD_BEAR: 'border-orange-700/50 bg-orange-950/20 text-orange-100',
  NEUTRAL: 'border-slate-700/50 bg-slate-900/30 text-slate-100',
  MILD_BULL: 'border-lime-700/50 bg-lime-950/20 text-lime-100',
  BULL: 'border-green-700/50 bg-green-950/20 text-green-100',
}

function scoreText(score) {
  if (score == null || Number.isNaN(score)) return '-'
  return score > 0 ? `+${score}` : String(score)
}

export default function MarketTradeAlert({ marketContext, isLoading, language = 'he' }) {
  const isEnglish = language === 'en'

  if (isLoading && !marketContext) {
    return (
      <div className="glass-panel px-4 py-3 text-sm text-slate-400" dir={isEnglish ? 'ltr' : 'rtl'}>
        {isEnglish ? 'Checking whether the broad market supports this trade...' : 'בודק אם השוק הרחב תומך בעסקה...'}
      </div>
    )
  }

  if (!marketContext) return null

  const [title, message, badge] = CONFIG[language]?.[marketContext.condition] ?? CONFIG[language]?.NEUTRAL ?? CONFIG.he.NEUTRAL

  return (
    <div className={`glass-panel p-4 ${CLASS_NAME[marketContext.condition] ?? CLASS_NAME.NEUTRAL}`} dir={isEnglish ? 'ltr' : 'rtl'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-950/60 px-2.5 py-1 text-xs font-black">{badge}</span>
            <span className="text-base font-black">{title}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed opacity-90">{message}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-lg bg-slate-950/50 px-3 py-2 font-bold">Market Score: {scoreText(marketContext.score)}</span>
          <span className="rounded-lg bg-slate-950/50 px-3 py-2 font-bold">SPY/QQQ: {marketContext.alignmentPct}%</span>
          <span className="rounded-lg bg-slate-950/50 px-3 py-2 font-bold">{isEnglish ? 'Sector' : 'סקטור'}: {marketContext.sectorEtf}</span>
        </div>
      </div>
    </div>
  )
}
