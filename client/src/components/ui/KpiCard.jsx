export default function KpiCard({ label, value, sub, color }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-slate-800 p-3">
      <span className="text-[11px] text-slate-400 sm:text-xs">{label}</span>
      <span className={`text-base font-bold sm:text-lg ${color ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
