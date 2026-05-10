import { useEffect } from 'react'
import axios from 'axios'
import useStore from '../../store/useStore'
import { fmtPrice, fmtPercent } from '../../lib/formatters'
import TickerSearch from './TickerSearch'

export default function WatchlistPanel() {
  const { watchlist, setWatchlist, currentTicker, setCurrentTicker, removeFromWatchlist } = useStore()

  useEffect(() => {
    axios.get('/api/watchlist').then(r => setWatchlist(r.data)).catch(() => {})
  }, [])

  const removeTicker = async (ticker) => {
    await axios.delete(`/api/watchlist/${ticker}`)
    removeFromWatchlist(ticker)
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <TickerSearch />
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {watchlist.map(w => (
          <div
            key={w.ticker}
            onClick={() => setCurrentTicker(w.ticker)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${
              w.ticker === currentTicker ? 'bg-blue-900' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <span className="font-bold text-white text-sm">{w.ticker}</span>
            <button
              onClick={e => { e.stopPropagation(); removeTicker(w.ticker) }}
              className="text-slate-500 hover:text-red-400 text-xs ml-2"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
