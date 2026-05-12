import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import useStore from '../../store/useStore'
import StockLogo from '../ui/StockLogo'

export default function TickerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const { addToWatchlist, language } = useStore()
  const debounceRef = useRef(null)
  const isHebrew = language === 'he'

  useEffect(() => {
    if (query.length < 1) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/market/search?q=${encodeURIComponent(query)}`)
        setResults(res.data)
        setOpen(true)
      } catch {}
    }, 300)
  }, [query])

  const select = async (ticker) => {
    await axios.post('/api/watchlist', { ticker })
    addToWatchlist(ticker)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={isHebrew ? 'חיפוש מניה...' : 'Search ticker...'}
        className="w-full bg-slate-900/60 border border-slate-800/50 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder-slate-500 focus:border-cyan-500/50 transition-colors"
        dir={isHebrew ? 'rtl' : 'ltr'}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 glass-panel shadow-xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.ticker}
              onClick={() => select(r.ticker)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60 transition-colors text-left"
            >
              <StockLogo ticker={r.ticker} />
              <span className="font-bold text-white text-sm">{r.ticker}</span>
              <span className="text-slate-400 text-xs truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
