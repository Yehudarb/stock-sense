import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import useStore from '../../store/useStore'

export default function TickerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const { addToWatchlist } = useStore()
  const debounceRef = useRef(null)

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
        placeholder="חיפוש מניה..."
        className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder-slate-400"
        dir="rtl"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-700 rounded-lg shadow-xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.ticker}
              onClick={() => select(r.ticker)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-600 text-left"
            >
              <span className="font-bold text-white text-sm">{r.ticker}</span>
              <span className="text-slate-400 text-xs truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
