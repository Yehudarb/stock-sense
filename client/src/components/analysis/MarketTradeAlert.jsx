const CONFIG = {
  PANIC: {
    title: 'השוק במצב פאניקה',
    message: 'לא כדאי לפתוח קנייה אגרסיבית בלי אישור חריג וחזק מאוד.',
    className: 'border-red-600 bg-red-950/70 text-red-100',
    badge: 'עצור',
  },
  BEAR: {
    title: 'השוק נגד העסקה',
    message: 'השוק הרחב בריש. קנייה חדשה מסוכנת יותר ועדיף להמתין לאישור.',
    className: 'border-red-700 bg-red-950/55 text-red-100',
    badge: 'בריש',
  },
  MILD_BEAR: {
    title: 'השוק חלש',
    message: 'יש רוח נגדית מהשוק הרחב. אפשר לעקוב, אבל לא לרדוף אחרי מחיר.',
    className: 'border-orange-700 bg-orange-950/45 text-orange-100',
    badge: 'זהירות',
  },
  NEUTRAL: {
    title: 'השוק ניטרלי',
    message: 'אין תמיכה חזקה מהשוק הרחב. עדיף להסתמך על פריצה/תמיכה ברורה בגרף.',
    className: 'border-yellow-700 bg-yellow-950/40 text-yellow-100',
    badge: 'המתנה',
  },
  MILD_BULL: {
    title: 'השוק תומך בעסקה',
    message: 'יש רוח גבית מהשוק הרחב, אבל עדיין כדאי לעבוד לפי רמות הגנה.',
    className: 'border-lime-700 bg-lime-950/40 text-lime-100',
    badge: 'חיובי',
  },
  BULL: {
    title: 'השוק תומך בקנייה',
    message: 'השוק הרחב בוליש ומחזק עסקאות בכיוון חיובי, כל עוד הגרף מאשר.',
    className: 'border-green-700 bg-green-950/45 text-green-100',
    badge: 'בוליש',
  },
}

function scoreText(score) {
  if (score == null || Number.isNaN(score)) return '-'
  return score > 0 ? `+${score}` : String(score)
}

export default function MarketTradeAlert({ marketContext, isLoading }) {
  if (isLoading && !marketContext) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-right text-sm text-slate-400">
        בודק אם השוק הרחב תומך בעסקה...
      </div>
    )
  }

  if (!marketContext) return null

  const config = CONFIG[marketContext.condition] ?? CONFIG.NEUTRAL

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-lg ${config.className}`} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-950/60 px-2.5 py-1 text-xs font-black">{config.badge}</span>
            <span className="text-base font-black">{config.title}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed opacity-90">{config.message}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-lg bg-slate-950/50 px-3 py-2 font-bold">
            Market Score: {scoreText(marketContext.score)}
          </span>
          <span className="rounded-lg bg-slate-950/50 px-3 py-2 font-bold">
            SPY/QQQ: {marketContext.alignmentPct}%
          </span>
          <span className="rounded-lg bg-slate-950/50 px-3 py-2 font-bold">
            סקטור: {marketContext.sectorEtf}
          </span>
        </div>
      </div>
    </div>
  )
}
