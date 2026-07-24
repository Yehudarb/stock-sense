import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react'
import { formatChartLabel } from './chartHelpers'
import { TRADER_COLORS } from '../../lib/traderColors'

const COLOR_SCHEME = {
  bullish: '#10b981',      // Green
  bearish: '#ef4444',      // Red
  neutral: '#6b7280',      // Gray
  support: TRADER_COLORS.support,
  resistance: TRADER_COLORS.resistance,
  bb_upper: '#8b5cf6',     // Purple
  bb_middle: '#6b7280',    // Gray
  bb_lower: '#8b5cf6',     // Purple
  sma20: '#fbbf24',        // Amber
  sma50: '#a78bfa',        // Violet
  sma200: '#60a5fa',       // Light Blue
  volume_positive: '#10b981aa',
  volume_negative: '#ef4444aa',
}

/**
 * Find pivot-based support/resistance instead of a naive min/max over a
 * tiny window. A bar is a pivot high/low if it's the extreme point within
 * `pivotSpan` bars on either side. We scan up to `lookback` bars and pick
 * the nearest pivot above/below the current price (falling back to the
 * window's overall high/low if no pivot qualifies).
 */
function findSupportResistance(bars, currentPrice, pivotSpan = 3, lookback = 100) {
  const window = bars.slice(-lookback)
  const pivotHighs = []
  const pivotLows = []

  for (let i = pivotSpan; i < window.length - pivotSpan; i++) {
    const slice = window.slice(i - pivotSpan, i + pivotSpan + 1)
    const centerHigh = window[i].high
    const centerLow = window[i].low
    if (centerHigh === Math.max(...slice.map(b => b.high))) pivotHighs.push(centerHigh)
    if (centerLow === Math.min(...slice.map(b => b.low))) pivotLows.push(centerLow)
  }

  const above = pivotHighs.filter(h => h > currentPrice).sort((a, b) => a - b)
  const below = pivotLows.filter(l => l < currentPrice).sort((a, b) => b - a)

  const resistance = above[0] ?? Math.max(...window.map(b => b.high))
  const support = below[0] ?? Math.min(...window.map(b => b.low))

  return { resistance, support }
}

/**
 * Advanced Price Chart Component - TradingView Level
 * Features:
 * - Japanese candles with precise OHLC (correctly scaled range bars)
 * - Volume bars with color coding, compressed to the bottom of the chart
 * - Multiple moving averages (SMA20, SMA50, SMA200)
 * - Bollinger Bands
 * - Pivot-based support/resistance levels
 * - Toggleable indicators
 * - Responsive grid layout
 */
