import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import useStore from '../../store/useStore'
import { fmtPrice, fmtChange } from '../../lib/formatters'
import { INTERVALS } from '../../../../shared/constants'
import StockLogo from '../ui/StockLogo'

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
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 10h10M9 15h6M11 20h2" /></svg>
            <span>{isHebrew ? 'סורק' : 'Scanner'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSimpleMode(!simpleMode)}
            className="header-action header-action--mode"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M4 17h16M17 4v6M9 14v6" /></svg>
            <span>{simpleMode ? copy.simpleModeOn : copy.simpleModeOff}</span>
          </button>

          {!simpleMode && (
            <button
              type="button"
              onClick={() => setProChart(!proChart)}
              className={`header-action ${proChart ? 'header-action--active' : ''}`}
              title={isHebrew ? 'החלף בין גרף Pro לגרף קלאסי' : 'Toggle Pro / Classic chart'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V9m5 9V5m5 13v-7m5 7V3" /></svg>
              <span>{proChart ? (isHebrew ? 'גרף Pro' : 'Pro chart') : (isHebrew ? 'קלאסי' : 'Classic')}</span>
            </button>
          )}

          <div className="header-utility">
            <label className="header-utility__select">
              <span className="sr-only">{copy.display}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v12H3zM8 21h8M12 17v4" /></svg>
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
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z" /></svg>
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
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={theme === 'dark' ? 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8' : 'M19 15a7 7 0 0 1-10-10 8 8 0 1 0 10 10'} /></svg>
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
