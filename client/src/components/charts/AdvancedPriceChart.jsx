import { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react'
import { TRADER_TEXT } from '../../lib/traderColors'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ResponsiveContainer
)

const COLOR_SCHEME = {
  bullish: '#10b981',      // Green
  bearish: '#ef4444',      // Red
  neutral: '#6b7280',      // Gray
  support: '#3b82f6',      // Blue
  resistance: '#f59e0b',   // Amber
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
 * Advanced Price Chart Component - TradingView Level
 * Features:
 * - Japanese candles with precise OHLC
 * - Volume bars with color coding
 * - Multiple moving averages (SMA20, SMA50, SMA200)
 * - Bollinger Bands
 * - Support/Resistance levels
 * - Price labels and annotations
 * - Toggleable indicators
 * - Responsive grid layout
 */
export default function AdvancedPriceChart({
  ohlcv = [],
  indicators = {},
  signal = {},
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

  if (!ohlcv || ohlcv.length === 0) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-12 flex items-center justify-center">
        <div className="text-slate-400">
          {isHebrew ? '📊 אין נתונים לתצוגה' : '📊 No data available'}
        </div>
      </div>
    )
  }

  // Prepare chart data
  const chartData = useMemo(() => {
    const n = ohlcv.length
    return ohlcv.map((bar, i) => {
      const date = new Date(bar.t * 1000)
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

      return {
        t: bar.t,
        time: timeStr,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,

        // Indicators
        sma20: indicators?.sma20?.[i] || null,
        sma50: indicators?.sma50?.[i] || null,
        sma200: indicators?.sma200?.[i] || null,
        bbUpper: indicators?.bb20?.upper?.[i] || null,
        bbMiddle: indicators?.bb20?.middle?.[i] || null,
        bbLower: indicators?.bb20?.lower?.[i] || null,

        // Volume color (green if close > open, red if close < open)
        volumeColor: bar.c >= bar.o ? COLOR_SCHEME.volume_positive : COLOR_SCHEME.volume_negative,
      }
    })
  }, [ohlcv, indicators])

  if (chartData.length === 0) return null

  const lastBar = chartData[chartData.length - 1]
  const prevBar = chartData[chartData.length - 2]
  const priceChange = lastBar.close - (prevBar?.close || lastBar.open)
  const priceChangePct = ((priceChange / (prevBar?.close || lastBar.open)) * 100).toFixed(2)

  // Support and Resistance (from last 20 bars)
  const last20 = chartData.slice(-20)
  const resistance = Math.max(...last20.map(b => b.high))
  const support = Math.min(...last20.map(b => b.low))
  const midline = (resistance + support) / 2

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null

    const data = payload[0].payload
    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 backdrop-blur-sm">
        <div className="text-xs font-bold text-slate-300 mb-2">{data.time}</div>

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

          {data.volume && (
            <div className="text-slate-500 mt-1 pt-1 border-t border-slate-700">
              Vol: {(data.volume / 1e6).toFixed(1)}M
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
            style={showIndicators[key] ? { borderColor: color + '80' } : {}}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
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
              margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
              style={{ backgroundColor: 'transparent' }}
            >
              {/* Grid */}
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_SCHEME.volume_positive} />
                  <stop offset="100%" stopColor={COLOR_SCHEME.volume_positive} stopOpacity="0.1" />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="time"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="#4b5563"
                interval={Math.floor(chartData.length / 8)}
              />

              <YAxis
                yAxisId="left"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="#4b5563"
                width={60}
                domain="dataMin => [dataMin * 0.99, dataMax => dataMax * 1.01]"
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="#4b5563"
                width={80}
                label={{ value: 'Volume', angle: 90, position: 'insideRight', offset: -10, fill: '#6b7280' }}
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
                  offset: 5,
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
                  offset: 5,
                }}
              />

              <ReferenceLine
                yAxisId="left"
                y={midline}
                stroke="#6b7280"
                strokeDasharray="3 3"
                strokeOpacity="0.3"
              />

              {/* Price Candles (simplified as bars for now) */}
              <Bar
                yAxisId="left"
                dataKey="close"
                fill={COLOR_SCHEME.bullish}
                stroke={COLOR_SCHEME.bullish}
                isAnimationActive={false}
                shape={<CandleShape />}
              />

              {/* Volume Bars */}
              {showIndicators.volume && (
                <Bar
                  yAxisId="right"
                  dataKey="volume"
                  fill={COLOR_SCHEME.volume_positive}
                  opacity="0.3"
                  isAnimationActive={false}
                />
              )}

              {/* Moving Averages */}
              {showIndicators.sma20 && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sma20"
                  stroke={COLOR_SCHEME.sma20}
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}

              {showIndicators.sma50 && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sma50"
                  stroke={COLOR_SCHEME.sma50}
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}

              {showIndicators.sma200 && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sma200"
                  stroke={COLOR_SCHEME.sma200}
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}

              {/* Bollinger Bands */}
              {showIndicators.bb && (
                <>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="bbUpper"
                    stroke={COLOR_SCHEME.bb_upper}
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="bbMiddle"
                    stroke={COLOR_SCHEME.bb_middle}
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="bbLower"
                    stroke={COLOR_SCHEME.bb_lower}
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    isAnimationActive={false}
                  />
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
            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SCHEME.support }} />
            <span className="text-slate-400">Support/Resistance</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Custom Candle Shape Component
 * Renders traditional Japanese candlesticks
 */
function CandleShape(props) {
  const { x, y, width, height, payload } = props

  if (!payload || payload.close === undefined) return null

  const { open, high, low, close } = payload
  const yScale = height / (Math.max(high, open, close) - Math.min(low, open, close) + 1)

  const bodyColor = close >= open ? COLOR_SCHEME.bullish : COLOR_SCHEME.bearish
  const wickColor = close >= open ? COLOR_SCHEME.bullish : COLOR_SCHEME.bearish

  return (
    <g>
      {/* Wick (high-low) */}
      <line
        x1={x + width / 2}
        y1={y}
        x2={x + width / 2}
        y2={y + height}
        stroke={wickColor}
        strokeWidth={0.5}
        opacity="0.6"
      />

      {/* Body (open-close) */}
      <rect
        x={x + width * 0.2}
        y={y + height * (1 - Math.max(open, close) * yScale)}
        width={width * 0.6}
        height={Math.abs(close - open) * yScale || 1}
        fill={bodyColor}
        stroke={bodyColor}
        strokeWidth={0.5}
      />
    </g>
  )
}
