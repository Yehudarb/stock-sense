export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1mo', '1y', '5y']

export const YAHOO_INTERVAL_MAP = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '1h':  '60m',
  '4h':  '60m',
  '1d':  '1d',
  '1mo': '1d',
  '1y':  '1d',
  '5y':  '1wk',
}

export const INTERVAL_LOOKBACK_DAYS = {
  '1m':  7,
  '5m':  60,
  '15m': 60,
  '1h':  730,
  '4h':  730,
  '1d':  1825,
  '1mo': 180,
  '1y':  365,
  '5y':  1825,
}

// These are FETCH sizes, not display sizes — how much history is loaded so the
// indicators have a warmup runway. What the user actually sees is the far
// smaller `visibleBars` of the selected preset in ChartWorkspace.
//
// The longest warmup in the set is SMA200 / EMA200 at 200 bars, and the widest
// window is 180 bars (1H / 4H), so anything below ~380 leaves the 200-period
// lines with too few points to draw. At the old value of 200 they resolved to
// exactly ONE valid value on every intraday and daily view — a single point
// renders as nothing, which is why a 200-line appeared on some periods and
// vanished on others. 400 is the server's per-request ceiling
// (parseLimit in server/routes/market.js) and clears every window we offer.
const WARMUP_BARS = 200
export const MIN_WARMUP_BARS = WARMUP_BARS

export const INTERVAL_BAR_LIMITS = {
  '1m': 400,
  '5m': 400,
  '15m': 400,
  '1h': 400,
  '4h': 400,
  '1d': 400,
  '1mo': 380,
  '1y': 400,
  '5y': 400,
}

export const CACHE_TTL = {
  snapshot: 5,
  bars_intraday: 30,
  bars_daily: 3600,
  search: 300,
}

export const INDICATOR_PARAMS = {
  RSI:    { period: 14 },
  MACD:   { fast: 12, slow: 26, signal: 9 },
  BB:     { period: 20, stdDev: 2 },
  SMA:    { period: 20 },
  EMA:    { period: 50 },
  VOLUME: { avgPeriod: 20 },
}

export const VOLUME_MULTIPLIER_TRIGGER = 1.5
export const VOLUME_MULTIPLIER = 1.2

export const SIGNAL_ACTIONS = {
  STRONG_BUY:  'קנייה חזקה',
  BUY:         'קנייה',
  HOLD:        'המתנה',
  SELL:        'מכירה',
  STRONG_SELL: 'מכירה חזקה',
}

export const SIGNAL_BADGES = {
  STRONG_BUY:  'קנייה חזקה ↑↑',
  BUY:         'קנייה ↑',
  HOLD:        'המתנה —',
  SELL:        'מכירה ↓',
  STRONG_SELL: 'מכירה חזקה ↓↓',
}

export const SIGNAL_COLORS = {
  STRONG_BUY:  { bg: '#dcfce7', text: '#166534', border: '#16a34a' },
  BUY:         { bg: '#f0fdf4', text: '#15803d', border: '#22c55e' },
  HOLD:        { bg: '#fefce8', text: '#854d0e', border: '#eab308' },
  SELL:        { bg: '#fff7f7', text: '#b91c1c', border: '#ef4444' },
  STRONG_SELL: { bg: '#fee2e2', text: '#991b1b', border: '#dc2626' },
}

export const CHART_COLORS = {
  price:     '#378add',
  sma20:     '#EF9F27',
  ema50:     '#8b5cf6',
  bbUpper:   'rgba(99,153,34,0.45)',
  bbLower:   'rgba(99,153,34,0.45)',
  bbFill:    'rgba(99,153,34,0.08)',
  rsi:       '#378add',
  macdLine:  '#378add',
  macdSig:   '#E24B4A',
  bullish:   'rgba(99,153,34,0.65)',
  bearish:   'rgba(226,75,74,0.65)',
  volBull:   'rgba(99,153,34,0.65)',
  volBear:   'rgba(226,75,74,0.65)',
}

export const DEFAULT_WATCHLIST = [
  'AAPL',
  'TSLA',
  'TSLL',
  'NVDA',
  'MSFT',
  'SPY',
  'QQQ',
  'AMD',
  'META',
  'GOOGL',
  'AMZN',
  'NFLX',
  'AVGO',
  'SMCI',
  'PLTR',
  'SOXL',
  'TQQQ',
]
export const DEFAULT_TICKER   = 'AAPL'
export const DEFAULT_INTERVAL = '5m'
export const DEFAULT_BARS     = 200
