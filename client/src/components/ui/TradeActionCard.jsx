import { AlertTriangle, ChevronDown } from 'lucide-react'
import { fmtPrice } from '../../lib/formatters'

const ACTION_THEME = {
  STRONG_BUY: { tone: 'positive', labelClass: 'decision-status--positive' },
  BUY: { tone: 'positive', labelClass: 'decision-status--positive' },
  HOLD: { tone: 'neutral', labelClass: 'decision-status--neutral' },
  SELL: { tone: 'negative', labelClass: 'decision-status--negative' },
  STRONG_SELL: { tone: 'negative', labelClass: 'decision-status--negative' },
}

function pctText(value, positive = true) {
  if (value == null || Number.isNaN(value)) return null
  return `${positive ? '+' : '-'}${Math.abs(value).toFixed(1)}%`
}

function DecisionLevel({ label, value, note, tone = 'default' }) {
  return (
    <div className="decision-level">
      <span>{label}</span>
      <strong className={`decision-level__value decision-level__value--${tone}`} dir="ltr">{value}</strong>
      {note && <small>{note}</small>}
    </div>
  )
}

export default function TradeActionCard({ decision, language = 'he' }) {
  if (!decision) return null

  const isEnglish = language === 'en'
  const theme = ACTION_THEME[decision.action] ?? ACTION_THEME.HOLD
  const entryZone = decision.entryLow != null && decision.entryHigh != null
    ? `${fmtPrice(decision.entryLow)} – ${fmtPrice(decision.entryHigh)}`
    : (isEnglish ? 'Wait for confirmation' : 'להמתין לאישור')
  const stopPrice = decision.invalidation ?? decision.stopLoss
  const targetPrice = decision.takeProfit ?? decision.holdUntil
  const changeLevel = decision.buyAbove ?? decision.resistance
  const reasons = decision.reasons?.slice(0, 3) ?? []

  const copy = {
    eyebrow: isEnglish ? 'Deterministic strategy output' : 'פלט מנוע אסטרטגיה דטרמיניסטי',
    score: isEnglish ? 'Signal score' : 'ציון האות',
    scoreNote: isEnglish ? 'Rule alignment, not probability' : 'התאמת כללים, לא הסתברות',
    entry: isEnglish ? 'Entry zone' : 'אזור כניסה',
    stop: isEnglish ? 'Invalidation / Stop' : 'ביטול תרחיש / Stop',
    target: isEnglish ? 'Working target' : 'יעד עבודה',
    ratio: isEnglish ? 'Risk / Reward' : 'סיכון / תשואה',
    why: isEnglish ? 'Why this conclusion' : 'על מה מבוססת המסקנה',
    change: isEnglish ? 'What changes the conclusion' : 'מה ישנה את המסקנה',
    changeText: changeLevel != null
      ? (isEnglish ? `A confirmed close above ${fmtPrice(changeLevel)} requires a fresh analysis.` : `סגירה מאושרת מעל ${fmtPrice(changeLevel)} מחייבת ניתוח מחדש.`)
      : (isEnglish ? 'A confirmed structure change requires a fresh analysis.' : 'שינוי מבני מאושר במחיר מחייב ניתוח מחדש.'),
    stopDetails: isEnglish ? 'Stop method and alternatives' : 'שיטת Stop וחלופות',
    recommended: isEnglish ? 'Recommended' : 'מומלץ',
    riskDistance: isEnglish ? 'Risk distance' : 'מרחק סיכון',
    breakEven: isEnglish ? 'Break-even trigger' : 'מעבר ל-Break-even',
    alternatives: isEnglish ? 'Alternatives' : 'חלופות',
    fromPrice: isEnglish ? 'from current price' : 'מהמחיר הנוכחי',
  }

  return (
    <section className={`decision-card decision-card--${theme.tone}`}>
      <header className="decision-card__header">
        <div className="min-w-0">
          <div className="decision-card__eyebrow">{copy.eyebrow}</div>
          <div className="decision-card__verdict">
            <span className={`decision-status ${theme.labelClass}`}>{decision.primaryAction}</span>
            <p>{decision.headline}</p>
          </div>
        </div>
        <div className="decision-score">
          <span>{copy.score}</span>
          <strong dir="ltr">{decision.signalStrength}<small>/100</small></strong>
          <small>{copy.scoreNote}</small>
        </div>
      </header>

      <div className="decision-levels">
        <DecisionLevel label={copy.entry} value={entryZone} tone="entry" />
        <DecisionLevel label={copy.stop} value={fmtPrice(stopPrice)} note={pctText(decision.downsidePct, false)} tone="negative" />
        <DecisionLevel label={copy.target} value={fmtPrice(targetPrice)} note={pctText(decision.upsidePct)} tone="positive" />
        <DecisionLevel label={copy.ratio} value={decision.riskReward != null ? `1:${decision.riskReward}` : '—'} />
      </div>

      <div className="decision-rationale">
        <div>
          <h2>{copy.why}</h2>
          {reasons.length ? (
            <ul>
              {reasons.map(reason => <li key={reason}>{reason}</li>)}
            </ul>
          ) : (
            <p>{decision.shortConclusion}</p>
          )}
        </div>
        <aside>
          <AlertTriangle size={17} aria-hidden="true" />
          <span>
            <strong>{copy.change}</strong>
            <small>{copy.changeText}</small>
          </span>
        </aside>
      </div>

      {decision.stopContext?.recommended && (
        <details className="decision-stop-details">
          <summary>
            <span>{copy.stopDetails}</span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="decision-stop-details__grid">
            <DecisionLevel
              label={copy.recommended}
              value={fmtPrice(decision.stopContext.recommended.price)}
              note={decision.stopContext.recommended.type}
              tone="negative"
            />
            <DecisionLevel
              label={copy.riskDistance}
              value={`${decision.stopContext.recommended.riskPct}%`}
              note={`${fmtPrice(decision.stopContext.recommended.distanceDollar)} ${copy.fromPrice}`}
            />
            <DecisionLevel
              label={copy.breakEven}
              value={fmtPrice(decision.stopContext.breakEvenTrigger)}
              note={decision.stopContext.volatilityBand}
            />
            <DecisionLevel
              label={copy.alternatives}
              value={`${fmtPrice(decision.stopContext.aggressive?.price)} / ${fmtPrice(decision.stopContext.conservative?.price)}`}
            />
          </div>
          {decision.stopContext.comment && <p className="decision-stop-details__comment">{decision.stopContext.comment}</p>}
        </details>
      )}
    </section>
  )
}
