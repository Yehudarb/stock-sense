import Card from './Card'

export default function MetricCard({ label, value, sub, color = 'text-white', className = '' }) {
  return (
    <Card className={`rounded-2xl p-4 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-black tracking-tight sm:text-2xl ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}
