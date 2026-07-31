export function formatChartLabel(timestamp, interval) {
  const date = new Date(timestamp)
  const datePart = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  const timePart = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (['1m', '5m', '15m', '1h', '4h'].includes(interval)) {
    return `${datePart} ${timePart}`
  }

  if (interval === '1y' || interval === '5y') {
    return date.toLocaleDateString('he-IL', { month: '2-digit', year: '2-digit' })
  }

  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function labelsFromBars(ohlcv, interval) {
  return ohlcv.map(bar => formatChartLabel(bar.t, interval))
}

export function formatTooltipDate(timestamp, interval) {
  const date = new Date(timestamp)

  if (['1m', '5m', '15m', '1h', '4h'].includes(interval)) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function seriesFromBars(ohlcv, key) {
  return ohlcv.map(bar => bar[key])
}

export function seriesFromIndicator(values) {
  return values?.map(value => value ?? null) ?? []
}

// Shared by PriceChart and TradingViewChart so both engines draw the same
// Fibonacci grid from the same definition instead of drifting apart.
export const FIB_LEVELS = [
  { ratio: 0, label: '0%' },
  { ratio: 0.236, label: '23.6%' },
  { ratio: 0.382, label: '38.2%' },
  { ratio: 0.5, label: '50%' },
  { ratio: 0.618, label: '61.8%' },
  { ratio: 0.786, label: '78.6%' },
  { ratio: 1, label: '100%' },
]

// Splits detected patterns between the two toggles that render them:
// "קו מגמה" (trendline) gets everything drawn as sloping or converging lines,
// and "סימוני תבניות" gets the named formations and candlestick signals.
//
// This used to test only for TRIANGLE, which is why the trendline toggle looked
// dead: across TSLA, NVDA, SPY and AAPL the detector produced CHANNEL_*,
// *_WEDGE and TRENDLINE_BREAK_* but no TRIANGLE key at all, so every pattern
// fell through to the other toggle and the trendline button matched nothing.
const TRENDLINE_KEY_PARTS = ['TRENDLINE', 'TRIANGLE', 'CHANNEL', 'WEDGE']

export function isTrendlinePattern(pattern) {
  const key = pattern?.key
  if (typeof key === 'string' && TRENDLINE_KEY_PARTS.some(part => key.includes(part))) return true
  // detectPivotTriangles tags its output with meta.type instead of a key.
  return Boolean(pattern?.meta?.type)
}

// Anchors the retracement on the extreme high/low of the supplied bars. Which
// bars those are is the caller's choice: PriceChart passes its visible window,
// the Pro chart passes the full series because its zoom is chart-native.
export function computeFibonacci(ohlcv, includeExtensions = false) {
  if (!ohlcv?.length || ohlcv.length < 5) return null

  const highPoint = ohlcv.reduce((best, bar, index) => (
    bar.h > best.price ? { index, price: bar.h } : best
  ), { index: 0, price: ohlcv[0].h })
  const lowPoint = ohlcv.reduce((best, bar, index) => (
    bar.l < best.price ? { index, price: bar.l } : best
  ), { index: 0, price: ohlcv[0].l })
  const range = highPoint.price - lowPoint.price

  if (!Number.isFinite(range) || range <= 0) return null

  const trend = lowPoint.index < highPoint.index ? 'up' : 'down'
  const extensionLevels = includeExtensions
    ? [
        { ratio: 1.272, label: '127.2%' },
        { ratio: 1.618, label: '161.8%' },
      ]
    : []
  const levels = [...FIB_LEVELS, ...extensionLevels].map(level => ({
    ...level,
    price: trend === 'up'
      ? highPoint.price - range * level.ratio
      : lowPoint.price + range * level.ratio,
  }))

  return {
    trend,
    anchorA: trend === 'up' ? lowPoint : highPoint,
    anchorB: trend === 'up' ? highPoint : lowPoint,
    levels,
  }
}

// ── Overlay palette ──────────────────────────────────────────────────────
//
// One palette, used by whatever draws the line AND by the legend that names it.
// They were separate before, and every shared key disagreed: the legend showed
// SMA50 in yellow while the Pro chart drew it in blue, SMA200 in indigo against
// pink, and so on for all seven overlapping entries. A legend that names the
// wrong colour is worse than no legend, because it is read as fact.
//
// Colours are also distinct ACROSS families, which they were not. SMA20 and the
// Ichimoku conversion line were the same amber, SMA50 and the Ichimoku base the
// same blue, and EMA20, Supertrend-up and pivot R1 were all the same green — so
// turning on two families produced lines that could not be told apart.
// Band pairs (Bollinger, Keltner, Donchian) deliberately share a hue: they are
// one instrument with two edges.
export const OVERLAY_COLORS = {
  candles: '#10b981',
  line: '#38bdf8',
  area: '#818cf8',

  // Moving averages — one hue family, stepping darker with period.
  sma20:  '#fbbf24',
  sma50:  '#f97316',
  sma100: '#e11d48',
  sma150: '#14b8a6',
  sma200: '#ec4899',
  ema20:  '#4ade80',
  ema50:  '#16a34a',
  ema200: '#7c3aed',
  wma20:  '#facc15',
  wma50:  '#a16207',

  // Bands.
  bbUpper: '#94a3b8', bbMiddle: '#64748b', bbLower: '#94a3b8',
  keltnerUpper: '#0ea5e9', keltnerMiddle: '#7dd3fc', keltnerLower: '#0ea5e9',
  donchianUpper: '#f472b6', donchianMiddle: '#f9a8d4', donchianLower: '#f472b6',

  // Standalone studies.
  vwap: '#22d3ee',
  supertrendUp: '#22c55e',
  supertrendDown: '#dc2626',
  ichimokuTenkan: '#c084fc',
  ichimokuKijun: '#2563eb',
  ichimokuSpanA: 'rgba(16, 185, 129, 0.5)',
  ichimokuSpanB: 'rgba(239, 68, 68, 0.5)',

  // Levels.
  pivot: '#cbd5e1', pivotR1: '#84cc16', pivotS1: '#fb7185',
  prevHigh: '#67e8f9', prevLow: '#fdba74',
  high52: '#a3e635', low52: '#f43f5e',

  // Legend-only entries: the classic chart and the sub-panels name these, and a
  // missing key renders a swatch with no colour at all.
  supertrend: '#22c55e',
  levels: '#5eead4',
  previousHigh: '#67e8f9',
  previousLow: '#fdba74',
  volume: '#8b98a9',
  volumeMA: '#e879f9',
  rsi: '#d8b4fe',
  macd: '#60a5fa',
  macdSignal: '#fb923c',
}

// ── Measured-move targets ────────────────────────────────────────────────
//
// Classic measured move: take the height of the structure price is breaking
// out of, and project it from the breakout level.
//
// Three anchors are emitted rather than one, and this is the whole point. The
// technique is only as good as the low you measure from, and that choice is
// analyst judgment, not arithmetic — on SCHW the plausible anchors spanned
// targets from 117 to 174, and letting an algorithm pick "the lowest low" on
// its own produced 401, because it happily measured the entire series. Naming
// the anchor next to each number is what makes the number readable: you can
// see which structure it assumes and reject it if you disagree.

const PIVOT_WINDOW = 8
const YEAR_BARS = 252
// A base must undercut the 52-week low by at least this much to count as a
// distinct structure rather than the same one measured slightly differently.
const MIN_BASE_SEPARATION = 0.05

function swingLows(bars, k = PIVOT_WINDOW) {
  const out = []
  for (let i = k; i < bars.length - k; i += 1) {
    const window = bars.slice(i - k, i + k + 1)
    if (bars[i].l === Math.min(...window.map(b => b.l))) out.push({ index: i, price: bars[i].l })
  }
  return out
}

/**
 * @param {Array}  ohlcv
 * @param {number} breakoutLevel  the level being broken — projections start here
 * @param {string} direction      'bullish' | 'bearish'
 * @returns {Array} [{ key, label, price, basis }] ordered nearest-first
 */
export function measuredMoveTargets(ohlcv, breakoutLevel, direction = 'bullish') {
  if (!Array.isArray(ohlcv) || ohlcv.length < 30) return []
  if (!Number.isFinite(breakoutLevel) || breakoutLevel <= 0) return []

  // Bullish only, and this is a restriction on meaning rather than a guard.
  // Projecting a base height is the measured move for price breaking UP out of
  // a base. Subtracting that same height from a topping pattern is not the same
  // technique wearing a minus sign: measured against TSLA's multi-year base it
  // produced a target of 84.02 with price at 305.21, a 72% collapse asserted
  // from arithmetic alone. A topping pattern already carries its own classic
  // measured move — neckline minus head-to-neckline — and that is the number
  // worth drawing, so bearish setups keep their pattern target and get nothing
  // manufactured on top of it.
  if (direction === 'bearish') return []
  const bullish = true

  const recent = ohlcv.slice(-YEAR_BARS)
  const yearHigh = Math.max(...recent.map(b => b.h))
  const yearLow = Math.min(...recent.map(b => b.l))
  if (!Number.isFinite(yearHigh) || !Number.isFinite(yearLow)) return []

  const targets = []
  const project = (height, key, label, basis) => {
    if (!Number.isFinite(height) || height <= 0) return
    const price = bullish ? breakoutLevel + height : breakoutLevel - height
    if (!Number.isFinite(price) || price <= 0) return
    targets.push({ key, label, price, basis })
  }

  // Anchor 1 — the 52-week range. The structure everyone can see.
  project(
    yearHigh - yearLow,
    'range52',
    '52w',
    `${yearLow.toFixed(2)}–${yearHigh.toFixed(2)}`,
  )

  // Anchor 2 — the base the current advance started from: the deepest swing low
  // in the available history that sits meaningfully below the 52-week low. A
  // pivot rather than the raw minimum, so a single spike cannot define the
  // base, and a separation floor so a low that undercuts the year by a fraction
  // of a percent does not count as a wider structure — it is the same base, and
  // it would draw a second line within noise of the first. Absent when no such
  // low exists, which is the honest answer: no wider base in view, no wider
  // target.
  const deeper = swingLows(ohlcv).filter(p => p.price < yearLow * (1 - MIN_BASE_SEPARATION))
  if (deeper.length) {
    const baseLow = deeper.reduce((min, p) => (p.price < min.price ? p : min), deeper[0])
    project(
      yearHigh - baseLow.price,
      'base',
      'base',
      `${baseLow.price.toFixed(2)}–${yearHigh.toFixed(2)}`,
    )
  }

  return targets.sort((a, b) => (bullish ? a.price - b.price : b.price - a.price))
}

export function getWindowBounds(total, visibleBars, viewOffset = 0, minBars = 20) {
  const safeVisible = Math.min(total, Math.max(minBars, visibleBars ?? total))
  const maxOffset = Math.max(0, total - safeVisible)
  const safeOffset = Math.min(maxOffset, Math.max(0, viewOffset))
  const end = total - safeOffset
  const start = Math.max(0, end - safeVisible)

  return {
    start,
    end,
    size: end - start,
    maxOffset,
    offset: safeOffset,
  }
}

export function getChartPalette(theme = 'dark') {
  if (theme === 'light') {
    return {
      tick: 'rgba(51, 65, 85, 0.92)',
      grid: 'rgba(148, 163, 184, 0.18)',
      border: 'rgba(148, 163, 184, 0.32)',
      tooltipBg: 'rgba(255, 255, 255, 0.98)',
      tooltipBorder: 'rgba(148, 163, 184, 0.28)',
      tooltipTitle: '#0f172a',
      tooltipBody: '#334155',
      crosshair: 'rgba(71, 85, 105, 0.35)',
      panelTop: '#f8fbff',
      panelBottom: '#eef4fb',
    }
  }

  return {
    tick: 'rgba(148, 163, 184, 0.92)',
    grid: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.14)',
    tooltipBg: 'rgba(2, 6, 23, 0.96)',
    tooltipBorder: 'rgba(148, 163, 184, 0.16)',
    tooltipTitle: '#f8fafc',
    tooltipBody: '#cbd5e1',
    crosshair: 'rgba(148, 163, 184, 0.35)',
    panelTop: '#07111f',
    panelBottom: '#050c17',
  }
}

export function categoryXAxis(maxTicksLimit = 8, theme = 'dark') {
  const palette = getChartPalette(theme)
  return {
    type: 'category',
    ticks: {
      color: palette.tick,
      maxTicksLimit,
      font: { size: 11 },
      autoSkip: true,
      maxRotation: 0,
    },
    grid: { color: palette.grid, drawTicks: false },
    border: { color: palette.border },
  }
}

export function rightYAxis(extra = {}, theme = 'dark') {
  const palette = getChartPalette(theme)
  return {
    position: 'right',
    ticks: {
      color: palette.tick,
      font: { size: 11 },
      padding: 6,
      ...(extra.ticks ?? {}),
    },
    grid: { color: palette.grid, drawTicks: false },
    border: { color: palette.border },
    ...extra,
  }
}

export function createCrosshairPlugin(id = 'syncedCrosshair') {
  return {
    id,
    afterDraw(chart, _args, options) {
      const index = options?.index
      const palette = getChartPalette(options?.theme)
      if (index == null) return

      const xScale = chart.scales?.x
      const yScale = chart.scales?.y
      const x = xScale?.getPixelForValue(index)
      if (!Number.isFinite(x) || !yScale) return

      const { ctx, chartArea } = chart
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.strokeStyle = palette.crosshair
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    },
  }
}
