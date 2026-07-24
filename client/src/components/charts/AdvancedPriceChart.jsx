import { useMemo, useRef, useState } from 'react'
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
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatChartLabel, getWindowBounds } from './chartHelpers'
import { TRADER_COLORS } from '../../lib/traderColors'

const COLOR_SCHEME = {
  bullish: '#10b981',
  bearish: '#ef4444',
  support: TRADER_COLORS.support,
  resistance: TRADER_COLORS.resistance,
  bb_upper: '#8b5cf6',
  bb_middle: '#6b7280',
  bb_lower: '#8b5cf6',
  sma20: '#fbbf24',
  sma50: '#a78bfa',
  sma200: '#60a5fa',
  crosshair: '#94a3b8',
}

/**
 * Pivot-based support/resistance over the bars currently in view (not the
 * full history) so the levels are relevant to what's actually on screen.
 * A bar is a pivot high/low if it's the extreme point within `pivotSpan`
 * bars on either side.
 */
function findSupportResistance(bars, currentPrice, pivotSpan = 3) {
  const pivotHighs = []
  const pivotLows = []

  for (let i = pivotSpan; i < bars.length - pivotSpan; i++) {
    const slice = bars.slice(i - pivotSpan, i + pivotSpan + 1)
    const centerHigh = bars[i].high
    const centerLow = bars[i].low
    if (centerHigh === Math.max(...slice.map(b => b.high))) pivotHighs.push(centerHigh)
    if (centerLow === Math.min(...slice.map(b => b.low))) pivotLows.push(centerLow)
  }

  const above = pivotHighs.filter(h => h > currentPrice).sort((a, b) => a - b)
  const below = pivotLows.filter(l => l < currentPrice).sort((a, b) => b - a)

  const resistance = above[0] ?? Math.max(...bars.map(b => b.high))
  const support = below[0] ?? Math.min(...bars.map(b => b.low))

  return { resistance, support }
}

function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return ''
  return value >= 100 ? value.toFixed(1) : value.toFixed(2)
}

/**
 * Advanced Price Chart Component - candlesticks, moving averages,
 * Bollinger Bands, pivot support/resistance.
 *
 * Follows the same windowing/crosshair-sync contract as RsiChart/MacdChart
 * (visibleBars + viewOffset select the slice shown; hoveredIndex /
 * onHoverIndexChange use the LOCAL index within that slice) so the
 * existing preset buttons, pan controls, and keyboard shortcuts in
 * ChartWorkspace drive this chart the same way they drive the others.
 */
