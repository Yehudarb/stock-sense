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

export const INTERVAL_BAR_LIMITS = {
  '1m': 200,
  '5m': 200,
  '15m': 200,
  '1h': 200,
  '4h': 200,
  '1d': 200,
  '1mo': 180,
  '1y': 320,
  '5y': 320,
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

export const SIGNAL_WEIGHTS = {
  RSI_OVERSOLD:       +2,
  RSI_WEAK:           +1,
  RSI_OVERBOUGHT:     -2,
  RSI_HOT:            -1,
  RSI_NEUTRAL:         0,
  MACD_CROSS_UP:      +2,
  MACD_CROSS_DOWN:    -2,
  MACD_ABOVE_SIGNAL:  +0.5,
  MACD_BELOW_SIGNAL:  -0.5,
  BB_BELOW_LOWER:     +2,
  BB_ABOVE_UPPER:     -2,
  BB_INSIDE:           0,
  SMA_EXTENDED_BELOW: +0.5,
  SMA_EXTENDED_ABOVE: -0.5,
}

export const SIGNAL_THRESHOLDS = {
  STRONG_BUY:   3.5,
  BUY:          1.5,
  SELL:        -1.5,
  STRONG_SELL: -3.5,
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
