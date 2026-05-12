export default function KpiCard({ label, value, sub, color }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl glass-panel p-4">
      <span className="text-[11px] font-medium tracking-wide uppercase text-slate-400 sm:text-xs">{label}</span>
      <span className={`text-xl font-black tracking-tight sm:text-2xl ${color ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
