import { useEffect, useState } from 'react'

/**
 * Lets the trader set the risk-per-trade % right on the dashboard, instead
 * of only in Advanced mode's Paper Trading settings. Saves via the same
 * /api/paper-trading/settings endpoint (usePaperTrading().updateSettings)
 * that already validates and persists riskSettings.riskPerTradePct - this
 * value already drives share-count sizing on the Trade Setup screen.
 */
export default function RiskPercentControl({ riskPct, onSave, isSaving, language = 'he' }) {
  const isHebrew = language === 'he'
  const [value, setValue] = useState(riskPct ?? 1)

  useEffect(() => {
    setValue(riskPct ?? 1)
  }, [riskPct])

  const numericValue = Number(value)
  const dirty = Number.isFinite(numericValue) && numericValue > 0 && numericValue !== Number(riskPct)

  const copy = {
    title: isHebrew ? 'סיכון לעסקה' : 'Risk per trade',
    subtitle: isHebrew ? 'אחוז מהחשבון שמסתכן בכל כניסה' : '% of account risked per entry',
    save: isHebrew ? 'שמור' : 'Save',
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/40 p-4">
      <div>
        <div className="text-xs font-semibold text-slate-300">{copy.title}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">{copy.subtitle}</div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          value={value}
          onChange={event => setValue(event.target.value)}
          className="w-16 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-center text-sm font-bold text-white focus:border-primary/50 focus:outline-none"
        />
        <span className="text-sm text-slate-400">%</span>
        {dirty && (
          <button
            type="button"
            onClick={() => onSave(numericValue)}
            disabled={isSaving}
            className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {isSaving ? '…' : copy.save}
          </button>
        )}
      </div>
    </div>
  )
}
