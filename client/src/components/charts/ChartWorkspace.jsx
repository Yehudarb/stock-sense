import { useEffect, useMemo, useState } from 'react'
import useStore from '../../store/useStore'
import { fmtPercent, fmtPrice, fmtVolume } from '../../lib/formatters'
import Badge from '../ui/Badge'
import ChartContainer from './ChartContainer'
import ChartErrorBoundary from './ChartErrorBoundary'
import IndicatorLineChart from './IndicatorLineChart'
import MacdChart from './MacdChart'
import PriceChart from './PriceChart'
import RsiChart from './RsiChart'
import VolumeChart from './VolumeChart'

const DEFAULT_VISIBLE_BARS = {
  '1m': 160,
  '5m': 160,
  '15m': 160,
  '1h': 180,
  '4h': 180,
  '1d': 200,
  '1mo': 180,
  '1y': 252,
  '5y': 260,
}

const PRIMARY_PRESETS = [
  { id: '1D', label: '1D', interval: '5m', visibleBars: 78 },
  { id: '5D', label: '5D', interval: '15m', visibleBars: 130 },
  { id: '1M', label: '1M', interval: '1h', visibleBars: 180 },
  { id: '3M', label: '3M', interval: '4h', visibleBars: 180 },
  { id: '6M', label: '6M', interval: '1d', visibleBars: 126 },
  { id: 'YTD', label: 'YTD', interval: '1d', mode: 'ytd' },
  { id: '1Y', label: '1Y', interval: '1y', visibleBars: 252 },
  { id: '5Y', label: '5Y', interval: '5y', visibleBars: 260 },
  { id: 'MAX', label: 'Max', interval: '5y', mode: 'all' },
]

const INTRADAY_PRESETS = [
  { id: '1m', label: '1m', interval: '1m', visibleBars: 160 },
  { id: '5m', label: '5m', interval: '5m', visibleBars: 160 },
  { id: '15m', label: '15m', interval: '15m', visibleBars: 160 },
  { id: '1H', label: '1H', interval: '1h', visibleBars: 180 },
  { id: '4H', label: '4H', interval: '4h', visibleBars: 180 },
]

function SafeChart({ isLoading, resetKey, children }) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Loading chart...
      </div>
    )
  }

  return <ChartErrorBoundary resetKey={resetKey}>{children}</ChartErrorBoundary>
}

function controlClass(active) {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
    active
      ? 'border-cyan-400/30 bg-cyan-400/14 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.16)]'
      : 'border-white/8 bg-slate-900/80 text-slate-400 hover:border-white/14 hover:bg-slate-900 hover:text-white'
  }`
}

function quietControlClass(active) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
    active
      ? 'border-emerald-400/30 bg-emerald-400/12 text-emerald-100'
      : 'border-white/8 bg-slate-950/70 text-slate-500 hover:border-white/14 hover:text-slate-200'
  }`
}

