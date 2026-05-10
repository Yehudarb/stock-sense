import { fmtPrice } from '../../lib/formatters'

function formatDate(dateIso, locale) {
  if (!dateIso) return '-'
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatEps(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return `$${Number(value).toFixed(2)}`
}

function resultCopy(result, language) {
  return ({
    he: {
      beat: { label: 'הכה את התחזית', color: 'text-green-300', bg: 'bg-green-950/40 border-green-800' },
      miss: { label: 'פספס את התחזית', color: 'text-red-300', bg: 'bg-red-950/40 border-red-800' },
      inline: { label: 'בהתאם לצפי', color: 'text-yellow-300', bg: 'bg-yellow-950/40 border-yellow-800' },
      unknown: { label: 'לא ידוע', color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' },
    },
    en: {
      beat: { label: 'Beat estimates', color: 'text-green-300', bg: 'bg-green-950/40 border-green-800' },
      miss: { label: 'Missed estimates', color: 'text-red-300', bg: 'bg-red-950/40 border-red-800' },
      inline: { label: 'In line', color: 'text-yellow-300', bg: 'bg-yellow-950/40 border-yellow-800' },
      unknown: { label: 'Unknown', color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' },
    },
  }[language] ?? {
    beat: { label: 'הכה את התחזית', color: 'text-green-300', bg: 'bg-green-950/40 border-green-800' },
    miss: { label: 'פספס את התחזית', color: 'text-red-300', bg: 'bg-red-950/40 border-red-800' },
    inline: { label: 'בהתאם לצפי', color: 'text-yellow-300', bg: 'bg-yellow-950/40 border-yellow-800' },
    unknown: { label: 'לא ידוע', color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' },
  })[result] ?? { label: language === 'he' ? 'לא ידוע' : 'Unknown', color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' }
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

export default function EarningsPanel({ earnings, isLoading, language = 'he' }) {
  const isHebrew = language === 'he'
  const locale = isHebrew ? 'he-IL' : 'en-US'
  const copy = {
    loading: isHebrew ? 'טוען נתוני דוחות...' : 'Loading earnings data...',
    title: isHebrew ? 'דוחות כספיים' : 'Earnings',
    nextReport: isHebrew ? 'דוח הבא' : 'Next report',
    noOfficialDate: isHebrew ? 'אין תאריך רשמי' : 'No official date',
    estimated: isHebrew ? 'משוער' : 'Estimated',
    nextQuarter: isHebrew ? 'רבעון הבא' : 'Next quarter',
    analysts: isHebrew ? 'אנליסטים' : 'analysts',
    epsEstimate: isHebrew ? 'צפי EPS' : 'EPS estimate',
    estimateRange: isHebrew ? 'טווח' : 'Range',
    revisions: isHebrew ? 'שינויי תחזית' : 'Estimate revisions',
    last4Weeks: isHebrew ? '4 שבועות אחרונים' : 'Last 4 weeks',
    lastReport: isHebrew ? 'דוח אחרון' : 'Last report',
    date: isHebrew ? 'תאריך' : 'Date',
    actualEps: isHebrew ? 'EPS בפועל' : 'Actual EPS',
    vsEstimate: isHebrew ? 'מול צפי' : 'Vs estimate',
    estimate: isHebrew ? 'צפי' : 'Estimate',
    inDays: isHebrew ? 'בעוד' : 'in',
    days: isHebrew ? 'ימים' : 'days',
    ago: isHebrew ? 'לפני' : '',
  }
  if (isLoading) {
    return (
      <div className="rounded-xl bg-slate-800 p-4 text-center text-sm text-slate-500" dir={isHebrew ? 'rtl' : 'ltr'}>
        {copy.loading}
      </div>
    )
  }

  if (!earnings) return null

  const next = earnings.nextReport
  const last = earnings.lastReport
  const result = resultCopy(last?.result, language)
  const hasNextDate = Boolean(next?.date)
  const daysText = next?.daysUntil == null
    ? null
    : next.daysUntil >= 0
      ? (isHebrew ? `בעוד ${next.daysUntil} ימים` : `in ${next.daysUntil} days`)
      : (isHebrew ? `לפני ${Math.abs(next.daysUntil)} ימים` : `${Math.abs(next.daysUntil)} days ago`)

  return (
    <div className="rounded-xl bg-slate-800 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-400">{copy.title}</h4>
          <div className="mt-1 text-sm font-bold text-white">{earnings.ticker}</div>
        </div>
        <span className="rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-400">{earnings.source}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label={copy.nextReport}
          value={hasNextDate ? formatDate(next.date, locale) : copy.noOfficialDate}
          color={next?.isEstimated ? 'text-yellow-300' : 'text-blue-300'}
          sub={next?.isEstimated ? `${copy.estimated}${daysText ? ` · ${daysText}` : ''}` : daysText}
        />
        <Metric
          label={copy.nextQuarter}
          value={next?.fiscalQuarter ?? '-'}
          sub={next?.estimates ? `${next.estimates} ${copy.analysts}` : null}
        />
        <Metric
          label={copy.epsEstimate}
          value={formatEps(next?.consensusEPS)}
          color="text-cyan-300"
          sub={next?.lowEPS != null && next?.highEPS != null ? `${copy.estimateRange} ${formatEps(next.lowEPS)}-${formatEps(next.highEPS)}` : null}
        />
        <Metric
          label={copy.revisions}
          value={`${next?.revisionsUp ?? 0}↑ / ${next?.revisionsDown ?? 0}↓`}
          color={(next?.revisionsUp ?? 0) >= (next?.revisionsDown ?? 0) ? 'text-green-300' : 'text-red-300'}
          sub={copy.last4Weeks}
        />
      </div>

      {last && (
        <div className={`mt-3 rounded-lg border p-3 ${result.bg}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400">{copy.lastReport}: {last.fiscalQuarter ?? '-'}</div>
            <div className={`text-xs font-bold ${result.color}`}>{result.label}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Metric label={copy.date} value={formatDate(last.date, locale)} />
            <Metric label={copy.actualEps} value={formatEps(last.epsActual)} color={result.color} />
            <Metric
              label={copy.vsEstimate}
              value={last.surprisePct != null ? `${last.surprisePct > 0 ? '+' : ''}${last.surprisePct}%` : '-'}
              color={result.color}
              sub={last.epsEstimate != null ? `${copy.estimate} ${fmtPrice(last.epsEstimate)}` : null}
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
