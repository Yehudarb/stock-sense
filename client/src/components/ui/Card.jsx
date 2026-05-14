export default function Card({ children, className = '', tone = 'default' }) {
  const tones = {
    default: 'glass-panel',
    subtle: 'rounded-2xl border border-white/6 bg-surface/60 shadow-glass',
    positive: 'glass-panel border-emerald-400/15',
    warning: 'glass-panel border-amber-400/15',
    danger: 'glass-panel border-rose-400/15',
  }

  return (
    <div className={`${tones[tone] ?? tones.default} ${className}`}>
      {children}
    </div>
  )
}
