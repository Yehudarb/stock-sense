import { useEffect, useMemo, useState } from 'react'
import useStore from '../../store/useStore'
import { fmtPercent, fmtPrice, fmtVolume } from '../../lib/formatters'
import Badge from '../ui/Badge'
import ChartContainer from './ChartContainer'
import ChartErrorBoundary from './ChartErrorBoundary'
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
  const topPatterns = patterns.slice(0, 3)

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
  const [showBB, setShowBB] = useState(false)
  const [showVWAP, setShowVWAP] = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [showRSI, setShowRSI] = useState(true)
  const [showMACD, setShowMACD] = useState(true)
  const [showPatterns, setShowPatterns] = useState(true)
  const [showTriangles, setShowTriangles] = useState(true)
  const [showFibonacci, setShowFibonacci] = useState(false)
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
    setShowBB(false)
    setShowVWAP(false)
    setShowVolume(true)
    setShowRSI(true)
    setShowMACD(true)
    setShowPatterns(true)
    setShowTriangles(true)
    setShowFibonacci(false)
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
    setShowGaps(false)
    setShowLevels(false)
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

  const activeLegend = [
    chartType === 'candlestick' ? { label: 'Candles', color: '#10b981', action: () => setChartType('line') } : null,
    chartType === 'line' ? { label: 'Line', color: '#38bdf8', action: () => setChartType('candlestick') } : null,
    chartType === 'area' ? { label: 'Area', color: '#60a5fa', action: () => setChartType('candlestick') } : null,
    showSMA ? { label: 'SMA 20/50/200', color: '#f59e0b', action: () => setShowSMA(false) } : null,
    showEMA ? { label: 'EMA 20/50/200', color: '#a78bfa', action: () => setShowEMA(false) } : null,
    showBB ? { label: 'Bollinger Bands', color: '#84cc16', action: () => setShowBB(false) } : null,
    showVWAP ? { label: 'VWAP', color: '#2dd4bf', action: () => setShowVWAP(false) } : null,
    showLevels ? { label: 'Levels', color: '#f43f5e', action: () => setShowLevels(false) } : null,
    showVolume ? { label: 'Volume', color: '#38bdf8', action: () => setShowVolume(false) } : null,
    showRSI ? { label: 'RSI', color: '#60a5fa', action: () => setShowRSI(false) } : null,
    showMACD ? { label: 'MACD', color: '#f472b6', action: () => setShowMACD(false) } : null,
  ].filter(Boolean)

  const chartResetKey = `${currentTicker}-${interval}-${chartType}-${activeVisibleBars}-${viewOffset}-${showSMA}-${showEMA}-${showBB}-${showVWAP}-${showPatterns}-${showTriangles}-${showLevels}-${showFibonacci}-${showGaps}`
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
            <PanelToggle label="SMA" value={showSMA} onToggle={() => setShowSMA(value => !value)} />
            <PanelToggle label="EMA" value={showEMA} onToggle={() => setShowEMA(value => !value)} />
            <PanelToggle label="RSI" value={showRSI} onToggle={() => setShowRSI(value => !value)} />
            <PanelToggle label="MACD" value={showMACD} onToggle={() => setShowMACD(value => !value)} />
            <PanelToggle label="Bands" value={showBB} onToggle={() => setShowBB(value => !value)} />
            <PanelToggle label="Volume" value={showVolume} onToggle={() => setShowVolume(value => !value)} />
            <PanelToggle label="VWAP" value={showVWAP} onToggle={() => setShowVWAP(value => !value)} />
          </Group>

          <Group label="Analysis tools">
            <PanelToggle label="Trendline" value={showTriangles} onToggle={() => setShowTriangles(value => !value)} />
            <PanelToggle label="Horizontal line" value={showLevels} onToggle={() => setShowLevels(value => !value)} />
            <PanelToggle label="Fibonacci" value={showFibonacci} onToggle={() => setShowFibonacci(value => !value)} />
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
              showBB={showBB}
              showVWAP={showVWAP}
              chartType={chartType}
              patterns={signal?.patterns}
              gaps={signal?.pro?.gaps}
              showFibonacci={showFibonacci}
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