export default function AdvancedPriceChart({
  ohlcv = [],
  indicators = {},
  signal = {},
  interval = '1d',
  language = 'en',
}) {
  const isHebrew = language === 'he'
  const [showIndicators, setShowIndicators] = useState({
    sma20: true,
    sma50: true,
    sma200: false,
    bb: true,
    volume: true,
  })

  // Prepare chart data. Hooks must run unconditionally on every render, so
  // this stays above any early return — it previously ran AFTER a
  // conditional `return`, which breaks React's Rules of Hooks whenever
  // `ohlcv` toggles between empty and populated.
  const chartData = useMemo(() => {
    return ohlcv.map((bar, i) => ({
      // bar.t is already a Unix millisecond timestamp — do NOT multiply by 1000
      t: bar.t,
      label: formatChartLabel(bar.t, interval),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,

      sma20: indicators?.sma20?.[i] ?? null,
      sma50: indicators?.sma50?.[i] ?? null,
      sma200: indicators?.sma200?.[i] ?? null,
      bbUpper: indicators?.bb20?.upper?.[i] ?? null,
      bbMiddle: indicators?.bb20?.middle?.[i] ?? null,
      bbLower: indicators?.bb20?.lower?.[i] ?? null,
    }))
  }, [ohlcv, indicators, interval])

  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const lastBar = chartData[chartData.length - 1]
    const prevBar = chartData[chartData.length - 2]
    const priceChange = lastBar.close - (prevBar?.close ?? lastBar.open)
    const priceChangePct = ((priceChange / (prevBar?.close ?? lastBar.open)) * 100).toFixed(2)

    const { resistance, support } = findSupportResistance(chartData, lastBar.close)
    const midline = (resistance + support) / 2

    const avgVolume = chartData.reduce((sum, b) => sum + (b.volume || 0), 0) / chartData.length
    const volumeRatio = avgVolume > 0 ? lastBar.volume / avgVolume : null

    return { lastBar, prevBar, priceChange, priceChangePct, resistance, support, midline, avgVolume, volumeRatio }
  }, [chartData])

  if (!ohlcv || ohlcv.length === 0 || !stats) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-12 flex items-center justify-center">
        <div className="text-slate-400">
          {isHebrew ? '📊 אין נתונים לתצוגה' : '📊 No data available'}
        </div>
      </div>
    )
  }

  const { lastBar, priceChange, priceChangePct, resistance, support, midline, volumeRatio } = stats

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null

    const data = payload[0].payload
    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 backdrop-blur-sm">
        <div className="text-xs font-bold text-slate-300 mb-2">{data.label}</div>

        <div className="space-y-1 text-xs">
          <div className="text-slate-400">
            <span className="text-slate-500">O:</span> ${data.open.toFixed(2)}
          </div>
          <div className="text-slate-400">
            <span className="text-slate-500">H:</span> ${data.high.toFixed(2)}
          </div>
          <div className="text-slate-400">
            <span className="text-slate-500">L:</span> ${data.low.toFixed(2)}
          </div>
          <div className={`font-bold ${data.close >= data.open ? 'text-green-400' : 'text-red-400'}`}>
            <span className="text-slate-500">C:</span> ${data.close.toFixed(2)}
          </div>

          {data.volume != null && (
            <div className="text-slate-500 mt-1 pt-1 border-t border-slate-700">
              Vol: {(data.volume / 1e6).toFixed(2)}M
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Price Info */}
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Current Price */}
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
              {isHebrew ? 'מחיר' : 'Price'}
            </div>
            <div className="text-2xl font-black text-white">
              ${lastBar.close.toFixed(2)}
            </div>
          </div>

          {/* Change */}
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
              {isHebrew ? 'שינוי' : 'Change'}
            </div>
            <div className={`text-2xl font-black flex items-center gap-1 ${
              priceChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct}%)
            </div>
          </div>

          {/* High/Low */}
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
              {isHebrew ? 'טווח' : 'Range'}
            </div>
            <div className="text-sm text-slate-300">
              <div>${lastBar.high.toFixed(2)} <span className="text-slate-500">high</span></div>
              <div>${lastBar.low.toFixed(2)} <span className="text-slate-500">low</span></div>
            </div>
          </div>

          {/* Volume */}
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
              {isHebrew ? 'נפח' : 'Volume'}
            </div>
            <div className="text-lg font-bold text-slate-300">
              {(lastBar.volume / 1e6).toFixed(1)}M
              {volumeRatio != null && (
                <span className={`ml-2 text-xs font-semibold ${
                  volumeRatio > 1.5 ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {volumeRatio.toFixed(1)}x {isHebrew ? 'ממוצע' : 'avg'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Indicator Toggles */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'sma20', label: 'SMA20', color: COLOR_SCHEME.sma20 },
          { key: 'sma50', label: 'SMA50', color: COLOR_SCHEME.sma50 },
          { key: 'sma200', label: 'SMA200', color: COLOR_SCHEME.sma200 },
          { key: 'bb', label: 'Bollinger', color: COLOR_SCHEME.bb_upper },
          { key: 'volume', label: 'Volume', color: COLOR_SCHEME.volume_positive },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setShowIndicators(prev => ({ ...prev, [key]: !prev[key] }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              showIndicators[key]
                ? 'bg-primary/20 text-primary border border-primary/50'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
            }`}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
            {showIndicators[key] ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 overflow-hidden">
        <div className="h-[600px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="#4b5563"
                minTickGap={40}
              />

              <YAxis
                yAxisId="left"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="#4b5563"
                width={60}
                domain={[(dataMin) => dataMin * 0.99, (dataMax) => dataMax * 1.01]}
              />

              {/* Volume axis: domain compressed to 4x max so bars only
                  occupy the bottom ~25% of the chart instead of overlapping
                  the candles. */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="#4b5563"
                width={70}
                domain={[0, (dataMax) => dataMax * 4]}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Support/Resistance Lines */}
              <ReferenceLine
                yAxisId="left"
                y={resistance}
                stroke={COLOR_SCHEME.resistance}
                strokeDasharray="5 5"
                label={{
                  value: `Resistance: $${resistance.toFixed(2)}`,
                  position: 'right',
                  fill: COLOR_SCHEME.resistance,
                  fontSize: 11,
                }}
              />

              <ReferenceLine
                yAxisId="left"
                y={support}
                stroke={COLOR_SCHEME.support}
                strokeDasharray="5 5"
                label={{
                  value: `Support: $${support.toFixed(2)}`,
                  position: 'right',
                  fill: COLOR_SCHEME.support,
                  fontSize: 11,
                }}
              />

              <ReferenceLine
                yAxisId="left"
                y={midline}
                stroke="#6b7280"
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              />

              {/* Volume Bars (rendered first so candles sit on top) */}
              {showIndicators.volume && (
                <Bar
                  yAxisId="right"
                  dataKey="volume"
                  isAnimationActive={false}
                  shape={<VolumeBarShape />}
                />
              )}

              {/* Japanese candlesticks: range bar spans [low, high] in
                  price space, and the custom shape draws the wick + body
                  using the pixel geometry Recharts computed for that
                  range — this is what makes open/close line up correctly. */}
              <Bar
                yAxisId="left"
                dataKey={(d) => [d.low, d.high]}
                isAnimationActive={false}
                shape={<CandleShape />}
              />

              {/* Moving Averages */}
              {showIndicators.sma20 && (
                <Line yAxisId="left" type="monotone" dataKey="sma20" stroke={COLOR_SCHEME.sma20} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              )}
              {showIndicators.sma50 && (
                <Line yAxisId="left" type="monotone" dataKey="sma50" stroke={COLOR_SCHEME.sma50} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              )}
              {showIndicators.sma200 && (
                <Line yAxisId="left" type="monotone" dataKey="sma200" stroke={COLOR_SCHEME.sma200} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              )}

              {/* Bollinger Bands */}
              {showIndicators.bb && (
                <>
                  <Line yAxisId="left" type="monotone" dataKey="bbUpper" stroke={COLOR_SCHEME.bb_upper} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="bbMiddle" stroke={COLOR_SCHEME.bb_middle} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="bbLower" stroke={COLOR_SCHEME.bb_lower} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg bg-slate-900/30 border border-slate-700/50 p-4">
        <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 md:grid-cols-5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.sma20 }} />
            <span className="text-slate-400">SMA20 (20d avg)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.sma50 }} />
            <span className="text-slate-400">SMA50 (50d avg)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.sma200 }} />
            <span className="text-slate-400">SMA200 (long trend)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.bb_upper }} />
            <span className="text-slate-400">Bollinger Bands</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="w-1.5 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.support }} />
              <div className="w-1.5 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.resistance }} />
            </div>
            <span className="text-slate-400">Support / Resistance</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Candle shape for a range-Bar whose dataKey resolves to [low, high].
 * Recharts maps that range onto (y, y+height) in pixel space, so:
 *   y          = pixel position of `high`
 *   y + height = pixel position of `low`
 * We interpolate open/close linearly within that span to place the body.
 */
function CandleShape(props) {
  const { x, y, width, height, payload } = props
  if (!payload) return null

  const { open, high, low, close } = payload
  if (high == null || low == null || high === low) return null

  const bullish = close >= open
  const color = bullish ? COLOR_SCHEME.bullish : COLOR_SCHEME.bearish

  const priceToY = (price) => y + height * ((high - price) / (high - low))

  const openY = priceToY(open)
  const closeY = priceToY(close)
  const bodyTop = Math.min(openY, closeY)
  const bodyHeight = Math.max(Math.abs(closeY - openY), 1)

  const bodyWidth = Math.max(width * 0.6, 1)
  const bodyX = x + (width - bodyWidth) / 2
  const wickX = x + width / 2

  return (
    <g>
      {/* Wick: full high-low range */}
      <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={color} strokeWidth={1} />
      {/* Body: open-close range */}
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} />
    </g>
  )
}

/** Volume bar colored per-candle (green if close >= open, red otherwise). */
function VolumeBarShape(props) {
  const { x, y, width, height, payload } = props
  if (!payload) return null

  const bullish = payload.close >= payload.open
  const color = bullish ? COLOR_SCHEME.volume_positive : COLOR_SCHEME.volume_negative

  return <rect x={x} y={y} width={width} height={height} fill={color} />
}
