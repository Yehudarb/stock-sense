import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ClipboardCopy, ShieldAlert, X } from 'lucide-react'
import { DATA_QUALITY, toMarkdown } from '../../lib/stockAnalysisPro'
import { TRADER_TEXT } from '../../lib/traderColors'

const QUALITY_TONE = {
  [DATA_QUALITY.VERIFIED]: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  [DATA_QUALITY.ACCEPTABLE]: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
  [DATA_QUALITY.DEGRADED]: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
  [DATA_QUALITY.UNAVAILABLE]: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
}

const STANCE_TONE = {
  bullish: TRADER_TEXT.bullish,
  cautiously_bullish: TRADER_TEXT.bullish,
  neutral: TRADER_TEXT.neutral,
  cautiously_bearish: TRADER_TEXT.bearish,
  bearish: TRADER_TEXT.bearish,
}

const SEVERITY_TONE = {
  high: 'border-rose-400/20 bg-rose-400/8 text-rose-100',
  medium: 'border-amber-300/20 bg-amber-300/8 text-amber-100',
  low: 'border-white/10 bg-white/5 text-slate-200',
}

function Section({ title, badge, children }) {
  return (
    <section className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-100" dir="ltr">{value ?? '-'}</span>
    </div>
  )
}

const money = value => (value == null ? '-' : `$${value}`)

/**
 * Renders the Stock Analysis Pro report. The panel deliberately shows the
 * data-quality label, the "no valid setup" outcome, and the unavailable
 * sections as first-class content — hiding them would defeat the point of the
 * analysis method it implements.
 */
