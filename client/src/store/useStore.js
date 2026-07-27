import { create } from 'zustand'

const useStore = create((set) => ({
  currentTicker: localStorage.getItem('lastTicker') ?? 'AAPL',
  language: localStorage.getItem('dashboardLanguage') ?? 'he',
  theme: localStorage.getItem('dashboardTheme') ?? 'dark',
  interval: '5m',
  ohlcv: [],
  snapshot: null,
  watchlist: [],
  isLoading: false,
  error: null,
  lastAnalysisAt: 0,
  lastLoadedTicker: null,
  analysisNonce: 0,
  lastUpdateTime: null,
  intervalRefreshing: false,
  simpleMode: localStorage.getItem('simpleMode')
    ? localStorage.getItem('simpleMode') === 'true'
    : (localStorage.getItem('lastTicker') ?? 'AAPL') === 'TSLL',
  // Cup & Handle scanner modal — open/close state; the scan runs when the
  // modal mounts, so this is the sole trigger for a fresh scan.
  showScanner: false,
  // Pro chart preference — persists to localStorage so the user's choice
  // between the TradingView-style engine and the legacy Chart.js one sticks.
  proChart: localStorage.getItem('proChart') !== 'false', // default ON

  setCurrentTicker: (ticker) => {
    localStorage.setItem('lastTicker', ticker)
    set(state => ({
      currentTicker: ticker,
      ohlcv: [],
      snapshot: null,
      error: null,
      lastAnalysisAt: Date.now(),
      analysisNonce: state.analysisNonce + 1,
      intervalRefreshing: false,
    }))
  },
  setSimpleMode: (simpleMode) => {
    localStorage.setItem('simpleMode', String(simpleMode))
    set({ simpleMode })
  },
  setShowScanner: (showScanner) => set({ showScanner }),
  setProChart: (proChart) => {
    localStorage.setItem('proChart', String(proChart))
    set({ proChart })
  },
  setLanguage: (language) => {
    localStorage.setItem('dashboardLanguage', language)
    set({ language })
  },
  setTheme: (theme) => {
    localStorage.setItem('dashboardTheme', theme)
    set({ theme })
  },
  setInterval: (interval) => set(state => ({
    interval,
    ohlcv: [],
    error: null,
    lastAnalysisAt: Date.now(),
    analysisNonce: state.analysisNonce + 1,
    intervalRefreshing: true,
  })),
  setOhlcv: (ohlcv) => set({ ohlcv, intervalRefreshing: false }),
  setSnapshot: (snapshotOrUpdater) =>
    set(state => {
      const nextSnapshot = typeof snapshotOrUpdater === 'function'
        ? snapshotOrUpdater(state.snapshot)
        : snapshotOrUpdater

      return {
        snapshot: nextSnapshot,
        lastUpdateTime: nextSnapshot ? Date.now() : state.lastUpdateTime,
      }
    }),
  setWatchlist: (watchlist) => set({ watchlist }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setLastLoadedTicker: (lastLoadedTicker) => set({ lastLoadedTicker }),
  setIntervalRefreshing: (intervalRefreshing) => set({ intervalRefreshing }),
  bumpAnalysisRun: () => set(state => ({ lastAnalysisAt: Date.now(), analysisNonce: state.analysisNonce + 1 })),

  addToWatchlist: (ticker) =>
    set(s => ({ watchlist: s.watchlist.find(w => w.ticker === ticker) ? s.watchlist : [...s.watchlist, { ticker }] })),
  removeFromWatchlist: (ticker) =>
    set(s => ({ watchlist: s.watchlist.filter(w => w.ticker !== ticker) })),
}))

export default useStore
