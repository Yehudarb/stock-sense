import { fmtPrice } from '../../lib/formatters'

function formatDate(dateIso) {
  if (!dateIso) return '-'
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatEps(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return `$${Number(value).toFixed(2)}`
}

function resultCopy(result) {
  return {
    beat: { label: 'הכה את התחזית', color: 'text-green-300', bg: 'bg-green-950/40 border-green-800' },
    miss: { label: 'פספס את התחזית', color: 'text-red-300', bg: 'bg-red-950/40 border-red-800' },
    inline: { label: 'בהתאם לצפי', color: 'text-yellow-300', bg: 'bg-yellow-950/40 border-yellow-800' },
    unknown: { label: 'לא ידוע', color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' },
  }[result] ?? { label: 'לא ידוע', color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' }
}

function Metric({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="rounded-lg bg-slate-900 p-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

export default function EarningsPanel({ earnings, isLoading }) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-slate-800 p-4 text-center text-sm text-slate-500" dir="rtl">
        טוען נתוני דוחות...
      </div>
    )
  }

  if (!earnings) return null

  const next = earnings.nextReport
  const last = earnings.lastReport
  const result = resultCopy(last?.result)
  const hasNextDate = Boolean(next?.date)
  const daysText = next?.daysUntil == null
    ? null
    : next.daysUntil >= 0 ? `בעוד ${next.daysUntil} ימים` : `לפני ${Math.abs(next.daysUntil)} ימים`

  return (
    <div className="rounded-xl bg-slate-800 p-4" dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-400">דוחות כספיים</h4>
          <div className="mt-1 text-sm font-bold text-white">{earnings.ticker}</div>
        </div>
        <span className="rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-400">{earnings.source}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="דוח הבא"
          value={hasNextDate ? formatDate(next.date) : 'אין תאריך רשמי'}
          color={next?.isEstimated ? 'text-yellow-300' : 'text-blue-300'}
          sub={next?.isEstimated ? `משוער${daysText ? ` · ${daysText}` : ''}` : daysText}
        />
        <Metric
          label="רבעון הבא"
          value={next?.fiscalQuarter ?? '-'}
          sub={next?.estimates ? `${next.estimates} אנליסטים` : null}
        />
        <Metric
          label="צפי EPS"
          value={formatEps(next?.consensusEPS)}
          color="text-cyan-300"
          sub={next?.lowEPS != null && next?.highEPS != null ? `טווח ${formatEps(next.lowEPS)}-${formatEps(next.highEPS)}` : null}
        />
        <Metric
          label="שינויי תחזית"
          value={`${next?.revisionsUp ?? 0}↑ / ${next?.revisionsDown ?? 0}↓`}
          color={(next?.revisionsUp ?? 0) >= (next?.revisionsDown ?? 0) ? 'text-green-300' : 'text-red-300'}
          sub="4 שבועות אחרונים"
        />
      </div>

      {last && (
        <div className={`mt-3 rounded-lg border p-3 ${result.bg}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400">דוח אחרון: {last.fiscalQuarter ?? '-'}</div>
            <div className={`text-xs font-bold ${result.color}`}>{result.label}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Metric label="תאריך" value={formatDate(last.date)} />
            <Metric label="EPS בפועל" value={formatEps(last.epsActual)} color={result.color} />
            <Metric
              label="מול צפי"
              value={last.surprisePct != null ? `${last.surprisePct > 0 ? '+' : ''}${last.surprisePct}%` : '-'}
              color={result.color}
              sub={last.epsEstimate != null ? `צפי ${fmtPrice(last.epsEstimate)}` : null}
            />
          </div>
        </div>
      )}

      {next?.sourceMessage && !hasNextDate && (
        <div className="mt-3 rounded-lg bg-slate-900 p-2 text-xs leading-relaxed text-slate-500">
          {next.sourceMessage}
        </div>
      )}
    </div>
  )
}
