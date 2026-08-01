import WatchlistPanel from '../watchlist/WatchlistPanel'
import useStore from '../../store/useStore'

export default function Sidebar({ isConnected = false }) {
  const { language } = useStore()
  const isHebrew = language === 'he'

  return (
    <aside className="hidden w-full shrink-0 border-b border-white/5 bg-surface/50 p-4 backdrop-blur-sm md:block md:h-full md:w-64 md:border-b-0 md:border-r">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">Stock Sense</div>
          <h2 className="mt-1 text-sm font-black text-white">{isHebrew ? 'מרכז הניתוח' : 'Analysis desk'}</h2>
        </div>
        <span className={`status-chip ${isConnected ? 'status-chip--online' : 'status-chip--offline'}`}>
          <span className="status-chip__dot" />
          {isConnected ? (isHebrew ? 'מחובר' : 'Online') : (isHebrew ? 'ממתין' : 'Waiting')}
        </span>
      </div>

      <div className="sidebar-guide">
        <div className="sidebar-guide__title">{isHebrew ? 'איך משתמשים' : 'How to use'}</div>
        <div className="sidebar-guide__step"><b>1</b><span>{isHebrew ? 'בחר מניה' : 'Choose a ticker'}</span></div>
        <div className="sidebar-guide__step"><b>2</b><span>{isHebrew ? 'קרא את ההחלטה' : 'Read the decision'}</span></div>
        <div className="sidebar-guide__step"><b>3</b><span>{isHebrew ? 'אמת בגרף וברמות' : 'Validate on chart'}</span></div>
        <div className="sidebar-guide__step"><b>4</b><span>{isHebrew ? 'תרגל בדמו בלבד' : 'Practice in paper only'}</span></div>
      </div>

      <h2 className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{isHebrew ? 'נכסים במעקב' : 'Watchlist'}</h2>
      <WatchlistPanel />
    </aside>
  )
}
