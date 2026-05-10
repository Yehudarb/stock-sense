import { create } from 'zustand'

const useStore = create((set) => ({
  currentTicker: localStorage.getItem('lastTicker') ?? 'AAPL',
  language: localStorage.getItem('dashboardLanguage') ?? 'he',
  interval: '5m',
  ohlcv: [],
  snapshot: null,
  watchlist: [],
  isLoading: false,
  error: null,

  setCurrentTicker: (ticker) => {
    localStorage.setItem('lastTicker', ticker)
    set({ currentTicker: ticker, ohlcv: [], snapshot: null, error: null })
  },
  setLanguage: (language) => {
    localStorage.setItem('dashboardLanguage', language)
    set({ language })
  },
  setInterval: (interval) => set({ interval, ohlcv: [], error: null }),
  setOhlcv: (ohlcv) => set({ ohlcv }),
  setSnapshot: (snapshotOrUpdater) =>
    set(state => ({
      snapshot: typeof snapshotOrUpdater === 'function'
        ? snapshotOrUpdater(state.snapshot)
        : snapshotOrUpdater,
    })),
  setWatchlist: (watchlist) => set({ watchlist }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addToWatchlist: (ticker) =>
    set(s => ({ watchlist: s.watchlist.find(w => w.ticker === ticker) ? s.watchlist : [...s.watchlist, { ticker }] })),
  removeFromWatchlist: (ticker) =>
    set(s => ({ watchlist: s.watchlist.filter(w => w.ticker !== ticker) })),
}))

export default useStore
