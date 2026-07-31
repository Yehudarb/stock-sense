import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { TRADER_TEXT } from '../../lib/traderColors'
import { buildTradeChecklist } from '../../lib/tradeChecklist'

const RECOMMENDATION_COPY = {
  ready: {
    he: { label: '✅ מוכן לכניסה', detail: 'הציון עומד ברף המינימלי (7/10 ומעלה).' },
    en: { label: '✅ Entry ready', detail: 'Score clears the 7/10 minimum bar.' },
    tone: 'bullish',
  },
  borderline: {
    he: { label: '⚠️ גבולי', detail: 'ציון 6/10 — אפשר להיכנס בזהירות עם פוזיציה מוקטנת.' },
    en: { label: '⚠️ Borderline', detail: 'Score is 6/10 — proceed cautiously with a smaller size, if at all.' },
    tone: 'neutral',
  },
  wait: {
    he: { label: '⛔ המתן', detail: 'פחות מ-6/10 — אין מספיק אישורים לכניסה כרגע.' },
    en: { label: '⛔ Wait', detail: 'Below 6/10 — not enough confirmation to enter yet.' },
    tone: 'bearish',
  },
  'no-bias': {
    he: { label: 'אין הטיה ברורה', detail: 'הצ׳קליסט בודק אישורים לכיוון מסוים; כרגע התחזית ניטרלית.' },
    en: { label: 'No clear bias', detail: 'The checklist confirms a specific direction; the forecast is currently neutral.' },
    tone: 'neutral',
  },
}

function ChecklistRow({ item, _isHebrew }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
      item.pass ? 'border-green-500/20 bg-green-950/10' : 'border-slate-800/60 bg-slate-950/40'
    }`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {item.pass
          ? <CheckCircle2 size={16} className="shrink-0 text-green-400" />
          : <XCircle size={16} className="shrink-0 text-slate-600" />}
        <span className={`text-sm font-semibold truncate ${item.pass ? 'text-slate-200' : 'text-slate-500'}`}>
          {item.label}
        </span>
      </div>
      <span className="shrink-0 text-xs font-mono text-slate-500">{item.detail}</span>
    </div>
  )
}

export default function TradeChecklistPanel({ ohlcv, indicators, signal, forecast, earnings, language = 'he' }) {
  const isHebrew = language === 'he'

  if (!forecast || !signal) {
    return null
  }

  const checklist = buildTradeChecklist({ ohlcv, indicators, signal, forecast, earnings, language })

  if (!checklist) return null

  const recCopy = RECOMMENDATION_COPY[checklist.recommendation]
  const recText = recCopy[isHebrew ? 'he' : 'en']
  const toneClass = TRADER_TEXT[recCopy.tone] ?? TRADER_TEXT.neutral

  return (
    <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {isHebrew ? 'צ׳קליסט לפני כניסה' : 'Pre-Trade Checklist'}
          </div>
          <div className={`mt-1 text-base font-black ${toneClass}`}>{recText.label}</div>
          <div className="mt-0.5 text-xs text-slate-500">{recText.detail}</div>
        </div>

        {checklist.score != null && (
          <div className="shrink-0 rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2 text-center">
            <div className="text-[11px] text-slate-500">{isHebrew ? 'ציון' : 'Score'}</div>
            <div className={`text-lg font-black ${toneClass}`}>{checklist.score}/{checklist.total}</div>
          </div>
        )}
      </div>

      {checklist.items.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {checklist.items.map(item => (
            <ChecklistRow key={item.key} item={item} isHebrew={isHebrew} />
          ))}
        </div>
      )}

      {checklist.recommendation === 'no-bias' && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          <HelpCircle size={14} className="shrink-0" />
          {isHebrew
            ? 'חכה לתחזית עם הטיה ברורה (בוליש/בריש) לפני שהצ׳קליסט יכול לתת ציון.'
            : 'Wait for a clearly biased forecast (bullish/bearish) before the checklist can score.'}
        </div>
      )}
    </div>
  )
}
