export default function KpiCard({ label, value, sub, color }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-lg font-bold ${color ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