export default function StockAnalysisProPanel({ report, isLoading = false, language = 'he' }) {
  const isHebrew = language !== 'en'
  const t = (he, en) => (isHebrew ? he : en)
  const [copied, setCopied] = useState(false)
  const markdown = useMemo(() => toMarkdown(report), [report])

  if (isLoading && !report) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6 text-sm text-slate-400">
        {t('בונה דוח ניתוח מקצועי...', 'Building the professional analysis report...')}
      </div>
    )
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6 text-sm text-slate-400">
        {t('אין מספיק נתונים להפקת דוח.', 'Not enough data to produce a report.')}
      </div>
    )
  }

  async function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const quality = report.dataQuality
  const qualityBadge = (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${QUALITY_TONE[quality.level]}`}>
      {quality.level}
    </span>
  )

  if (report.unavailable) {
    return (
      <div className="space-y-3 rounded-2xl border border-rose-400/20 bg-rose-950/20 p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-rose-100">
          <ShieldAlert size={16} />
          {t('נתונים אינם זמינים — לא הופק ניתוח', 'Data unavailable — no analysis produced')}
        </div>
        <ul className="space-y-1 text-xs text-rose-200/90">
          {quality.reasons.map(reason => <li key={reason}>• {reason}</li>)}
        </ul>
      </div>
    )
  }

  const { instrument, technicals, conclusion, tradePlan, confidence } = report

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
              {t('ניתוח מקצועי — מסקנה', 'Professional analysis — conclusion')}
            </div>
            <div className={`mt-1 text-2xl font-black ${STANCE_TONE[conclusion.stance] ?? 'text-slate-200'}`}>
              {conclusion.stanceLabel}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {report.ticker}{instrument.name ? ` · ${instrument.name}` : ''} · {report.interval.toUpperCase()} · {confidence.label}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {qualityBadge}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:bg-white/5"
            >
              {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
              {copied ? t('הועתק', 'Copied') : t('העתק דוח', 'Copy report')}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300/80">{t('תומך בתזה', 'Supports')}</div>
            <ul className="space-y-1 text-xs text-slate-300">
              {conclusion.supporting.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-rose-300/80">{t('מחליש את התזה', 'Weakens')}</div>
            <ul className="space-y-1 text-xs text-slate-300">
              {conclusion.opposing.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <Section title={t('שער איכות נתונים', 'Data-quality gate')} badge={qualityBadge}>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
          <Row label={t('מצב מסחר', 'Session')} value={quality.session?.label} />
          <Row label={t('גיל הנתון', 'Data age')} value={quality.ageMinutes != null ? `${quality.ageMinutes} min` : '-'} />
          <Row label={t('נרות', 'Bars')} value={quality.barCount} />
          <Row label={t('פונדמנטלס', 'Fundamentals')} value={quality.fundamentals} />
        </div>
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {quality.reasons.map(reason => <li key={reason}>• {reason}</li>)}
        </ul>
      </Section>

      {instrument.isLeveraged && (
        <Section
          title={t('מכשיר ממונף — אזהרה מבנית', 'Leveraged instrument — structural warning')}
          badge={<span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-100">
            {instrument.leverage ? `${instrument.leverage}x` : t('מינוף לא מאומת', 'Leverage unverified')}
          </span>}
        >
          <ul className="space-y-1 text-xs text-slate-300">
            {(report.fundamentals.structuralRisks ?? []).map(item => <li key={item}>• {item}</li>)}
          </ul>
          <p className="mt-2 text-xs text-amber-200/80">{report.fundamentals.note}</p>
        </Section>
      )}

      <Section title={t('תמונה טכנית', 'Technical picture')}>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
          <Row label={t('מחיר', 'Price')} value={money(technicals.price)} />
          <Row label={t('מבנה', 'Structure')} value={technicals.structure?.trend ?? '-'} />
          <Row label={t('משטר', 'Regime')} value={technicals.regime ?? '-'} />
          <Row label="RSI" value={technicals.rsi} />
          <Row label="ATR" value={technicals.atr != null ? `${technicals.atr} (${technicals.atrPct}%)` : '-'} />
          <Row label={t('נפח יחסי', 'Rel. volume')} value={technicals.volumeRatio != null ? `${technicals.volumeRatio}x` : '-'} />
          <Row label="Bollinger %B" value={technicals.bollinger.percentB} />
          <Row label={t('רצועות', 'Bands')} value={technicals.bollinger.state ?? '-'} />
          <Row label={t('תמיכה', 'Support')} value={technicals.support.map(money).join(' · ') || '-'} />
          <Row label={t('התנגדות', 'Resistance')} value={technicals.resistance.map(money).join(' · ') || '-'} />
        </div>
        {technicals.overextension.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/8 p-2 text-xs text-amber-100">
            {technicals.overextension.join(' ')}
          </div>
        )}
      </Section>

      <Section title={t('תרחישים', 'Scenarios')}>
        <div className="space-y-2">
          {report.scenarios.map(scenario => (
            <div key={scenario.key} className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-100">{scenario.label}</span>
                <span className="text-xs font-semibold text-slate-300" dir="ltr">
                  {money(scenario.zone.low)} - {money(scenario.zone.high)}
                  {scenario.zonePct != null ? ` (${scenario.zonePct > 0 ? '+' : ''}${scenario.zonePct}%)` : ''}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{scenario.trigger} {scenario.outcome}</p>
              <p className="mt-1 text-xs text-slate-500">{scenario.invalidation}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={t('מסגרת תוכנית מסחר', 'Trade-plan framework')}
        badge={tradePlan.noValidSetup
          ? <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-[11px] font-bold text-rose-100">
            <X size={12} />{t('אין סטאפ תקף', 'No valid setup')}
          </span>
          : <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
            R:R 1:{tradePlan.riskReward}
          </span>}
      >
        {tradePlan.noValidSetup ? (
          <div className="space-y-2">
            <ul className="space-y-1 text-xs text-slate-300">
              {tradePlan.reasons.map(reason => (
                <li key={reason} className="flex gap-2">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber-300" />
                  {reason}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">{tradePlan.note}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            <Row label={t('אזור מעקב', 'Watch zone')} value={tradePlan.watchZone} />
            <Row label={t('אזור כניסה', 'Entry zone')} value={`${money(tradePlan.entryZone.low)} - ${money(tradePlan.entryZone.high)}`} />
            <Row label={t('ביטול', 'Invalidation')} value={money(tradePlan.invalidation)} />
            <Row label={t('סטופ', 'Stop')} value={tradePlan.stopConcept} />
            <Row label={t('יעד 1', 'Target 1')} value={money(tradePlan.target1)} />
            <Row label={t('יעד 2', 'Target 2')} value={money(tradePlan.target2)} />
            <div className="col-span-2 sm:col-span-3">
              <Row label={t('טריגר כניסה', 'Entry trigger')} value={tradePlan.entryTrigger} />
              <Row label={t('סטופ זמן', 'Time stop')} value={tradePlan.timeStop} />
            </div>
          </div>
        )}
      </Section>

      <Section title={t('סיכונים', 'Risks')}>
        <div className="space-y-2">
          {report.risks.map(risk => (
            <div key={`${risk.category}-${risk.text}`} className={`rounded-xl border p-2 text-xs ${SEVERITY_TONE[risk.severity]}`}>
              <span className="font-bold">{risk.category}: </span>{risk.text}
            </div>
          ))}
          {!report.risks.length && (
            <p className="text-xs text-slate-400">{t('לא זוהו סיכונים בקטגוריות שנבדקו.', 'No risks identified in the examined categories.')}</p>
          )}
        </div>
      </Section>

      <Section title={t('זרזים ואירועים', 'Catalysts and events')} badge={
        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${QUALITY_TONE[report.catalysts.status]}`}>
          {report.catalysts.status}
        </span>
      }>
        <div className="space-y-2">
          {report.catalysts.items.map(item => (
            <div key={`${item.date}-${item.event}`} className="rounded-xl border border-white/8 bg-white/3 p-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-100">{item.event}</span>
                <span className="text-slate-300" dir="ltr">
                  {item.date ?? '-'}{item.estimated ? ' *' : ''}{item.daysUntil != null ? ` (${item.daysUntil}d)` : ''}
                </span>
              </div>
              {item.bear && <p className="mt-1 text-slate-400">{item.bear}</p>}
              {item.detail && <p className="mt-1 text-slate-400" dir="ltr">{item.detail}</p>}
            </div>
          ))}
          {!report.catalysts.items.length && (
            <p className="text-xs text-slate-400">{t('אין זרז מאומת בטווח הקרוב.', 'No verified near-term catalyst.')}</p>
          )}
          <p className="text-xs text-slate-500">{report.catalysts.note}</p>
        </div>
      </Section>

      <Section title={t('פונדמנטלס ותמחור', 'Fundamentals and valuation')} badge={
        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${QUALITY_TONE[report.fundamentals.status]}`}>
          {report.fundamentals.status}
        </span>
      }>
        {(report.fundamentals.known ?? []).length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {report.fundamentals.known.map(item => <Row key={item.label} label={item.label} value={item.value} />)}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          <span className="font-bold">{t('לא זמין', 'Unavailable')}: </span>
          {(report.fundamentals.unavailable ?? []).join(' · ')}
        </p>
        <p className="mt-1 text-xs text-slate-500">{report.fundamentals.note}</p>
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-bold">{t('תמחור', 'Valuation')} ({report.valuation.status}): </span>
          {report.valuation.note}
        </p>
      </Section>

      {report.position && (
        <Section title={t('פוזיציה קיימת', 'Existing position')}>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            <Row label={t('מחיר ממוצע', 'Average price')} value={money(report.position.avgPrice)} />
            <Row label={t('כמות', 'Quantity')} value={report.position.quantity} />
            <Row label={t('שווי', 'Value')} value={money(report.position.value)} />
            <Row label={t('רווח/הפסד', 'Unrealized P&L')} value={`${money(report.position.unrealized)} (${report.position.unrealizedPct}%)`} />
            <Row label={t('לנקודת איזון', 'To break even')} value={`${report.position.breakEvenPct}%`} />
            <Row label={t('ריכוזיות', 'Concentration')} value={report.position.concentration != null ? `${report.position.concentration}%` : '-'} />
          </div>
          {report.position.warnings.map(warning => (
            <p key={warning} className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/8 p-2 text-xs text-amber-100">{warning}</p>
          ))}
        </Section>
      )}

      <Section title={t('ביטחון, מקורות ומגבלות', 'Confidence, sources, and limitations')}>
        <ul className="space-y-1 text-xs text-slate-300">
          {confidence.reasons.map(reason => <li key={reason}>• {reason}</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">{confidence.note}</p>
        <ul className="mt-3 space-y-1 text-xs text-slate-500" dir="ltr">
          {quality.sources.map(source => (
            <li key={source.endpoint}>{source.name}: <code>{source.endpoint}</code> — {source.status}</li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
