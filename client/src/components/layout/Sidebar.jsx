import WatchlistPanel from '../watchlist/WatchlistPanel'

export default function Sidebar() {
  return (
    <aside className="w-full shrink-0 border-b border-slate-700 bg-slate-900 p-3 md:h-full md:w-52 md:border-b-0 md:border-r">
      <h2 className="mb-3 text-right text-sm font-bold text-slate-400">רשימת מעקב</h2>
      <WatchlistPanel />
    </aside>
  )
}
