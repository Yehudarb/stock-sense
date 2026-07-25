import { useState } from 'react'
import { fmtPrice } from '../../lib/formatters'

/**
 * Screen 2 - answers "How exactly do I enter?"
 * All numbers come straight from the existing decision/risk engine
 * (lib/analystDecision.js, lib/riskManagement.js) - only re-labeled.
 */
export default function TradeSetupScreen({
  decision,
  account,
  language = 'he',
  onEnterTrade,
  onBack,
}) {
  const isHebrew = language === 'he'
  const [isSubmitting, setIsSubmitting] = useState(false)

  const entry = decision?.entryHigh ?? decision?.currentPrice
  const stopLoss = decision?.stopLoss
  const takeProfit = decision?.takeProfit
  const trailingStop = decision?.trailingStop
  const riskReward = decision?.riskReward

  const riskPerTradePct = account?.riskSettings?.riskPerTradePct ?? 1
  const equity = account?.equity ?? 0
  const riskPerShare = entry != null && stopLoss != null ? entry - stopLoss : null
  const riskAmount = equity * (riskPerTradePct / 100)
  const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0
  const dollarAtRisk = shares * (riskPerShare ?? 0)
  const dollarToGain = takeProfit != null && entry != null ? shares * (takeProfit - entry) : null

  const copy = {
    title: isHebrew ? 'הגדרת עסקה' : 'Trade setup',
    entry: isHebrew ? 'מחיר כניסה' : 'Entry price',
    stop: isHebrew ? 'סטופ לוס' : 'Stop loss',
    atRisk: isHebrew ? 'סכום בסיכון' : 'Amount at risk',
    target: isHebrew ? 'יעד' : 'Target',
    toGain: isHebrew ? 'סכום פוטנציאלי' : 'Amount to gain',
    rr: isHebrew ? 'יחס סיכון/סיכוי' : 'Risk/Reward',
    shares: isHebrew ? 'כמות מניות לקנייה' : 'Shares to buy',
    trailingTitle: isHebrew ? 'כללי סטופ נגרר' : 'Trailing stop rules',
    trailing1: isHebrew
      ? `להזיז סטופ לנקודת איזון ב-${fmtPrice(trailingStop)}`
      : `Move stop to break-even at ${fmtPrice(trailingStop)}`,
    trailing2: isHebrew ? 'הסטופ לעולם לא זז אחורה' : 'Stops never move backward',
    trailing3: isHebrew ? 'מכירה חלקית ביעד ראשון, יתרה ביעד סופי' : 'Sell partial at first target, rest at final target',
    enter: isHebrew ? 'כניסה לעסקה' : 'ENTER TRADE',
    back: isHebrew ? 'חזרה' : 'Back',
  }

  async function handleEnter() {
    setIsSubmitting(true)
    try {
      await onEnterTrade({
        ticker: 'TSLL',
        side: 'long',
        orderType: 'market',
        quantity: shares,
        stopLoss,
        takeProfit,
      })
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
        <Metric label={copy.entry} value={fmtPrice(entry)} tone="text-blue-300" />
        <Metric label={copy.rr} value={riskReward != null ? `1:${riskReward.toFixed(1)}` : '—'} tone="text-green-300" />
        <Metric label={copy.stop} value={fmtPrice(stopLoss)} tone="text-red-300" />
        <Metric label={copy.atRisk} value={fmtPrice(dollarAtRisk)} tone="text-red-300" />
        <Metric label={copy.target} value={fmtPrice(takeProfit)} tone="text-green-300" />
        <Metric label={copy.toGain} value={dollarToGain != null ? fmtPrice(dollarToGain) : '—'} tone="text-green-300" />
      </div>

      <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
        <div className="text-xs font-semibold text-slate-500">{copy.shares}</div>
        <div className="mt-1 text-2xl font-black text-white">{shares.toLocaleString()}</div>
      </div>

      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-300">{copy.trailingTitle}</div>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
          <li>{copy.trailing1}</li>
          <li>{copy.trailing2}</li>
          <li>{copy.trailing3}</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={handleEnter}
        disabled={isSubmitting || !shares}
        className="w-full rounded-2xl bg-green-500 py-5 text-xl font-black text-slate-950 shadow-lg shadow-green-500/20 transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {copy.enter}
      </button>
    </div>
  )
}

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-black ${tone}`}>{value}</div>
    </div>
  )
}
