const actionColors = {
  STRONG_BUY:  'bg-emerald-400/12 text-emerald-200 border-emerald-400/20',
  BUY:         'bg-emerald-400/8 text-emerald-300 border-emerald-400/18',
  HOLD:        'bg-amber-300/10 text-amber-100 border-amber-300/18',
  SELL:        'bg-rose-400/8 text-rose-200 border-rose-400/18',
  STRONG_SELL: 'bg-rose-400/12 text-rose-100 border-rose-400/24',
}

const toneColors = {
  default: 'bg-white/5 text-slate-200 border-white/10',
  positive: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/18',
  warning: 'bg-amber-300/10 text-amber-100 border-amber-300/18',
  danger: 'bg-rose-400/10 text-rose-100 border-rose-400/18',
  balanced: 'bg-sky-400/10 text-sky-100 border-sky-400/18',
}

const sentimentTone = {
  Bullish: 'positive',
  bullish: 'positive',
  Neutral: 'balanced',
  neutral: 'balanced',
  Bearish: 'danger',
  bearish: 'danger',
}

export default function Badge({ action, label, children, tone = 'default', sentiment, className = '' }) {
  const resolvedTone = sentiment ? sentimentTone[sentiment] ?? tone : tone
  const colorClass = action ? (actionColors[action] ?? actionColors.HOLD) : (toneColors[resolvedTone] ?? toneColors.default)

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${colorClass} ${className}`}>
      {label ?? children}
    </span>
  )
}
