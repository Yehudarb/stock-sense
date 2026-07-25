import { buildPlainVerdict } from '../../lib/plainVerdict'

const TONE_STYLE = {
  bullish: 'border-green-400/30 bg-green-500/5 text-green-50',
  bearish: 'border-red-400/30 bg-red-500/5 text-red-50',
  neutral: 'border-blue-400/30 bg-blue-500/5 text-blue-50',
}

/**
 * The single "so what do I do" paragraph - no tables, no indicator
 * names, just a plain-language bottom line built from signal.decision
 * (same source every other panel uses). Meant to be the first thing a
 * trader reads, before any of the detailed breakdowns.
 */
export default function PlainVerdictCard({ decision, checklist, language = 'he' }) {
  if (!decision) return null
  const isHebrew = language === 'he'
  const text = buildPlainVerdict({ decision, checklist, language })
  if (!text) return null

  const toneClass = TONE_STYLE[decision.tone] ?? TONE_STYLE.neutral

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">
        {isHebrew ? 'עצה טכנית — בקצרה' : 'Technical advice — in short'}
      </div>
      <p className="mt-2 text-base font-semibold leading-relaxed">{text}</p>
    </div>
  )
}