export default function AdvancedPriceChart({
  ohlcv = [],
  indicators = {},
  interval = '1d',
  language = 'en',
  showSMA = false,
  showBB = false,
  visibleBars,
  viewOffset = 0,
  hoveredIndex = null,
  onHoverIndexChange,
  onPanBars,
}) {
  const isHebrew = language === 'he'
  const containerRef = useRef(null)
  const dragState = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const { start, end } = useMemo(
    () => getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset),
    [ohlcv.length, visibleBars, viewOffset]
  )

  const chartData = useMemo(() => {
    return ohlcv.slice(start, end).map((bar, localIndex) => {
      const i = start + localIndex
      return {
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
      }
    })
  }, [ohlcv, indicators, interval, start, end])

  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const lastBar = chartData[chartData.length - 1]
    const prevBar = chartData[chartData.length - 2]
    const priceChange = lastBar.close - (prevBar?.close ?? lastBar.open)
    const priceChangePct = ((priceChange / (prevBar?.close ?? lastBar.open)) * 100).toFixed(2)

    const { resistance, support } = findSupportResistance(chartData, lastBar.close)

    const avgVolume = chartData.reduce((sum, b) => sum + (b.volume || 0), 0) / chartData.length
    const volumeRatio = avgVolume > 0 ? lastBar.volume / avgVolume : null

    return { lastBar, priceChange, priceChangePct, resistance, support, volumeRatio }
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

  const { lastBar, priceChange, priceChangePct, resistance, support, volumeRatio } = stats
  const hoveredLabel = hoveredIndex != null ? chartData[hoveredIndex]?.label : null

  // Drag-to-pan: convert horizontal pixel movement into bar counts and
  // forward the delta to the parent's panBy() via onPanBars.
  function handleMouseDown(event) {
    if (!onPanBars) return
    dragState.current = { startX: event.clientX, lastBarDelta: 0 }
    setIsDragging(true)
  }

  function handleMouseMove(event) {
    if (!dragState.current || !onPanBars || !containerRef.current) return
    const width = containerRef.current.getBoundingClientRect().width
    const pxPerBar = width / Math.max(chartData.length, 1)
    const totalDeltaPx = event.clientX - dragState.current.startX
    const barDelta = Math.round(totalDeltaPx / pxPerBar)

    if (barDelta !== dragState.current.lastBarDelta) {
      onPanBars(dragState.current.lastBarDelta - barDelta)
      dragState.current.lastBarDelta = barDelta
    }
  }

  function handleMouseUp() {
    dragState.current = null
    setIsDragging(false)
  }

  function handleChartMouseMove(state) {
    if (onHoverIndexChange && state?.isTooltipActive) {
      onHoverIndexChange(state.activeTooltipIndex ?? null)
    }
  }

  function handleChartMouseLeave() {
    onHoverIndexChange?.(null)
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null
    const data = payload[0].payload
    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 backdrop-blur-sm">
        <div className="text-xs font-bold text-slate-300 mb-2">{data.label}</div>
        <div className="space-y-1 text-xs">
          <div className="text-slate-400"><span className="text-slate-500">O:</span> ${data.open.toFixed(2)}</div>
          <div className="text-slate-400"><span className="text-slate-500">H:</span> ${data.high.toFixed(2)}</div>
          <div className="text-slate-400"><span className="text-slate-500">L:</span> ${data.low.toFixed(2)}</div>
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
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {/* Header with Price Info */}
      <div className="grid shrink-0 grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            {isHebrew ? 'מחיר' : 'Price'}
          </div>
          <div className="text-xl font-black text-white">${lastBar.close.toFixed(2)}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            {isHebrew ? 'שינוי' : 'Change'}
          </div>
          <div className={`text-xl font-black flex items-center gap-1 ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct}%)
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            {isHebrew ? 'טווח' : 'Range'}
          </div>
          <div className="text-sm text-slate-300">
            <div>${lastBar.high.toFixed(2)} <span className="text-slate-500">high</span></div>
            <div>${lastBar.low.toFixed(2)} <span className="text-slate-500">low</span></div>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            {isHebrew ? 'נפח' : 'Volume'}
          </div>
          <div className="text-sm font-bold text-slate-300">
            {(lastBar.volume / 1e6).toFixed(1)}M
            {volumeRatio != null && (
              <span className={`ml-2 text-xs font-semibold ${volumeRatio > 1.5 ? 'text-amber-400' : 'text-slate-500'}`}>
                {volumeRatio.toFixed(1)}x {isHebrew ? 'ממוצע' : 'avg'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div
        ref={containerRef}
        className={`min-h-0 w-full flex-1 ${onPanBars ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 55, left: 10, bottom: 10 }}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              stroke="#4b5563"
              minTickGap={50}
            />

            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              stroke="#4b5563"
              width={55}
              domain={[(dataMin) => dataMin * 0.99, (dataMax) => dataMax * 1.01]}
              tickFormatter={formatPrice}
              orientation="right"
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={resistance}
              stroke={COLOR_SCHEME.resistance}
              strokeDasharray="5 5"
              label={{ value: `R: $${formatPrice(resistance)}`, position: 'insideTopLeft', fill: COLOR_SCHEME.resistance, fontSize: 11 }}
            />
            <ReferenceLine
              y={support}
              stroke={COLOR_SCHEME.support}
              strokeDasharray="5 5"
              label={{ value: `S: $${formatPrice(support)}`, position: 'insideBottomLeft', fill: COLOR_SCHEME.support, fontSize: 11 }}
            />

            {/* Crosshair synced from other panels (RSI/MACD/Volume) */}
            {hoveredLabel && (
              <ReferenceLine x={hoveredLabel} stroke={COLOR_SCHEME.crosshair} strokeDasharray="3 3" />
            )}

            {/* Japanese candlesticks: range bar spans [low, high] in price
                space; CandleShape interpolates open/close within that
                pixel span so wicks and bodies line up correctly. */}
            <Bar dataKey={(d) => [d.low, d.high]} isAnimationActive={false} shape={<CandleShape />} />

            {showSMA && (
              <>
                <Line type="monotone" dataKey="sma20" stroke={COLOR_SCHEME.sma20} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line type="monotone" dataKey="sma50" stroke={COLOR_SCHEME.sma50} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line type="monotone" dataKey="sma200" stroke={COLOR_SCHEME.sma200} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </>
            )}

            {showBB && (
              <>
                <Line type="monotone" dataKey="bbUpper" stroke={COLOR_SCHEME.bb_upper} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
                <Line type="monotone" dataKey="bbMiddle" stroke={COLOR_SCHEME.bb_middle} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
                <Line type="monotone" dataKey="bbLower" stroke={COLOR_SCHEME.bb_lower} dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * Candle shape for a range-Bar whose dataKey resolves to [low, high].
 * Recharts maps that range onto (y, y+height) in pixel space, so:
 *   y          = pixel position of `high`
 *   y + height = pixel position of `low`
 * Open/close are interpolated linearly within that span to place the body.
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
      <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} />
    </g>
  )
}