function Group({ label, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/6 bg-slate-950/65 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function LegendPill({ label, color, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-slate-950/75 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-white/16 hover:bg-slate-900"
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
      <span className="text-slate-500">x</span>
    </button>
  )
}

function PanelToggle({ label, value, onToggle }) {
  return (
    <button type="button" className={quietControlClass(value)} onClick={onToggle}>
      {label}
    </button>
  )
}

function PatternSummaryCard({ patterns = [] }) {
  const topPatterns = [...patterns].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 3)
  const strongest = topPatterns[0]

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/78 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Pattern read</div>
          <div className="mt-1 text-sm font-semibold text-white">Active chart structures</div>
        </div>
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-xs text-slate-300">{patterns.length} found</span>
      </div>
      {topPatterns.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/8 bg-white/3 px-4 py-5 text-sm text-slate-400">
          No dominant pattern is active right now. Use the chart for level-by-level price inspection.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {strongest && (
            <div className="rounded-2xl border border-cyan-400/14 bg-cyan-400/8 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Strongest pattern</div>
                  <div className="mt-1 text-base font-semibold text-white">{strongest.name}</div>
                </div>
                <Badge tone={strongest.direction === 'Bullish' ? 'positive' : strongest.direction === 'Bearish' ? 'danger' : 'balanced'}>
                  {strongest.confidence}%
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <span>Breakout: {strongest.breakoutLevel ?? '-'}</span>
                <span>Invalidation: {strongest.invalidationLevel ?? '-'}</span>
                <span>Volume: {strongest.volumeConfirmed ? 'Confirmed' : 'Mixed'}</span>
                <span>{strongest.status ?? 'Developing'}</span>
              </div>
            </div>
          )}
          {topPatterns.map(pattern => (
            <div key={`${pattern.name}-${pattern.priceZone}`} className="rounded-2xl border border-white/6 bg-white/4 p-3">
                <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{pattern.name}</div>
                <Badge tone={pattern.direction === 'Bullish' ? 'positive' : pattern.direction === 'Bearish' ? 'danger' : 'balanced'}>
                  {pattern.direction}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1">Confidence {pattern.confidence}%</span>
                <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1">{pattern.category ?? 'Pattern'}</span>
                <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1">{pattern.priceZone}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{pattern.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IndicatorSummaryCard({ analysis }) {
  const interpretations = analysis?.indicatorInterpretations?.slice(0, 8) ?? []
  const scores = [
    ['Technical', analysis?.technicalScore],
    ['Trend', analysis?.trendScore],
    ['Momentum', analysis?.momentumScore],
    ['Volatility', analysis?.volatilityScore],
    ['Volume', analysis?.volumeScore],
    ['Patterns', analysis?.patternScore],
    ['Levels', analysis?.levelsScore],
  ].filter(([, value]) => value != null)

  if (!analysis) return null

  return (
    <div className="rounded-[24px] border border-white/8 bg-slate-950/78 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Technical score</div>
          <div className="mt-1 text-sm text-slate-300">Indicator and pattern readout</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {scores.map(([label, value]) => (
            <span key={label} className="rounded-full border border-white/8 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200">
              {label} {value}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {interpretations.map(item => (
          <div key={item.label} className="rounded-2xl border border-white/6 bg-white/4 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white">{item.label}</div>
              <Badge tone={item.tone ?? 'balanced'} className="px-2 py-0.5 text-xs">{item.value}</Badge>
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-400">{item.interpretation}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function resolvePresetBars(preset, bars) {
  if (!bars?.length) return null
  if (preset.mode === 'all') return bars.length
  if (preset.mode === 'ytd') {
    const currentYear = new Date(bars[bars.length - 1].t).getFullYear()
    const ytdCount = bars.filter(bar => new Date(bar.t).getFullYear() === currentYear).length
    return ytdCount || Math.min(bars.length, 120)
  }
  return Math.min(bars.length, preset.visibleBars ?? bars.length)
}

export default function ChartWorkspace({
  currentTicker,
  interval,
  snapshot,
  ohlcv,
  indicators,
  signal,
  technicalAnalysis,
  isLoading,
}) {
  const { setInterval } = useStore()
  const n = ohlcv.length
  const lastBar = ohlcv[n - 1]
  const lastClose = lastBar?.c ?? snapshot?.price ?? null
  const lastVolume = lastBar?.v ?? snapshot?.volume ?? null
  const volumeRatio = indicators?.volRatio?.[n - 1]
  const rsiLast = indicators?.rsi14?.[n - 1]
  const macdLine = indicators?.macd?.line?.[n - 1]
  const macdSignal = indicators?.macd?.signal?.[n - 1]
  const activeTrend = technicalAnalysis?.overallTechnicalBias ?? 'Neutral'
  const riskLevel = technicalAnalysis?.riskAssessment?.riskLevel ?? 'Medium'
  const keyLevel = technicalAnalysis?.keyLevels?.resistance?.[0] ?? technicalAnalysis?.keyLevels?.support?.[0] ?? null

  const [selectedPresetId, setSelectedPresetId] = useState('1D')
  const [chartType, setChartType] = useState('candlestick')
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)
  const [showWMA, setShowWMA] = useState(false)
  const [showBB, setShowBB] = useState(false)
  const [showVWAP, setShowVWAP] = useState(false)
  const [showSupertrend, setShowSupertrend] = useState(false)
  const [showIchimoku, setShowIchimoku] = useState(false)
  const [showATR, setShowATR] = useState(false)
  const [showStochRsi, setShowStochRsi] = useState(false)
  const [showADX, setShowADX] = useState(false)
  const [showOBV, setShowOBV] = useState(false)
  const [showCCI, setShowCCI] = useState(false)
  const [showMomentum, setShowMomentum] = useState(false)
  const [showWilliamsR, setShowWilliamsR] = useState(false)
  const [showKeltner, setShowKeltner] = useState(false)
  const [showDonchian, setShowDonchian] = useState(false)
  const [showMFI, setShowMFI] = useState(false)
  const [showCMF, setShowCMF] = useState(false)
  const [showADL, setShowADL] = useState(false)
  const [showVolumeMA, setShowVolumeMA] = useState(true)
  const [showPivotPoints, setShowPivotPoints] = useState(false)
  const [showPrevHighLow, setShowPrevHighLow] = useState(false)
  const [showHighLow52, setShowHighLow52] = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [showRSI, setShowRSI] = useState(true)
  const [showMACD, setShowMACD] = useState(true)
  const [showPatterns, setShowPatterns] = useState(true)
  const [showTriangles, setShowTriangles] = useState(true)
  const [showFibonacci, setShowFibonacci] = useState(false)
  const [showFibExtension, setShowFibExtension] = useState(false)
  const [showGaps, setShowGaps] = useState(true)
  const [showLevels, setShowLevels] = useState(true)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [visibleBars, setVisibleBars] = useState(null)
  const [viewOffset, setViewOffset] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const allPresets = useMemo(() => [...PRIMARY_PRESETS, ...INTRADAY_PRESETS], [])
  const activePreset = allPresets.find(item => item.id === selectedPresetId) ?? PRIMARY_PRESETS[0]
  const defaultVisibleBars = DEFAULT_VISIBLE_BARS[interval] ?? n
  const activeVisibleBars = Math.min(n, visibleBars ?? defaultVisibleBars)
  const maxOffset = Math.max(0, n - activeVisibleBars)
  const canZoom = n > 40
  const canPan = maxOffset > 0

  useEffect(() => {
    setViewOffset(0)
    setHoveredIndex(null)
  }, [currentTicker, interval, n])

  useEffect(() => {
    if (!ohlcv.length || interval !== activePreset.interval) return
    setVisibleBars(resolvePresetBars(activePreset, ohlcv))
  }, [activePreset, interval, ohlcv])

  function handleSelectPreset(preset) {
    setSelectedPresetId(preset.id)
    setViewOffset(0)
    setHoveredIndex(null)
    if (interval !== preset.interval) {
      setInterval(preset.interval)
      return
    }
    setVisibleBars(resolvePresetBars(preset, ohlcv))
  }

  function changeVisibleBars(multiplier) {
    if (!canZoom) return
    setVisibleBars(current => {
      const base = Math.min(n, current ?? activeVisibleBars)
      const next = Math.round(base * multiplier)
      if (next >= n) return n
      return Math.max(24, next)
    })
    setViewOffset(0)
  }

  function handlePriceChartWheel(event) {
    if (!canZoom) return
    event.preventDefault()
    changeVisibleBars(event.deltaY < 0 ? 0.86 : 1.18)
  }

  function panBy(delta) {
    if (!canPan) return
    setViewOffset(current => Math.max(0, Math.min(maxOffset, current + delta)))
  }

  function handleResetChart() {
    setChartType('candlestick')
    setShowSMA(true)
    setShowEMA(true)
    setShowWMA(false)
    setShowBB(false)
    setShowVWAP(false)
    setShowSupertrend(false)
    setShowIchimoku(false)
    setShowATR(false)
    setShowStochRsi(false)
    setShowADX(false)
    setShowOBV(false)
    setShowCCI(false)
    setShowMomentum(false)
    setShowWilliamsR(false)
    setShowKeltner(false)
    setShowDonchian(false)
    setShowMFI(false)
    setShowCMF(false)
    setShowADL(false)
    setShowVolumeMA(true)
    setShowPivotPoints(false)
    setShowPrevHighLow(false)
    setShowHighLow52(false)
    setShowVolume(true)
    setShowRSI(true)
    setShowMACD(true)
    setShowPatterns(true)
    setShowTriangles(true)
    setShowFibonacci(false)
    setShowFibExtension(false)
    setShowGaps(true)
    setShowLevels(true)
    setChartExpanded(false)
    setMeasureMode(false)
    setHoveredIndex(null)
    setViewOffset(0)
    handleSelectPreset(PRIMARY_PRESETS[0])
  }

  function handleClearDrawings() {
    setShowPatterns(false)
    setShowTriangles(false)
    setShowFibonacci(false)
    setShowFibExtension(false)
    setShowGaps(false)
    setShowLevels(false)
    setShowPivotPoints(false)
    setShowPrevHighLow(false)
    setShowHighLow52(false)
    setMeasureMode(false)
  }

  const summaryMetrics = [
    { label: 'Ticker', value: currentTicker },
    { label: 'Last', value: lastClose != null ? fmtPrice(lastClose) : '-' },
    { label: 'Daily change', value: snapshot?.changePct != null ? fmtPercent(snapshot.changePct) : '-' },
    { label: 'Trend', value: activeTrend },
    { label: 'Volume', value: volumeRatio ? `${volumeRatio.toFixed(1)}x avg` : (lastVolume ? fmtVolume(lastVolume) : '-') },
    { label: 'Key level', value: keyLevel != null ? fmtPrice(keyLevel) : '-' },
  ]

  const coreIndicators = [
    ['SMA', showSMA, () => setShowSMA(value => !value)],
    ['EMA', showEMA, () => setShowEMA(value => !value)],
    ['RSI', showRSI, () => setShowRSI(value => !value)],
    ['MACD', showMACD, () => setShowMACD(value => !value)],
    ['Volume', showVolume, () => setShowVolume(value => !value)],
    ['VWAP', showVWAP, () => setShowVWAP(value => !value)],
    ['Bollinger Bands', showBB, () => setShowBB(value => !value)],
    ['ATR', showATR, () => setShowATR(value => !value)],
    ['Stoch RSI', showStochRsi, () => setShowStochRsi(value => !value)],
    ['ADX', showADX, () => setShowADX(value => !value)],
    ['OBV', showOBV, () => setShowOBV(value => !value)],
    ['Supertrend', showSupertrend, () => setShowSupertrend(value => !value)],
    ['Pivot Points', showPivotPoints, () => setShowPivotPoints(value => !value)],
  ]

  const advancedIndicatorGroups = [
    {
      label: 'Trend',
      items: [
        ['WMA', showWMA, () => setShowWMA(value => !value)],
        ['Ichimoku Cloud', showIchimoku, () => setShowIchimoku(value => !value)],
      ],
    },
    {
      label: 'Momentum',
      items: [
        ['CCI', showCCI, () => setShowCCI(value => !value)],
        ['Momentum', showMomentum, () => setShowMomentum(value => !value)],
        ['Williams %R', showWilliamsR, () => setShowWilliamsR(value => !value)],
      ],
    },
    {
      label: 'Volatility',
      items: [
        ['Keltner Channels', showKeltner, () => setShowKeltner(value => !value)],
        ['Donchian Channels', showDonchian, () => setShowDonchian(value => !value)],
      ],
    },
    {
      label: 'Volume',
      items: [
        ['Volume MA', showVolumeMA, () => setShowVolumeMA(value => !value)],
        ['Money Flow Index', showMFI, () => setShowMFI(value => !value)],
        ['Chaikin Money Flow', showCMF, () => setShowCMF(value => !value)],
        ['A/D Line', showADL, () => setShowADL(value => !value)],
      ],
    },
    {
      label: 'Levels',
      items: [
        ['Fib Extension', showFibExtension, () => setShowFibExtension(value => !value)],
        ['Previous High / Low', showPrevHighLow, () => setShowPrevHighLow(value => !value)],
        ['52W High / Low', showHighLow52, () => setShowHighLow52(value => !value)],
      ],
    },
  ]

  const activeLegend = [
    chartType === 'candlestick' ? { label: 'Candles', color: '#10b981', action: () => setChartType('line') } : null,
    chartType === 'line' ? { label: 'Line', color: '#38bdf8', action: () => setChartType('candlestick') } : null,
    chartType === 'area' ? { label: 'Area', color: '#60a5fa', action: () => setChartType('candlestick') } : null,
    showSMA ? { label: 'SMA 20/50/200', color: '#f59e0b', action: () => setShowSMA(false) } : null,
    showEMA ? { label: 'EMA 20/50/200', color: '#a78bfa', action: () => setShowEMA(false) } : null,
    showWMA ? { label: 'WMA 20/50', color: '#fbbf24', action: () => setShowWMA(false) } : null,
    showBB ? { label: 'Bollinger Bands', color: '#84cc16', action: () => setShowBB(false) } : null,
    showVWAP ? { label: 'VWAP', color: '#2dd4bf', action: () => setShowVWAP(false) } : null,
    showSupertrend ? { label: 'Supertrend', color: '#34d399', action: () => setShowSupertrend(false) } : null,
    showIchimoku ? { label: 'Ichimoku', color: '#60a5fa', action: () => setShowIchimoku(false) } : null,
    showKeltner ? { label: 'Keltner', color: '#fb7185', action: () => setShowKeltner(false) } : null,
    showDonchian ? { label: 'Donchian', color: '#22d3ee', action: () => setShowDonchian(false) } : null,
    showLevels ? { label: 'Levels', color: '#f43f5e', action: () => setShowLevels(false) } : null,
    showPivotPoints ? { label: 'Pivot Points', color: '#facc15', action: () => setShowPivotPoints(false) } : null,
    showPrevHighLow ? { label: 'Prev H/L', color: '#fb923c', action: () => setShowPrevHighLow(false) } : null,
    showHighLow52 ? { label: '52W H/L', color: '#f472b6', action: () => setShowHighLow52(false) } : null,
    showVolume ? { label: 'Volume', color: '#38bdf8', action: () => setShowVolume(false) } : null,
    showVolumeMA ? { label: 'Volume MA', color: '#60a5fa', action: () => setShowVolumeMA(false) } : null,
    showRSI ? { label: 'RSI', color: '#60a5fa', action: () => setShowRSI(false) } : null,
    showStochRsi ? { label: 'Stoch RSI', color: '#c084fc', action: () => setShowStochRsi(false) } : null,
    showADX ? { label: 'ADX', color: '#f97316', action: () => setShowADX(false) } : null,
    showOBV ? { label: 'OBV', color: '#10b981', action: () => setShowOBV(false) } : null,
    showATR ? { label: 'ATR', color: '#f59e0b', action: () => setShowATR(false) } : null,
    showCCI ? { label: 'CCI', color: '#38bdf8', action: () => setShowCCI(false) } : null,
    showMomentum ? { label: 'Momentum', color: '#a3e635', action: () => setShowMomentum(false) } : null,
    showWilliamsR ? { label: 'Williams %R', color: '#fb7185', action: () => setShowWilliamsR(false) } : null,
    showMFI ? { label: 'MFI', color: '#2dd4bf', action: () => setShowMFI(false) } : null,
    showCMF ? { label: 'CMF', color: '#22c55e', action: () => setShowCMF(false) } : null,
    showADL ? { label: 'A/D Line', color: '#818cf8', action: () => setShowADL(false) } : null,
    showMACD ? { label: 'MACD', color: '#f472b6', action: () => setShowMACD(false) } : null,
  ].filter(Boolean)

  const secondaryPanels = [
    showStochRsi ? {
      key: 'stoch-rsi',
      title: 'Stochastic RSI',
      subtitle: 'Fast momentum oscillator',
      yMin: 0,
      yMax: 100,
      datasets: [
        { label: 'Stoch RSI %K', values: indicators?.stochRsi?.k, color: '#c084fc' },
        { label: 'Stoch RSI %D', values: indicators?.stochRsi?.d, color: '#f0abfc' },
      ],
    } : null,
    showADX ? {
      key: 'adx',
      title: 'ADX / Directional Index',
      subtitle: 'Trend strength with +DI and -DI',
      yMin: 0,
      yMax: 60,
      datasets: [
        { label: 'ADX', values: indicators?.adx?.adx, color: '#f97316' },
        { label: '+DI', values: indicators?.adx?.pdi, color: '#22c55e' },
        { label: '-DI', values: indicators?.adx?.mdi, color: '#f43f5e' },
      ],
    } : null,
    showOBV ? {
      key: 'obv',
      title: 'OBV',
      subtitle: 'On Balance Volume trend',
      datasets: [{ label: 'OBV', values: indicators?.obv, color: '#10b981' }],
    } : null,
    showATR ? {
      key: 'atr',
      title: 'ATR',
      subtitle: 'Volatility and risk range',
      datasets: [{ label: 'ATR 14', values: indicators?.atr14, color: '#f59e0b' }],
    } : null,
    showCCI ? {
      key: 'cci',
      title: 'CCI',
      subtitle: 'Commodity Channel Index',
      datasets: [{ label: 'CCI 20', values: indicators?.cci20, color: '#38bdf8' }],
    } : null,
    showMomentum ? {
      key: 'momentum',
      title: 'Momentum',
      subtitle: '10-bar price momentum',
      datasets: [{ label: 'Momentum 10', values: indicators?.momentum10, color: '#a3e635' }],
    } : null,
    showWilliamsR ? {
      key: 'williams-r',
      title: 'Williams %R',
      subtitle: 'Overbought / oversold pressure',
      yMin: -100,
      yMax: 0,
      datasets: [{ label: 'Williams %R', values: indicators?.willR, color: '#fb7185' }],
    } : null,
    showMFI ? {
      key: 'mfi',
      title: 'Money Flow Index',
      subtitle: 'Volume-weighted momentum',
      yMin: 0,
      yMax: 100,
      datasets: [{ label: 'MFI 14', values: indicators?.mfi14, color: '#2dd4bf' }],
    } : null,
    showCMF ? {
      key: 'cmf',
      title: 'Chaikin Money Flow',
      subtitle: 'Accumulation / distribution pressure',
      yMin: -1,
      yMax: 1,
      datasets: [{ label: 'CMF 20', values: indicators?.cmf20, color: '#22c55e' }],
    } : null,
    showADL ? {
      key: 'adl',
      title: 'A/D Line',
      subtitle: 'Accumulation / Distribution Line',
      datasets: [{ label: 'A/D Line', values: indicators?.adl, color: '#818cf8' }],
    } : null,
  ].filter(Boolean)

  const chartResetKey = `${currentTicker}-${interval}-${chartType}-${activeVisibleBars}-${viewOffset}-${showSMA}-${showEMA}-${showWMA}-${showBB}-${showVWAP}-${showSupertrend}-${showIchimoku}-${showKeltner}-${showDonchian}-${showPivotPoints}-${showPrevHighLow}-${showHighLow52}-${showVolumeMA}-${showPatterns}-${showTriangles}-${showLevels}-${showFibonacci}-${showFibExtension}-${showGaps}`
  const patternSummary = technicalAnalysis?.patterns ?? []

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-white/8 bg-slate-950/78 p-5 shadow-[0_28px_90px_rgba(2,6,23,0.42)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Chart workspace</div>
                <Badge tone={activeTrend === 'Bullish' ? 'positive' : activeTrend === 'Bearish' ? 'danger' : 'balanced'}>
                  {activeTrend}
                </Badge>
                <Badge tone={riskLevel === 'Low' ? 'positive' : riskLevel === 'High' ? 'danger' : 'balanced'}>
                  Risk {riskLevel}
                </Badge>
              </div>
              <div className="text-2xl font-semibold text-white sm:text-[2rem]">
                {currentTicker} technical chart
              </div>
              <div className="max-w-3xl text-sm leading-6 text-slate-400">
                Use the chart to inspect price structure, volume confirmation, trend alignment, and nearby risk levels without leaving the dashboard.
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              {summaryMetrics.map(metric => (
                <div key={metric.label} className="rounded-2xl border border-white/8 bg-slate-900/76 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PatternSummaryCard patterns={patternSummary} />
      </div>

      <IndicatorSummaryCard analysis={technicalAnalysis} />

      <div className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          <Group label="Chart type">
            {[
              ['candlestick', 'Candles'],
              ['line', 'Line'],
              ['area', 'Area'],
            ].map(([value, label]) => (
              <button key={value} type="button" className={controlClass(chartType === value)} onClick={() => setChartType(value)}>
                {label}
              </button>
            ))}
          </Group>

          <Group label="Indicators">
            {coreIndicators.map(([label, value, onToggle]) => (
              <PanelToggle key={label} label={label} value={value} onToggle={onToggle} />
            ))}
            <details className="relative">
              <summary className={`${quietControlClass(false)} list-none cursor-pointer`}>
                More indicators
              </summary>
              <div className="absolute left-0 z-30 mt-2 w-[min(88vw,520px)] rounded-2xl border border-white/10 bg-slate-950 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {advancedIndicatorGroups.map(group => (
                    <div key={group.label} className="rounded-xl border border-white/6 bg-white/4 p-3">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{group.label}</div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map(([label, value, onToggle]) => (
                          <PanelToggle key={label} label={label} value={value} onToggle={onToggle} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </Group>

          <Group label="Analysis tools">
            <PanelToggle label="Trendline" value={showTriangles} onToggle={() => setShowTriangles(value => !value)} />
            <PanelToggle label="Horizontal line" value={showLevels} onToggle={() => setShowLevels(value => !value)} />
            <PanelToggle label="Fibonacci" value={showFibonacci} onToggle={() => setShowFibonacci(value => !value)} />
            <PanelToggle label="Fib extension" value={showFibExtension} onToggle={() => setShowFibExtension(value => !value)} />
            <PanelToggle label="Zone" value={showGaps} onToggle={() => setShowGaps(value => !value)} />
            <PanelToggle label="Pattern markers" value={showPatterns} onToggle={() => setShowPatterns(value => !value)} />
            <PanelToggle label="% ruler" value={measureMode} onToggle={() => setMeasureMode(value => !value)} />
          </Group>

          <Group label="View">
            <button type="button" className={controlClass(chartExpanded)} onClick={() => setChartExpanded(value => !value)}>
              {chartExpanded ? 'Collapse' : 'Expand'}
            </button>
            <button type="button" className={controlClass(false)} onClick={handleResetChart}>Reset chart</button>
            <button type="button" className={controlClass(false)} onClick={handleClearDrawings}>Clear drawings</button>
            <button type="button" className={controlClass(false)} onClick={() => changeVisibleBars(0.65)} disabled={!canZoom}>Zoom in</button>
            <button type="button" className={controlClass(false)} onClick={() => changeVisibleBars(1.55)} disabled={!canZoom}>Zoom out</button>
            <button type="button" className={controlClass(false)} onClick={() => setViewOffset(0)} disabled={!canPan}>Fit latest</button>
          </Group>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-slate-950/78 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max flex-nowrap gap-2">
                {PRIMARY_PRESETS.map(preset => (
                  <button key={preset.id} type="button" className={controlClass(selectedPresetId === preset.id)} onClick={() => handleSelectPreset(preset)}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max flex-nowrap gap-2">
                {INTRADAY_PRESETS.map(preset => (
                  <button key={preset.id} type="button" className={quietControlClass(selectedPresetId === preset.id)} onClick={() => handleSelectPreset(preset)}>
                    {preset.label}
                  </button>
                ))}
                <button type="button" className={quietControlClass(false)} onClick={() => panBy(20)} disabled={!canPan}>Older</button>
                <button type="button" className={quietControlClass(false)} onClick={() => panBy(-20)} disabled={viewOffset === 0}>Newer</button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeLegend.map(item => (
              <LegendPill key={item.label} label={item.label} color={item.color} onRemove={item.action} />
            ))}
            <span className="ml-auto text-xs text-slate-500">
              {Math.min(activeVisibleBars, n)}/{n} bars · {interval} feed
            </span>
          </div>
        </div>

        {measureMode && (
          <div className="rounded-2xl border border-cyan-400/18 bg-cyan-400/10 px-4 py-3 text-xs font-medium text-cyan-100">
            Drag on the price panel to measure percentage move and distance in bars.
          </div>
        )}

        <ChartContainer
          title="Price chart"
          subtitle={`${currentTicker} · ${chartType === 'candlestick' ? 'Candlestick' : chartType === 'area' ? 'Area' : 'Line'} view`}
          height={chartExpanded ? 'h-[72vh]' : 'h-[360px] sm:h-[460px] xl:h-[620px]'}
          onWheel={handlePriceChartWheel}
          headerRight={(
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{snapshot?.price != null ? fmtPrice(snapshot.price) : '--'}</span>
              <span className={snapshot?.changePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {snapshot?.changePct != null ? fmtPercent(snapshot.changePct) : '--'}
              </span>
            </div>
          )}
        >
          <SafeChart isLoading={isLoading} resetKey={`price-${chartResetKey}`}>
            <PriceChart
              ohlcv={ohlcv}
              indicators={indicators}
              showSMA={showSMA}
              showEMA={showEMA}
              showWMA={showWMA}
              showBB={showBB}
              showVWAP={showVWAP}
              showSupertrend={showSupertrend}
              showIchimoku={showIchimoku}
              showKeltner={showKeltner}
              showDonchian={showDonchian}
              showPivotPoints={showPivotPoints}
              showPrevHighLow={showPrevHighLow}
              showHighLow52={showHighLow52}
              chartType={chartType}
              patterns={signal?.patterns}
              gaps={signal?.pro?.gaps}
              showFibonacci={showFibonacci}
              showFibExtension={showFibExtension}
              showGaps={showGaps}
              showPatterns={showPatterns}
              showTriangles={showTriangles}
              showLevels={showLevels}
              ticker={currentTicker}
              decision={signal?.decision}
              technicalAnalysis={technicalAnalysis}
              interval={interval}
              visibleBars={activeVisibleBars}
              viewOffset={viewOffset}
              measurementEnabled={measureMode}
              hoveredIndex={hoveredIndex}
              onHoverIndexChange={setHoveredIndex}
            />
          </SafeChart>
        </ChartContainer>

        {showVolume && (
          <ChartContainer
            title="Volume"
            subtitle="Confirmation panel with color-coded bars and average volume"
            height="h-[170px] sm:h-[190px]"
          >
            <SafeChart isLoading={isLoading} resetKey={`volume-${chartResetKey}`}>
              <VolumeChart
                ohlcv={ohlcv}
                indicators={indicators}
                showVolumeMA={showVolumeMA}
                interval={interval}
                visibleBars={activeVisibleBars}
                viewOffset={viewOffset}
                hoveredIndex={hoveredIndex}
                onHoverIndexChange={setHoveredIndex}
              />
            </SafeChart>
          </ChartContainer>
        )}

        {(showRSI || showMACD) && (
          <div className={`grid gap-4 ${showRSI && showMACD ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
            {showRSI && (
              <ChartContainer
                title="RSI panel"
                subtitle={`RSI (14)${rsiLast != null ? ` · ${rsiLast.toFixed(1)}` : ''}`}
                height="h-[190px]"
              >
                <SafeChart isLoading={isLoading} resetKey={`rsi-${chartResetKey}`}>
                  <RsiChart
                    ohlcv={ohlcv}
                    indicators={indicators}
                    interval={interval}
                    visibleBars={activeVisibleBars}
                    viewOffset={viewOffset}
                    hoveredIndex={hoveredIndex}
                    onHoverIndexChange={setHoveredIndex}
                  />
                </SafeChart>
              </ChartContainer>
            )}

            {showMACD && (
              <ChartContainer
                title="MACD panel"
                subtitle={`MACD (12, 26, 9)${macdLine != null && macdSignal != null ? ` · ${macdLine.toFixed(2)} / ${macdSignal.toFixed(2)}` : ''}`}
                height="h-[190px]"
              >
                <SafeChart isLoading={isLoading} resetKey={`macd-${chartResetKey}`}>
                  <MacdChart
                    ohlcv={ohlcv}
                    indicators={indicators}
                    interval={interval}
                    visibleBars={activeVisibleBars}
                    viewOffset={viewOffset}
                    hoveredIndex={hoveredIndex}
                    onHoverIndexChange={setHoveredIndex}
                  />
                </SafeChart>
              </ChartContainer>
            )}
          </div>
        )}

        {secondaryPanels.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {secondaryPanels.map(panel => (
              <ChartContainer
                key={panel.key}
                title={panel.title}
                subtitle={panel.subtitle}
                height="h-[180px]"
              >
                <SafeChart isLoading={isLoading} resetKey={`${panel.key}-${chartResetKey}`}>
                  <IndicatorLineChart
                    ohlcv={ohlcv}
                    interval={interval}
                    visibleBars={activeVisibleBars}
                    viewOffset={viewOffset}
                    hoveredIndex={hoveredIndex}
                    onHoverIndexChange={setHoveredIndex}
                    datasets={panel.datasets}
                    yMin={panel.yMin}
                    yMax={panel.yMax}
                  />
                </SafeChart>
              </ChartContainer>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-[24px] border border-white/8 bg-slate-950/78 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">
            {technicalAnalysis?.disclaimer ?? 'This technical analysis is for educational and informational purposes only. It is not financial advice or a trading recommendation.'}
          </div>
          <div className="text-xs text-slate-500">
            Use probability and risk, not certainty.
          </div>
        </div>
      </div>
    </section>
  )
}
