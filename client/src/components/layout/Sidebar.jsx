import WatchlistPanel from '../watchlist/WatchlistPanel'
import TickerSearch from '../watchlist/TickerSearch'
import useStore from '../../store/useStore'
import { BadgeCheck, CandlestickChart, FileText, Gauge, ScanSearch, WalletCards } from 'lucide-react'

const NAV_ITEMS = [
  {
    id: 'intelligence',
    icon: Gauge,
    he: ['החלטה', 'סיכום ופעולה מומלצת'],
    en: ['Decision', 'Summary and next action'],
  },
  {
    id: 'chart',
    icon: CandlestickChart,
    he: ['גרף וניתוח', 'נרות, רמות ואינדיקטורים'],
    en: ['Chart analysis', 'Candles, levels and indicators'],
  },
  {
    id: 'validation',
    icon: BadgeCheck,
    he: ['אימות האות', 'בדיקת חוזק היסטורית'],
    en: ['Validate signal', 'Historical strength check'],
  },
  {
    id: 'pro',
    icon: FileText,
    he: ['דוח מקצועי', 'תמונת מחקר מלאה'],
    en: ['Pro report', 'Complete research view'],
  },
  {
    id: 'paper',
    icon: WalletCards,
    he: ['מסחר דמו', 'תרגול ללא כסף אמיתי'],
    en: ['Paper trading', 'Practice without real money'],
  },
]

export default function Sidebar({ isConnected = false, activeTab, onTabChange }) {
  const { language, setShowScanner, simpleMode } = useStore()
  const isHebrew = language === 'he'
  const canNavigate = !simpleMode && typeof onTabChange === 'function'

  return (
    <aside className="app-sidebar hidden shrink-0 xl:flex xl:w-[276px] xl:flex-col">
      <div className="app-sidebar__brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="min-w-0">
          <div className="brand-name">STOCK SENSE</div>
          <div className="brand-subtitle">Market decision desk</div>
        </div>
        <span className={`status-chip ms-auto ${isConnected ? 'status-chip--online' : 'status-chip--offline'}`}>
          <span className="status-chip__dot" />
          {isConnected ? (isHebrew ? 'חי' : 'Live') : (isHebrew ? 'ממתין' : 'Waiting')}
        </span>
      </div>

      <div className="app-sidebar__stock-search">
        <TickerSearch prominent />
      </div>

      <section className="app-sidebar__watchlist" aria-label={isHebrew ? 'רשימת מעקב' : 'Watchlist'}>
        <div className="app-sidebar__label">{isHebrew ? 'רשימת מעקב' : 'Watchlist'}</div>
        <WatchlistPanel />
      </section>

      {canNavigate ? (
        <nav className="app-sidebar__nav" aria-label={isHebrew ? 'מודולי ניתוח' : 'Analysis modules'}>
          <div className="app-sidebar__label">{isHebrew ? 'סביבת עבודה' : 'Workspace'}</div>
          {NAV_ITEMS.map(item => {
            const [label, description] = isHebrew ? item.he : item.en
            const isActive = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
              >
                <span className="sidebar-nav-item__icon"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="sidebar-nav-item__label">{label}</span>
                  <span className="sidebar-nav-item__description">{description}</span>
                </span>
                <span className="sidebar-nav-item__arrow">{isHebrew ? '‹' : '›'}</span>
              </button>
            )
          })}
        </nav>
      ) : (
        <div className="app-sidebar__simple-card">
          <div className="app-sidebar__label">{isHebrew ? 'מצב TSLL פשוט' : 'TSLL simple mode'}</div>
          <strong>{isHebrew ? 'החלטה אחת בכל פעם' : 'One decision at a time'}</strong>
          <p>{isHebrew ? 'בדוק את האות, הגדר סיכון ותרגל בדמו בלבד.' : 'Review the signal, set risk, and practice in paper mode.'}</p>
        </div>
      )}

      <button type="button" className="scanner-launch" onClick={() => setShowScanner(true)}>
        <span className="scanner-launch__icon" aria-hidden="true">
          <ScanSearch size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span>
          <strong>{isHebrew ? 'סורק Cup & Handle' : 'Cup & Handle scanner'}</strong>
          <small>{isHebrew ? 'איתור הזדמנויות בכל השוק' : 'Find setups across the market'}</small>
        </span>
      </button>

    </aside>
  )
}
