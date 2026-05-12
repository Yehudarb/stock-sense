import WatchlistPanel from '../watchlist/WatchlistPanel'
import useStore from '../../store/useStore'

export default function Sidebar() {
  const { language } = useStore()

  return (
    <aside className="w-full shrink-0 border-b border-white/5 bg-surface/50 backdrop-blur-sm p-4 md:h-full md:w-64 md:border-b-0 md:border-r">
      <h2 className="mb-4 text-xs font-bold tracking-widest text-slate-500 uppercase">{language === 'he' ? 'רשימת מעקב' : 'Watchlist'}</h2>
      <WatchlistPanel />
    </aside>
  )
}
