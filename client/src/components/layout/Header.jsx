import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import useStore from '../../store/useStore'
import { fmtPrice, fmtChange } from '../../lib/formatters'
import { INTERVALS } from '../../../../shared/constants'
import StockLogo from '../ui/StockLogo'
import { Bookmark, ChartNoAxesCombined, Monitor, Moon, ScanSearch, SlidersHorizontal, Sun } from 'lucide-react'

const INTERVAL_LABELS = {
  he: {
    '1m': '1 דק׳',
    '5m': '5 דק׳',
    '15m': '15 דק׳',
    '1h': 'שעה',
    '4h': '4 שעות',
    '1d': 'יום',
    '1mo': 'חודש',
    '1y': 'שנה',
    '5y': '5 שנים',
  },
  en: {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1mo': '1mo',
    '1y': '1y',
    '5y': '5y',
  },
}

export default function Header({ isConnected }) {
  const [, setClock] = useState(Date.now())
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const {
    currentTicker,
    snapshot,
    interval,
    setInterval,
    isLoading,
    language,
    setLanguage,
    watchlist,
    setCurrentTicker,
    lastUpdateTime,
    intervalRefreshing,
    setIntervalRefreshing,
    theme,
    setTheme,
    viewMode,
    setViewMode,
    simpleMode,
    setSimpleMode,
    setShowScanner,
    proChart,
    setProChart,
  } = useStore()

  const isHebrew = language === 'he'
  const copy = {
    loading: isHebrew ? 'טוען...' : 'Loading...',
    range: isHebrew ? 'טווח' : 'Range',
    language: isHebrew ? 'English' : 'עברית',
    switchLanguage: isHebrew ? 'Switch to English' : 'לעבור לעברית',
    switchTheme: isHebrew ? 'החלף ערכת נושא' : 'Toggle theme',
    watchlist: isHebrew ? 'רשימת מעקב' : 'Watchlist',
    live: isHebrew ? 'חי' : 'Live',
    noWatchlist: isHebrew ? 'אין עדיין סימבולים שמורים' : 'No saved symbols yet',
    lastUpdate: isHebrew ? 'עדכון אחרון' : 'Last update',
    refreshHint: isHebrew ? 'מחשב מחדש ניתוח לטווח החדש' : 'Recalculating analysis for the new timeframe',
    simpleModeOn: isHebrew ? 'מצב מתקדם' : 'Advanced mode',
    simpleModeOff: isHebrew ? 'מצב פשוט (TSLL)' : 'Simple mode (TSLL)',
    display: isHebrew ? 'תצוגה' : 'Display',
    auto: isHebrew ? 'אוטומטי' : 'Auto',
    desktop: isHebrew ? 'מחשב' : 'Desktop',
    mobile: isHebrew ? 'פלאפון' : 'Mobile',
    timeframe: isHebrew ? 'טווח ניתוח' : 'Analysis range',
    marketData: isHebrew ? 'נתוני שוק' : 'Market data',
  }

  const changeColor = snapshot?.change >= 0 ? 'text-green-400' : 'text-red-400'
  const isUpdateStale = Boolean(lastUpdateTime && Date.now() - lastUpdateTime > 30000)
  const watchlistItems = useMemo(() => (
    watchlist?.length ? watchlist : [{ ticker: currentTicker }]
  ), [currentTicker, watchlist])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 3000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!intervalRefreshing) return undefined
    const timer = window.setTimeout(() => setIntervalRefreshing(false), 2000)
    return () => window.clearTimeout(timer)
  }, [intervalRefreshing, setIntervalRefreshing])

  useEffect(() => {
    if (!showWatchlistDropdown) return undefined

    function handleClickOutside(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setShowWatchlistDropdown(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setShowWatchlistDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showWatchlistDropdown])

  const updateLabel = lastUpdateTime
    ? formatDistanceToNow(lastUpdateTime, { addSuffix: true })
    : copy.loading

  function handleIntervalChange(nextInterval) {
    if (nextInterval === interval) return
    setInterval(nextInterval)
  }

  return (
    <header className="app-header" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="app-header__primary">
        <div className="app-header__mobile-brand" aria-label="Stock Sense">
          <span className="brand-mark brand-mark--small" aria-hidden="true"><span /><span /><span /></span>
          <strong>STOCK SENSE</strong>
        </div>

        <div className="header-quote">
          <StockLogo ticker={currentTicker} size="md" />
          <div className="header-quote__identity">
            <div className="flex min-w-0 items-center gap-2">
              <strong>{currentTicker || (isHebrew ? 'בחר מניה' : 'Choose ticker')}</strong>
              {isConnected && <span className="live-dot shrink-0" title={copy.live} />}
            </div>
            {snapshot?.name && <span>{snapshot.name}</span>}
          </div>
          {snapshot && (
            <div className="header-quote__price" dir="ltr">
              <strong>{fmtPrice(snapshot.price)}</strong>
              <span className={changeColor}>{fmtChange(snapshot.change, snapshot.changePct)}</span>
            </div>
          )}
          {isLoading && <span className="header-quote__loading">{copy.loading}</span>}
        </div>

        <div className="app-header__actions">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="header-action header-action--scanner md:hidden"
            aria-label={isHebrew ? 'פתח סורק מניות' : 'Open stock scanner'}
            title={isHebrew ? 'פתח סורק מניות' : 'Open stock scanner'}
          >
            <ScanSearch size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{isHebrew ? 'סורק' : 'Scanner'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSimpleMode(!simpleMode)}
            className="header-action header-action--mode"
          >
            <SlidersHorizontal size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{simpleMode ? copy.simpleModeOn : copy.simpleModeOff}</span>
          </button>

          {!simpleMode && (
            <button
              type="button"
              onClick={() => setProChart(!proChart)}
              className={`header-action ${proChart ? 'header-action--active' : ''}`}
              title={isHebrew ? 'החלף בין גרף Pro לגרף קלאסי' : 'Toggle Pro / Classic chart'}
            >
              <ChartNoAxesCombined size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{proChart ? (isHebrew ? 'גרף Pro' : 'Pro chart') : (isHebrew ? 'קלאסי' : 'Classic')}</span>
            </button>
          )}

          <div className="header-utility">
            <label className="header-utility__select">
              <span className="sr-only">{copy.display}</span>
              <Monitor size={16} strokeWidth={1.8} aria-hidden="true" />
              <select value={viewMode} onChange={event => setViewMode(event.target.value)} aria-label={copy.display}>
                <option value="auto">{copy.auto}</option>
                <option value="desktop">{copy.desktop}</option>
                <option value="mobile">{copy.mobile}</option>
              </select>
            </label>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowWatchlistDropdown(value => !value)}
                className="header-icon-button"
                aria-label={copy.watchlist}
                title={copy.watchlist}
              >
                <Bookmark size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {showWatchlistDropdown && (
                <div className="header-watchlist-menu">
                  <div className="header-watchlist-menu__title">{copy.watchlist}</div>
                  <div className="max-h-64 overflow-y-auto">
                    {watchlistItems.map(item => {
                      const ticker = item?.ticker ?? item
                      return (
                        <button
                          key={ticker}
                          type="button"
                          onClick={() => {
                            setCurrentTicker(ticker)
                            setShowWatchlistDropdown(false)
                          }}
                          className={`header-watchlist-item ${ticker === currentTicker ? 'header-watchlist-item--active' : ''}`}
                        >
                          <span>{ticker}</span>
                          {ticker === currentTicker && <small>{copy.live}</small>}
                        </button>
                      )
                    })}
                    {!watchlistItems.length && <div className="px-3 py-2 text-sm text-slate-500">{copy.noWatchlist}</div>}
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="header-icon-button" title={copy.switchTheme} aria-label={copy.switchTheme}>
              {theme === 'dark'
                ? <Sun size={16} strokeWidth={1.8} aria-hidden="true" />
                : <Moon size={16} strokeWidth={1.8} aria-hidden="true" />}
            </button>

            <button type="button" onClick={() => setLanguage(isHebrew ? 'en' : 'he')} className="header-language" title={copy.switchLanguage} aria-label={copy.switchLanguage}>
              {isHebrew ? 'EN' : 'עב'}
            </button>
          </div>
        </div>
      </div>

      <div className="app-header__range">
        <div className="app-header__range-label">
          <span>{copy.timeframe}</span>
          <small>{interval.toUpperCase()}</small>
        </div>
        <div className="timeframe-strip">
          {INTERVALS.map(iv => (
            <button
              key={iv}
              type="button"
              onClick={() => handleIntervalChange(iv)}
              className={`timeframe-button ${interval === iv ? 'timeframe-button--active' : ''} ${interval === iv && intervalRefreshing ? 'animate-pulse' : ''}`}
            >
              {INTERVAL_LABELS[language]?.[iv] ?? iv}
            </button>
          ))}
        </div>
        <div className={`app-header__freshness ${isUpdateStale ? 'app-header__freshness--stale' : ''}`}>
          <span className="app-header__freshness-dot" />
          <span className="hidden lg:inline">{copy.marketData} · </span>{updateLabel}
        </div>
      </div>

      {intervalRefreshing && <div className="app-header__refreshing">{copy.refreshHint}</div>}
    </header>
  )
}
