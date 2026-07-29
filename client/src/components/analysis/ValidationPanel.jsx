import { useState } from 'react'

import useWalkForward from '../../hooks/useWalkForward'
import { DEFAULT_HORIZON, DEFAULT_WARMUP } from '../../lib/walkForward'

const HORIZONS = [5, 10, 20]

function pct(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function Stat({ label, value, tone = 'default' }) {
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-200'
  return (
    <div className="rounded-xl border border-white/8 bg-slate-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}

function ResultTable({ result, isHebrew }) {
  const rows = Object.entries(result.byAction).sort((a, b) => b[1].n - a[1].n)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <th className="px-2 py-2 text-start">{isHebrew ? 'פעולה' : 'Action'}</th>
            <th className="px-2 py-2 text-end">n</th>
            <th className="px-2 py-2 text-end">{isHebrew ? 'תשואה' : 'Mean'}</th>
            <th className="px-2 py-2 text-end">{isHebrew ? 'הצלחה' : 'Win'}</th>
            <th className="px-2 py-2 text-end">{isHebrew ? 'יתרון' : 'Edge'}</th>
            <th className="px-2 py-2 text-end">t</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map(([action, s]) => (
            <tr key={action} className="border-t border-white/6">
              <td className="px-2 py-2 font-semibold text-slate-200">
                {action}
                {/* Significance is a property of the measurement, not a badge of
                    quality — it only says the difference is unlikely to be noise
                    in THIS sample. */}
                {s.significant && (
                  <span className="ms-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    |t| ≥ 2
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-end text-slate-400">{s.n}</td>
              <td className="px-2 py-2 text-end text-slate-200">{pct(s.mean)}</td>
              <td className="px-2 py-2 text-end text-slate-400">{s.winRate.toFixed(1)}%</td>
              <td className={`px-2 py-2 text-end font-semibold ${s.edge >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {pct(s.edge)}
              </td>
              <td className="px-2 py-2 text-end text-slate-400">{s.tStat.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ValidationPanel({ ohlcv, ticker, language = 'he' }) {
  const isHebrew = language === 'he'
  const { result, split, isRunning, error, run } = useWalkForward()
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON)
  const [overlapping, setOverlapping] = useState(false)

  const bars = ohlcv?.length ?? 0
  const minBars = DEFAULT_WARMUP + horizon + 1
  const canRun = bars >= minBars

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
        <div className="text-sm font-semibold text-slate-200">
          {isHebrew ? 'ולידציה של מנוע האותות' : 'Signal engine validation'}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {isHebrew
            ? 'מריץ את המנוע בר אחר בר על ההיסטוריה. בכל בר האות מחושב מנתונים שהיו זמינים עד אותו רגע בלבד, ואז נמדדת התשואה שהתממשה אחריו. זו מדידה של מה שקרה — לא תחזית.'
            : 'Replays the engine bar by bar. At each bar the signal is computed only from data available up to that point, then the realized forward return is measured. This records what happened; it does not predict.'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{isHebrew ? 'אופק:' : 'Horizon:'}</span>
          {HORIZONS.map(h => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                horizon === h
                  ? 'border-emerald-400 bg-emerald-500/90 text-white'
                  : 'border-slate-700 text-slate-400 hover:border-emerald-400/70 hover:text-white'
              }`}
            >
              {h} {isHebrew ? 'נרות' : 'bars'}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setOverlapping(v => !v)}
            title={isHebrew
              ? 'דגימה בכל בר מגדילה את המדגם אך ממחזרת את אותה תנועת מחיר, ולכן מנפחת את המובהקות'
              : 'Sampling every bar grows n but reuses the same price move, which inflates significance'}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
              overlapping
                ? 'border-amber-400 bg-amber-500/80 text-white'
                : 'border-slate-700 text-slate-400 hover:border-amber-400/70 hover:text-white'
            }`}
          >
            {isHebrew ? 'חלונות חופפים' : 'Overlapping'}
          </button>

          <button
            type="button"
            disabled={!canRun || isRunning}
            onClick={() => run(ohlcv, { horizon, overlapping })}
            className="ms-auto rounded-md border border-emerald-400 bg-emerald-500/90 px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-600"
          >
            {isRunning
              ? (isHebrew ? 'מריץ…' : 'Running…')
              : (isHebrew ? 'הרץ ולידציה' : 'Run validation')}
          </button>
        </div>

        {!canRun && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
            {isHebrew
              ? `צריך לפחות ${minBars} נרות כדי להריץ (יש ${bars}). ${DEFAULT_WARMUP} מהם נדרשים כחימום לאינדיקטורים ואינם נמדדים.`
              : `Needs at least ${minBars} bars (have ${bars}). ${DEFAULT_WARMUP} of them are indicator warmup and are not evaluated.`}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          {error.startsWith('NOT_ENOUGH_BARS')
            ? (isHebrew ? 'אין מספיק נרות להרצה.' : 'Not enough bars to run.')
            : error === 'NO_SAMPLES'
              ? (isHebrew ? 'לא נוצרה אף דגימה — נסה אופק קצר יותר.' : 'No samples produced — try a shorter horizon.')
              : error}
        </div>
      )}

      {result && (
        <>
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-slate-200">
                {ticker} · {isHebrew ? 'תוצאות' : 'Results'}
              </div>
              <div className="text-[11px] text-slate-500">
                {isHebrew
                  ? `${result.meta.evaluated} דגימות · אופק ${result.meta.horizon} · צעד ${result.meta.step}`
                  : `${result.meta.evaluated} samples · horizon ${result.meta.horizon} · step ${result.meta.step}`}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={isHebrew ? 'בסיס (כל בר)' : 'Baseline (every bar)'}
                value={pct(result.baseline.mean)}
              />
              <Stat label={isHebrew ? 'הצלחת בסיס' : 'Baseline win'} value={`${result.baseline.winRate.toFixed(1)}%`} />
              <Stat label={isHebrew ? 'תנודתיות' : 'Std dev'} value={result.baseline.sd.toFixed(2)} />
              <Stat label={isHebrew ? 'שגיאות' : 'Errors'} value={result.meta.errors} tone={result.meta.errors ? 'bad' : 'default'} />
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              {isHebrew
                ? '"יתרון" נמדד מול הבסיס — התשואה הממוצעת של החזקה בכל בר שנמדד — ולא מול אפס. להכות את האפס בשוק עולה אינו הישג.'
                : 'Edge is measured against the baseline — the average return of holding through every evaluated bar — not against zero. Beating zero in a rising market is not an achievement.'}
            </p>

            <div className="mt-3">
              <ResultTable result={result} isHebrew={isHebrew} />
            </div>
          </div>

          {split && (
            <div className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
              <div className="text-sm font-semibold text-slate-200">
                {isHebrew ? 'פיצול לשתי תקופות' : 'Split sample'}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {isHebrew
                  ? 'תוצאה שמופיעה רק באחת מהתקופות מותאמת לאותה תקופה, לא לשוק. השוו את שתי הטבלאות: מה ששורד בשתיהן ראוי לתשומת לב.'
                  : 'A result that appears in only one half is fitted to that half, not to the market. Compare the two: what survives in both is worth attention.'}
              </p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-400">
                    {isHebrew ? 'תקופה מוקדמת' : 'Earlier half'} · n={split.early.baseline.n} · {pct(split.early.baseline.mean)}
                  </div>
                  <ResultTable result={split.early} isHebrew={isHebrew} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-400">
                    {isHebrew ? 'תקופה מאוחרת' : 'Later half'} · n={split.late.baseline.n} · {pct(split.late.baseline.mean)}
                  </div>
                  <ResultTable result={split.late} isHebrew={isHebrew} />
                </div>
              </div>
            </div>
          )}

          {/* Stated with the results rather than tucked away, because the
              numbers above are easy to over-read. */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
            <div className="font-semibold">{isHebrew ? 'מה זה לא אומר' : 'What this does not say'}</div>
            <ul className="mt-1 list-disc space-y-1 ps-4">
              <li>
                {isHebrew
                  ? 'מניה אחת, תקופה אחת, משטר שוק אחד. תוצאה כאן אינה מתכללת לשוק.'
                  : 'One symbol, one period, one market regime. A result here does not generalize.'}
              </li>
              <li>
                {isHebrew
                  ? 'אין עלויות עסקה, עמלות או slippage — כולן היו מחמירות את התוצאה.'
                  : 'No commissions, spread or slippage — all of which would make the result worse.'}
              </li>
              <li>
                {isHebrew
                  ? '|t| ≥ 2 אומר שהפער כנראה אינו רעש במדגם הזה. הוא אינו אומר שהוא יחזור.'
                  : '|t| ≥ 2 means the difference is probably not noise in this sample. It does not mean it will repeat.'}
              </li>
              {result.meta.overlapping && (
                <li className="font-semibold">
                  {isHebrew
                    ? 'חלונות חופפים פעילים — אותה תנועת מחיר נספרת עד ' + result.meta.horizon + ' פעמים, וה-t מנופח משמעותית.'
                    : `Overlapping windows are on — the same price move is counted up to ${result.meta.horizon} times and t is badly inflated.`}
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
