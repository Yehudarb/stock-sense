import { fmtPrice } from '../../lib/formatters'

export default function TaxShieldMeter({ taxShield, language = 'he' }) {
  const isHebrew = language === 'he'
  if (!taxShield) return null

  const label = isHebrew ? 'מגן מס נותר' : 'Tax shield remaining'
  const usedPct = taxShield.total > 0 ? Math.min(100, (taxShield.used / taxShield.total) * 100) : 0

  return (
    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 px-4 py-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>{label}</span>
        <span className="text-sm font-black text-blue-300">{fmtPrice(taxShield.remaining)}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800/60">
        <div className="h-full rounded-full bg-blue-400/70" style={{ width: `${100 - usedPct}%` }} />
      </div>
    </div>
  )
}
