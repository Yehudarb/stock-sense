import WatchlistPanel from '../watchlist/WatchlistPanel'
import useStore from '../../store/useStore'

const NAV_ITEMS = [
  {
    id: 'intelligence',
    icon: 'decision',
    he: ['החלטה', 'סיכום ופעולה מומלצת'],
    en: ['Decision', 'Summary and next action'],
  },
  {
    id: 'chart',
    icon: 'chart',
    he: ['גרף וניתוח', 'נרות, רמות ואינדיקטורים'],
    en: ['Chart analysis', 'Candles, levels and indicators'],
  },
  {
    id: 'validation',
    icon: 'validate',
    he: ['אימות האות', 'בדיקת חוזק היסטורית'],
    en: ['Validate signal', 'Historical strength check'],
  },
  {
    id: 'pro',
    icon: 'report',
    he: ['דוח מקצועי', 'תמונת מחקר מלאה'],
    en: ['Pro report', 'Complete research view'],
  },
  {
    id: 'paper',
    icon: 'paper',
    he: ['מסחר דמו', 'תרגול ללא כסף אמיתי'],
    en: ['Paper trading', 'Practice without real money'],
  },
]

const ICON_PATHS = {
  decision: 'M4 13h4l2-7 4 12 2-5h4',
  chart: 'M4 18V9m5 9V5m5 13v-7m5 7V3',
  validate: 'm5 12 4 4L19 6',
  report: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  paper: 'M4 7h16v11H4zM7 7V5h10v2m-8 5h6',
}

function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

export default function Sidebar({ isConnected = false, activeTab, onTabChange }) {
  const { language, setShowScanner, simpleMode } = useStore()
  const isHebrew = language === 'he'
  const canNavigate = !simpleMode && typeof onTabChange === 'function'

  return (
    <aside className="app-sidebar hidden shrink-0 md:flex md:h-full md:w-[276px] md:flex-col">
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

      {canNavigate ? (
        <nav className="app-sidebar__nav" aria-label={isHebrew ? 'מודולי ניתוח' : 'Analysis modules'}>
          <div className="app-sidebar__label">{isHebrew ? 'סביבת עבודה' : 'Workspace'}</div>
          {NAV_ITEMS.map(item => {
            const [label, description] = isHebrew ? item.he : item.en
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
              >
                <span className="sidebar-nav-item__icon"><NavIcon name={item.icon} /></span>
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
          <svg viewBox="0 0 24 24"><path d="M4 5h16M7 10h10M9 15h6M11 20h2" /></svg>
        </span>
        <span>
          <strong>{isHebrew ? 'סורק Cup & Handle' : 'Cup & Handle scanner'}</strong>
          <small>{isHebrew ? 'איתור הזדמנויות בכל השוק' : 'Find setups across the market'}</small>
        </span>
      </button>

      <div className="app-sidebar__watchlist">
        <div className="app-sidebar__label">{isHebrew ? 'רשימת מעקב' : 'Watchlist'}</div>
        <WatchlistPanel />
      </div>
    </aside>
  )
}
