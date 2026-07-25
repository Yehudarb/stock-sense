import { fmtPrice } from '../../lib/formatters'

const TONE_STYLE = {
  bullish: 'border-green-400/30 bg-green-500/5 text-green-100',
  bearish: 'border-red-400/30 bg-red-500/5 text-red-100',
  neutral: 'border-blue-400/30 bg-blue-500/5 text-blue-100',
}

/**
 * Answers "should I enter now, and why" directly on the dashboard screen,
 * using signal.decision (lib/analystDecision.js) - no new scoring logic,
 * just surfacing the headline/reasons/target that already exist there but
 * were previously only shown once the user opened Trade Setup.
 */
export default function TradeVerdictCard({ decision, language = 'he' }) {
  if (!decision) return null
  const isHebrew = language === 'he'
  const toneClass = TONE_STYLE[decision.tone] ?? TONE_STYLE.neutral

  const copy = {
    outlook: isHebrew ? 'צפי / יעד' : 'Outlook / target',
    protection: isHebrew ? 'רמת הגנה' : 'Protection level',
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="text-sm font-bold leading-relaxed">{decision.headline}</div>

      {decision.reasons?.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs opacity-80">
          {decision.reasons.slice(0, 3).map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide opacity-60">{copy.outlook}</div>
          <div className="text-sm font-black">
            {decision.holdUntil != null ? fmtPrice(decision.holdUntil) : '—'}
            {decision.upsidePct != null && (
              <span className="ms-1 text-xs font-semibold opacity-80">
                ({decision.upsidePct >= 0 ? '+' : ''}{decision.upsidePct}%)
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide opacity-60">{copy.protection}</div>
          <div className="text-sm font-black">
            {decision.invalidation != null ? fmtPrice(decision.invalidation) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
