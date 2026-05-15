const pill = {
  BUY: 'bg-green-900 text-green-300',
  SELL: 'bg-red-900 text-red-300',
  HOLD: 'bg-yellow-900 text-yellow-300',
}

const labels = {
  he: { BUY: 'קנייה', SELL: 'מכירה', HOLD: 'ניטרלי' },
  en: { BUY: 'Buy', SELL: 'Sell', HOLD: 'Neutral' },
}

const labelMap = {
  en: {
    'מרחק SMA20': 'SMA20 distance',
  },
}

export default function FactorRow({ label, signal, value, language = 'he' }) {
  const displayLabel = labelMap[language]?.[label] ?? (language === 'en' && label?.includes('SMA20') ? 'SMA20 distance' : label)

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/50 last:border-0">
      <span className="text-sm text-slate-300 md:text-xs">{displayLabel}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-base font-semibold text-white md:text-sm">{value}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pill[signal] ?? pill.HOLD}`}>
          {labels[language]?.[signal] ?? signal}
        </span>
      </div>
    </div>
  )
}
