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
  } = useStore()

  const isHebrew = language === 'he'
  const copy = {
    loading: isHebrew ? 'טוען...' : 'Loading...',
    range: isHebrew ? 'טווח' : 'Range',
    language: isHebrew ? 'EN' : 'עב',
    switchLanguage: isHebrew ? 'Switch to English' : 'לעבור לעברית',
    switchTheme: isHebrew ? 'החלף ערכת נושא' : 'Toggle theme',
    watchlist: isHebrew ? 'רשימת מעקב' : 'Watchlist',
    live: isHebrew ? 'חי' : 'Live',
    noWatchlist: isHebrew ? 'אין עדיין סימבולים שמורים' : 'No saved symbols yet',
    lastUpdate: isHebrew ? 'עדכון אחרון' : 'Last update',
    refreshHint: isHebrew ? 'הנתונים מתרעננים עבור הטווח שנבחר' : 'Refreshing data for the selected range',
  }

  const changeColor = snapshot?.change >= 0 ? 'text-green-400' : 'text-red-400'
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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showWatchlistDropdown])

  const updateLabel = lastUpdateTime
    ? formatDistanceToNow(lastUpdateTime, { addSuffix: true })
    : copy.loading

  function handleIntervalChange(nextInterval) {
    if (nextInterval === interval) return
    setInterval(nextInterval)
  }

  return (
    <div className="border-b border-white/5 bg-surface/80 px-3 py-3 backdrop-blur-md sm:px-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:justify-start xl:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {isConnected && <span className="live-dot shrink-0" />}
            <StockLogo ticker={currentTicker} size="md" />
            <span className="text-lg font-bold tracking-tight text-white sm:text-xl">{currentTicker}</span>
            {snapshot?.name && (
              <span className="truncate text-xs text-slate-400 sm:text-sm">{snapshot.name}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {snapshot && (
              <>
                <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {fmtPrice(snapshot.price)}
                </span>
                <span className={`text-sm font-medium ${changeColor}`}>
                  {fmtChange(snapshot.change, snapshot.changePct)}
                </span>
              </>
            )}
            {isLoading && <span className="text-sm text-slate-500">{copy.loading}</span>}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max flex-wrap items-center gap-2 pb-1">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowWatchlistDropdown(value => !value)}
                className="rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-slate-300 transition-colors hover:bg-surface-bright"
              >
                {copy.watchlist} ▾
              </button>
              {showWatchlistDropdown && (
                <div className="absolute top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-md">
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
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                            ticker === currentTicker
                              ? 'bg-primary/20 text-white'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span>{ticker}</span>
                          {ticker === currentTicker && <span className="text-[11px] text-primary">{copy.live}</span>}
                        </button>
                      )
                    })}
                    {!watchlistItems.length && (
                      <div className="px-3 py-2 text-sm text-slate-500">{copy.noWatchlist}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-slate-300 transition-colors hover:bg-surface-bright"
              title={copy.switchTheme}
              aria-label={copy.switchTheme}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>

            <button
              type="button"
              onClick={() => setLanguage(isHebrew ? 'en' : 'he')}
              className="rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-slate-300 transition-colors hover:bg-surface-bright"
              title={copy.switchLanguage}
              aria-label={copy.switchLanguage}
            >
              {copy.language}
            </button>

            <span className="hidden text-xs font-bold uppercase tracking-wider text-slate-500 md:inline">{copy.range}</span>
            {INTERVALS.map(iv => (
              <button
                key={iv}
                type="button"
                onClick={() => handleIntervalChange(iv)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all sm:text-sm ${
                  interval === iv
                    ? `bg-primary text-surface-muted shadow-[0_0_10px_rgba(34,211,238,0.3)] ${intervalRefreshing ? 'animate-pulse' : ''}`
                    : 'text-slate-400 hover:bg-surface-bright/50 hover:text-white'
                }`}
              >
                {INTERVAL_LABELS[language]?.[iv] ?? iv}
              </button>
            ))}

            <span className="hidden text-xs text-slate-500 xl:inline">
              {copy.lastUpdate}: {updateLabel}
            </span>
          </div>

          {intervalRefreshing && (
            <div className="mt-1 text-xs text-primary/90">{copy.refreshHint}</div>
          )}
        </div>
      </div>
    </div>
  )
}
