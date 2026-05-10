export default function Badge({ action, label }) {
  const colors = {
    STRONG_BUY:  'bg-green-900 text-green-300 border-green-600',
    BUY:         'bg-green-950 text-green-400 border-green-700',
    HOLD:        'bg-yellow-950 text-yellow-400 border-yellow-700',
    SELL:        'bg-red-950 text-red-400 border-red-700',
    STRONG_SELL: 'bg-red-900 text-red-300 border-red-600',
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full border text-sm font-bold ${colors[action] ?? colors.HOLD}`}>
      {label}
    </span>
  )
}
