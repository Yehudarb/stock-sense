import WatchlistPanel from '../watchlist/WatchlistPanel'

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-slate-900 border-r border-slate-700 p-3 flex flex-col h-full">
      <h2 className="text-sm font-bold text-slate-400 mb-3 text-right">רשימת מעקב</h2>
      <WatchlistPanel />
    </aside>
  )
}
