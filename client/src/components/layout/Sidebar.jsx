import WatchlistPanel from '../watchlist/WatchlistPanel'
import useStore from '../../store/useStore'

export default function Sidebar() {
  const { language } = useStore()

  return (
    <aside className="w-full shrink-0 border-b border-slate-700 bg-slate-900 p-3 md:h-full md:w-52 md:border-b-0 md:border-r">
      <h2 className="mb-3 text-sm font-bold text-slate-400">{language === 'he' ? 'רשימת מעקב' : 'Watchlist'}</h2>
      <WatchlistPanel />
    </aside>
  )
}
