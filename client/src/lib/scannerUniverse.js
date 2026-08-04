// Lightweight validation universe used by the client-side backtest panel.
// The market-wide Cup & Handle scanner no longer relies on this list: its
// server job discovers the live Nasdaq/Yahoo universe, applies the $2B size
// threshold and scans batched history. Keep this compact list for fast local
// validation and for merging a user's watchlist without a full market scan.
//
// Curation criteria:
//   • US-listed common stock or major ETF (excludes ADRs whose OHLCV Yahoo
//     often serves with gaps that break pattern detection)
//   • Reasonable dollar volume (>$50M/day typical)
//   • Priced above ~$10 (penny-name detectors are a different beast)
//   • Broad sector coverage so a single sector's regime doesn't dominate results
export const SCANNER_UNIVERSE = [
  // Mega-cap tech
  'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'AVGO', 'ORCL', 'ADBE', 'CRM',
  // Semis / hardware
  'AMD', 'TSM', 'ASML', 'QCOM', 'INTC', 'AMAT', 'LRCX', 'MU', 'MRVL', 'ARM',
  // Software / cloud / cyber
  'NOW', 'SNOW', 'PLTR', 'PANW', 'CRWD', 'ZS', 'FTNT', 'DDOG', 'NET', 'MDB',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'SCHW', 'BLK', 'AXP', 'V', 'MA', 'PYPL',
  // Consumer / retail
  'TSLA', 'HD', 'LOW', 'COST', 'WMT', 'TGT', 'NKE', 'SBUX', 'MCD', 'CMG', 'ABNB',
  // Communications / streaming
  'NFLX', 'DIS', 'ROKU', 'SPOT', 'TMUS',
  // Healthcare / biotech
  'UNH', 'JNJ', 'LLY', 'PFE', 'ABBV', 'TMO', 'DHR', 'ISRG', 'REGN',
  // Industrials / defense / transports
  'CAT', 'DE', 'BA', 'LMT', 'RTX', 'GE', 'HON', 'UBER', 'FDX',
  // Energy / commodities
  'XOM', 'CVX', 'COP', 'FCX', 'SLB',
  // Broad-market ETFs (useful as regime anchors on the scanner)
  'SPY', 'QQQ', 'IWM', 'DIA',
]

// Merge the curated universe with any tickers already in the watchlist so users
// see their own picks in the scanner results without extra clicks.
export function buildScanUniverse(watchlist = []) {
  const set = new Set(SCANNER_UNIVERSE)
  for (const t of watchlist) {
    if (typeof t === 'string' && t.trim()) set.add(t.trim().toUpperCase())
  }
  return [...set]
}
