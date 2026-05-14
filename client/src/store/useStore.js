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
  lastAnalysisAt: 0,
  lastLoadedTicker: null,
  analysisNonce: 0,

  setCurrentTicker: (ticker) => {
    localStorage.setItem('lastTicker', ticker)
    set(state => ({
      currentTicker: ticker,
      ohlcv: [],
      snapshot: null,
      error: null,
      lastAnalysisAt: Date.now(),
      analysisNonce: state.analysisNonce + 1,
    }))
  },
  setLanguage: (language) => {
    localStorage.setItem('dashboardLanguage', language)
    set({ language })
  },
  setInterval: (interval) => set(state => ({ interval, ohlcv: [], error: null, lastAnalysisAt: Date.now(), analysisNonce: state.analysisNonce + 1 })),
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
  setLastLoadedTicker: (lastLoadedTicker) => set({ lastLoadedTicker }),
  bumpAnalysisRun: () => set(state => ({ lastAnalysisAt: Date.now(), analysisNonce: state.analysisNonce + 1 })),

  addToWatchlist: (ticker) =>
    set(s => ({ watchlist: s.watchlist.find(w => w.ticker === ticker) ? s.watchlist : [...s.watchlist, { ticker }] })),
  removeFromWatchlist: (ticker) =>
    set(s => ({ watchlist: s.watchlist.filter(w => w.ticker !== ticker) })),
}))

export default useStore
