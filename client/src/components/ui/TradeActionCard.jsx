import { fmtPrice } from '../../lib/formatters'
import { TRADER_TEXT } from '../../lib/traderColors'

const ACTION_THEME = {
  STRONG_BUY: {
    badge: 'bg-green-500/15 text-green-300 ring-1 ring-green-500/30',
    accent: TRADER_TEXT.bullish,
  },
  BUY: {
    badge: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    accent: TRADER_TEXT.entry,
  },
  HOLD: {
    badge: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    accent: TRADER_TEXT.neutral,
  },
  SELL: {
    badge: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
    accent: TRADER_TEXT.bearish,
  },
  STRONG_SELL: {
    badge: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
    accent: TRADER_TEXT.stopLoss,
  },
}

function pctText(value, positiveLabel = true) {
  if (value == null || Number.isNaN(value)) return '-'
  const normalized = Math.abs(value).toFixed(1)
  return `${positiveLabel ? '+' : '-'}${normalized}%`
}

function metric(label, value, accent, sub = null) {
  return { label, value, accent, sub }
}

export default function TradeActionCard({ decision, language = 'he' }) {
  if (!decision) return null

  const isEnglish = language === 'en'
  const theme = ACTION_THEME[decision.action] ?? ACTION_THEME.HOLD
  const entryZone = decision.entryLow != null && decision.entryHigh != null
    ? `${fmtPrice(decision.entryLow)} - ${fmtPrice(decision.entryHigh)}`
    : (isEnglish ? 'Wait for setup' : 'להמתין לסטאפ')
  const rrRatio = decision.riskReward != null ? `1:${decision.riskReward}` : '-'
  const riskPct = decision.downsidePct != null ? `${pctText(decision.downsidePct, false)}` : '-'
  const tpPct = decision.upsidePct != null ? `${pctText(decision.upsidePct, true)}` : '-'

  const copy = {
    title: isEnglish ? 'Trade action' : 'פעולת מסחר',
    confidence: isEnglish ? 'Confidence' : 'ביטחון',
    currentPrice: isEnglish ? 'Current price' : 'מחיר נוכחי',
    entryZone: isEnglish ? 'Entry zone' : 'אזור כניסה',
    ratio: isEnglish ? 'R/R' : 'יחס סיכון/תשואה',
    stopLoss: isEnglish ? 'Stop Loss' : 'סטופ לוס',
    takeProfit: isEnglish ? 'Take Profit' : 'טייק פרופיט',
    risk: isEnglish ? 'Risk' : 'סיכון',
  }

  const metrics = [
    metric(copy.currentPrice, fmtPrice(decision.currentPrice), 'text-white'),
    metric(copy.entryZone, entryZone, TRADER_TEXT.entry),
    metric(copy.ratio, rrRatio, theme.accent),
    metric(copy.stopLoss, fmtPrice(decision.invalidation ?? decision.stopLoss), TRADER_TEXT.stopLoss, riskPct),
    metric(copy.takeProfit, fmtPrice(decision.takeProfit ?? decision.holdUntil), TRADER_TEXT.takeProfit, tpPct),
    metric(copy.risk, riskPct, decision.downsidePct != null && Math.abs(decision.downsidePct) > 5 ? 'text-yellow-300' : 'text-slate-200'),
  ]

  return (
    <section className="overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
      <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${theme.badge}`}>{decision.primaryAction}</span>
            <span className="text-sm text-slate-400">{decision.headline}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950/70 px-4 py-3 text-left sm:text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.confidence}</div>
          <div className={`mt-1 text-2xl font-black tracking-tight ${theme.accent}`}>{decision.confidence}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/8 sm:grid-cols-3">
        {metrics.map(item => (
          <div key={item.label} className="bg-slate-950/55 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            <div className={`mt-2 text-lg font-black tracking-tight sm:text-xl ${item.accent}`}>{item.value}</div>
            {item.sub && <div className="mt-1 text-xs text-slate-500">{item.sub}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
