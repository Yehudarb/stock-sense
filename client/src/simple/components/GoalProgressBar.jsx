import { fmtPrice } from '../../lib/formatters'

export default function GoalProgressBar({ equity, goal, language = 'he' }) {
  const isHebrew = language === 'he'
  if (!goal) return null

  const progressPct = Math.max(0, Math.min(100, goal.progressPct ?? 0))
  const label = isHebrew ? 'התקדמות ליעד' : 'Progress to goal'

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>{label}</span>
        <span>{fmtPrice(equity)} / {fmtPrice(goal.target)}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs font-bold text-emerald-300">{progressPct.toFixed(0)}%</div>
    </div>
  )
}
