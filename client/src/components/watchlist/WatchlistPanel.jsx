import { useEffect } from 'react'
import axios from 'axios'
import useStore from '../../store/useStore'
import TickerSearch from './TickerSearch'
import StockLogo from '../ui/StockLogo'

export default function WatchlistPanel() {
  const { watchlist, setWatchlist, currentTicker, setCurrentTicker, removeFromWatchlist, language } = useStore()

  useEffect(() => {
    axios.get('/api/watchlist').then(r => setWatchlist(r.data)).catch(() => {})
  }, [])

  const removeTicker = async ticker => {
    await axios.delete(`/api/watchlist/${ticker}`)
    removeFromWatchlist(ticker)
  }

  return (
    <div className="flex flex-col gap-3 md:h-full">
      <TickerSearch />
      <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:flex-1 md:overflow-y-auto md:px-0">
        <div className="flex min-w-max gap-2 md:min-w-0 md:flex-col md:gap-1">
          {watchlist.map(w => (
            <div
              key={w.ticker}
              onClick={() => setCurrentTicker(w.ticker)}
              className={`flex min-w-[108px] items-center justify-between rounded-lg px-3 py-2 transition-colors md:min-w-0 md:cursor-pointer ${
                w.ticker === currentTicker ? 'bg-blue-900' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <StockLogo ticker={w.ticker} />
                <span className="text-sm font-bold text-white">{w.ticker}</span>
              </span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  removeTicker(w.ticker)
                }}
                className="ml-2 text-xs text-slate-400 hover:text-red-400"
                aria-label={language === 'he' ? `הסר ${w.ticker}` : `Remove ${w.ticker}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
