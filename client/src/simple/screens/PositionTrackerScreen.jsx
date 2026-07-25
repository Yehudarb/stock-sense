import { useState } from 'react'
import { fmtPrice, fmtPercent } from '../../lib/formatters'
import PriceLadder from '../components/PriceLadder'

function resolveAction({ position, decision, isHebrew }) {
  const entry = position.entryPrice
  const current = position.currentPrice
  const stopLoss = position.stopLoss
  const takeProfit = position.takeProfit
  if (current == null) return isHebrew ? 'החזקה' : 'HOLD'

  if (stopLoss != null && current <= stopLoss) {
    return isHebrew ? 'הסטופ הופעל' : 'STOP LOSS HIT'
  }
  if (takeProfit != null && current >= takeProfit) {
    return isHebrew ? 'מכירה מלאה - היעד הושג' : 'SELL ALL - TARGET REACHED'
  }
  if (takeProfit != null) {
    const halfTarget = entry + (takeProfit - entry) / 2
    if (current >= halfTarget) return isHebrew ? 'מכירת מחצית' : 'SELL HALF'
  }

  const breakEvenTrigger = decision?.stopContext?.breakEvenTrigger
  if (breakEvenTrigger != null && current >= breakEvenTrigger && stopLoss < entry) {
    return isHebrew ? 'הזזת סטופ לנקודת איזון' : 'MOVE STOP TO BREAK-EVEN'
  }

  return isHebrew ? 'החזקה' : 'HOLD'
}

const ACTION_TONE = {
  'STOP LOSS HIT': 'bg-red-500/15 border-red-400/40 text-red-300',
  'הסטופ הופעל': 'bg-red-500/15 border-red-400/40 text-red-300',
  'SELL ALL - TARGET REACHED': 'bg-green-500/15 border-green-400/40 text-green-300',
  'מכירה מלאה - היעד הושג': 'bg-green-500/15 border-green-400/40 text-green-300',
  'SELL HALF': 'bg-blue-500/15 border-blue-400/40 text-blue-300',
  'מכירת מחצית': 'bg-blue-500/15 border-blue-400/40 text-blue-300',
  'MOVE STOP TO BREAK-EVEN': 'bg-blue-500/15 border-blue-400/40 text-blue-300',
  'הזזת סטופ לנקודת איזון': 'bg-blue-500/15 border-blue-400/40 text-blue-300',
  HOLD: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
  'החזקה': 'bg-amber-500/15 border-amber-400/40 text-amber-300',
}

export default function PositionTrackerScreen({
  position,
  decision,
  closedTrades = [],
  language = 'he',
  onClosePosition,
  onBack,
}) {
  const isHebrew = language === 'he'
  const [isSubmitting, setIsSubmitting] = useState(false)

  const entry = position.entryPrice
  const current = position.currentPrice
  const pnl = position.unrealizedPnl
  const pnlPct = position.unrealizedPct
  const pnlColor = (pnl ?? 0) >= 0 ? 'text-green-300' : 'text-red-300'

  const action = resolveAction({ position, decision, isHebrew })
  const actionStyle = ACTION_TONE[action] ?? ACTION_TONE.HOLD

  const halfTarget = position.takeProfit != null ? entry + (position.takeProfit - entry) / 2 : null
  const rungs = [
    { key: 'stop', label: isHebrew ? 'סטופ' : 'Stop', price: position.stopLoss, tone: 'bearish' },
    { key: 'entry', label: isHebrew ? 'כניסה' : 'Entry', price: entry, tone: 'neutral' },
    { key: 'trailing', label: isHebrew ? 'נגרר' : 'Trailing', price: decision?.stopContext?.breakEvenTrigger ?? null, tone: 'neutral' },
    { key: 'half', label: isHebrew ? 'חצי יעד' : 'Half target', price: halfTarget, tone: 'bullish' },
    { key: 'full', label: isHebrew ? 'יעד מלא' : 'Full target', price: position.takeProfit, tone: 'bullish' },
  ]

  const copy = {
    title: isHebrew ? 'מעקב פוזיציה' : 'Position tracker',
    entry: isHebrew ? 'כניסה' : 'Entry',
    current: isHebrew ? 'נוכחי' : 'Current',
    pnl: isHebrew ? 'רווח/הפסד' : 'P&L',
    close: isHebrew ? 'סגירת עסקה' : 'CLOSE TRADE',
    history: isHebrew ? 'היסטוריית עסקאות' : 'Trade history',
    back: isHebrew ? 'חזרה' : 'Back',
    noHistory: isHebrew ? 'אין עדיין עסקאות סגורות' : 'No closed trades yet',
  }

  async function handleClose() {
    setIsSubmitting(true)
    try {
      await onClosePosition(position.id, current)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6" dir={isHebrew ? 'rtl' : 'ltr'}>
      <button type="button" onClick={onBack} className="self-start text-sm font-semibold text-slate-400">
        ← {copy.back}
      </button>

      <h1 className="text-center text-2xl font-black text-white">{copy.title}</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
          <div className="text-xs font-semibold text-slate-500">{copy.entry}</div>
          <div className="mt-1 text-lg font-black text-white">{fmtPrice(entry)}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
          <div className="text-xs font-semibold text-slate-500">{copy.current}</div>
          <div className="mt-1 text-lg font-black text-white">{fmtPrice(current)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
        <div className="text-xs font-semibold text-slate-500">{copy.pnl}</div>
        <div className={`mt-1 text-3xl font-black ${pnlColor}`}>
          {(pnl ?? 0) >= 0 ? '+' : ''}{fmtPrice(pnl)} ({fmtPercent(pnlPct)})
        </div>
      </div>

      <div className={`rounded-2xl border-2 px-6 py-5 text-center text-xl font-black ${actionStyle}`}>
        {action}
      </div>

      <PriceLadder rungs={rungs} currentPrice={current} />

      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="w-full rounded-2xl bg-red-500 py-5 text-xl font-black text-white shadow-lg shadow-red-500/20 transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {copy.close}
      </button>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{copy.history}</div>
        {!closedTrades.length && (
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-3 text-center text-sm text-slate-500">
            {copy.noHistory}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {closedTrades.slice(0, 8).map(trade => (
            <div key={trade.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-slate-950/30 px-3 py-2 text-sm">
              <span className="text-slate-400">{new Date(trade.closedAt).toLocaleDateString()}</span>
              <span className="text-slate-300">{fmtPrice(trade.entryPrice)} → {fmtPrice(trade.exitPrice)}</span>
              <span className={(trade.realizedPnl ?? 0) >= 0 ? 'font-bold text-green-300' : 'font-bold text-red-300'}>
                {(trade.realizedPnl ?? 0) >= 0 ? '+' : ''}{fmtPrice(trade.realizedPnl)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
