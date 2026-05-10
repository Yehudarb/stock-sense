const pill = {
  BUY:  'bg-green-900 text-green-300',
  SELL: 'bg-red-900 text-red-300',
  HOLD: 'bg-yellow-900 text-yellow-300',
}

const labels = { BUY: 'קנייה', SELL: 'מכירה', HOLD: 'ניטרלי' }

export default function FactorRow({ label, signal, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400 font-mono">{value}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pill[signal] ?? pill.HOLD}`}>
          {labels[signal] ?? signal}
        </span>
      </div>
    </div>
  )
}
