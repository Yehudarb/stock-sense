import WatchlistPanel from '../watchlist/WatchlistPanel'
import useStore from '../../store/useStore'

export default function Sidebar() {
  const { language } = useStore()

  return (
    <aside className="hidden w-full shrink-0 border-b border-white/5 bg-surface/50 p-4 backdrop-blur-sm md:block md:h-full md:w-64 md:border-b-0 md:border-r">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">{language === 'he' ? 'רשימת מעקב' : 'Watchlist'}</h2>
      <WatchlistPanel />
    </aside>
  )
}
