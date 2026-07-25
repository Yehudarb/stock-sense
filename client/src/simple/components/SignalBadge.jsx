const SIGNAL_STYLE = {
  BUY: 'bg-green-500/15 border-green-400/40 text-green-300',
  SELL: 'bg-red-500/15 border-red-400/40 text-red-300',
  HOLD: 'bg-blue-500/15 border-blue-400/40 text-blue-300',
  WAIT: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
}

const LABEL = {
  he: { BUY: 'קנייה', SELL: 'מכירה', HOLD: 'החזקה', WAIT: 'המתנה' },
  en: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', WAIT: 'WAIT' },
}

const CONFIDENCE_LABEL = {
  he: { Strong: 'ביטחון גבוה', Medium: 'ביטחון בינוני', Weak: 'ביטחון נמוך' },
  en: { Strong: 'Strong confidence', Medium: 'Medium confidence', Weak: 'Weak confidence' },
}

export default function SignalBadge({ action, confidence, language = 'he' }) {
  const isHebrew = language === 'he'
  const style = SIGNAL_STYLE[action] ?? SIGNAL_STYLE.WAIT
  const label = LABEL[language]?.[action] ?? action
  const confidenceLabel = CONFIDENCE_LABEL[language]?.[confidence] ?? confidence

  return (
    <div className={`flex flex-col items-center gap-2 rounded-3xl border-2 px-6 py-8 text-center ${style}`}>
      <div className="text-4xl font-black tracking-tight sm:text-5xl">{label}</div>
      <div className="text-sm font-semibold uppercase tracking-widest opacity-80">{confidenceLabel}</div>
    </div>
  )
}
