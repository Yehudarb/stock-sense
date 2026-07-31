import { useMemo } from 'react'

import { maTrendStructure, structureReading } from '../../lib/maStructure'

const STATE_STYLE = {
  aligned:   { border: 'border-emerald-400/30', bg: 'bg-emerald-500/5',  dot: 'bg-emerald-400', text: 'text-emerald-300' },
  repairing: { border: 'border-amber-400/30',   bg: 'bg-amber-400/5',    dot: 'bg-amber-400',   text: 'text-amber-300' },
  broken:    { border: 'border-rose-400/30',    bg: 'bg-rose-500/5',     dot: 'bg-rose-400',    text: 'text-rose-300' },
}

const STATE_LABEL = {
  aligned:   { he: 'מבנה מלא',  en: 'Aligned' },
  repairing: { he: 'מבנה חלקי', en: 'Repairing' },
  broken:    { he: 'מבנה שבור', en: 'Broken' },
}

function fmt(v, digits = 2) {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits)
}

export default function MaStructurePanel({ indicators, price, language = 'he' }) {
  const he = language === 'he'
  const structure = useMemo(() => maTrendStructure(indicators, price), [indicators, price])

  if (!structure) {
    return (
      <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
        {structureReading(null, language)}
      </div>
    )
  }

  const style = STATE_STYLE[structure.state]
  const label = STATE_LABEL[structure.state][he ? 'he' : 'en']

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className={`text-sm font-semibold ${style.text}`}>{label}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {structure.passed}/{structure.total} {he ? 'תנאים' : 'checks'}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {structureReading(structure, language)}
      </p>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {structure.checks.map(check => (
          <li key={check.key} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="w-4 text-center">
              {check.pass === null ? '·' : check.pass ? '✓' : '✕'}
            </span>
            <span className={
              check.pass === null ? 'text-slate-600'
                : check.pass ? 'text-slate-300' : 'text-slate-500 line-through'
            }>
              {he ? check.label : check.labelEn}
            </span>
          </li>
        ))}
      </ul>

      {structure.stack && (
        <div className="mt-3 rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-2 text-xs">
            <span className="text-slate-500">{he ? 'סולם ממוצעים' : 'MA ladder'}</span>
            <span className="tabular-nums text-slate-300">
              {['sma20', 'sma50', 'sma100', 'sma150', 'sma200']
                .filter(k => structure.stack.values[k] != null)
                .map(k => fmt(structure.stack.values[k], 0))
                .join(' › ')}
            </span>
            <span className="text-slate-500">
              {structure.stack.order === 'bullish' ? (he ? 'יורד מונוטונית' : 'monotonic down')
                : structure.stack.order === 'bearish' ? (he ? 'עולה מונוטונית' : 'monotonic up')
                : (he ? 'לא מונוטוני' : 'not monotonic')}
            </span>
          </div>
          {structure.stack.breaks.length > 0 && (
            <div className="mt-1 text-[11px] text-amber-300/80">
              {he ? 'שבירה ב־' : 'break at '}
              {structure.stack.breaks.map(b => `${b.faster.replace('sma', '')}/${b.slower.replace('sma', '')}`).join(', ')}
            </div>
          )}
          {/* Stated because the ladder looks more authoritative than it is. It
              was added expecting to beat the five conditions and measurement
              said otherwise; presenting it without that would be misleading. */}
          <div className="mt-1 text-[11px] leading-relaxed text-slate-600">
            {he
              ? 'תיאורי בלבד. נמדד על 25 מניות: סולם בולישי הניב 0.20 נקודות אחוז פחות מדובי (t=-0.11) — אין לו ערך מנבא במדגם הזה.'
              : 'Descriptive only. Measured over 25 symbols, a bullish ladder returned 0.20 points less than a bearish one (t=-0.11) — no predictive value in this sample.'}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div><span className="text-slate-500">SMA150 </span><span className="tabular-nums text-slate-300">{fmt(structure.values.sma150)}</span></div>
        <div><span className="text-slate-500">SMA200 </span><span className="tabular-nums text-slate-300">{fmt(structure.values.sma200)}</span></div>
        <div><span className="text-slate-500">{he ? 'מרחק מ-150 ' : 'vs 150 '}</span><span className="tabular-nums text-slate-300">{fmt(structure.distances.to150Pct, 1)}%</span></div>
        <div><span className="text-slate-500">{he ? 'שיפוע 200 ' : '200 slope '}</span><span className="tabular-nums text-slate-300">{fmt(structure.slope200Pct, 1)}%</span></div>
      </div>

      {/* The measurement travels with the conclusion. This filter was run
          through the walk-forward tool on 25 symbols and it orders correctly
          but does not clear significance — stating that next to the verdict is
          the difference between a reading and a claim. */}
      <p className="mt-3 border-t border-white/8 pt-2 text-[11px] leading-relaxed text-slate-500">
        {he
          ? 'נמדד על 25 מניות, 425 דגימות: מבנה מלא הניב +2.69% ל-10 נרות מול +0.67% במבנה שבור — הפרש של 2.02 נקודות אחוז בכיוון הצפוי, אך Welch t=1.52, כלומר לא מובהק. זהו מסנן השתתפות מתואר ולא תחזית.'
          : 'Measured over 25 symbols, 425 samples: aligned returned +2.69% over 10 bars against +0.67% when broken — 2.02 points in the expected direction, but Welch t=1.52, so not significant. A described participation filter, not a forecast.'}
      </p>
    </div>
  )
}
