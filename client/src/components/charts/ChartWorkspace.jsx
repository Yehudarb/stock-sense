import { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../../store/useStore'
import { fmtPercent, fmtPrice } from '../../lib/formatters'
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

const CHART_LAYOUT_STORAGE_KEY = 'stock-sense.chart-layout.v2'

const INTERVAL_LABELS = {
  he: {
    '1m': '1 דק׳',
    '5m': '5 דק׳',
    '15m': '15 דק׳',
    '1h': 'שעה',
    '4h': '4 שעות',
    '1d': 'יום',
    '1mo': 'חודש',
    '1y': 'שנה',
    '5y': '5 שנים',
  },
  en: {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1H',
    '4h': '4H',
    '1d': '1D',
    '1mo': '1M',
    '1y': '1Y',
    '5y': '5Y',
  },
}

const OVERLAY_COLORS = {
  candles: '#10b981',
  line: '#38bdf8',
  area: '#60a5fa',
  sma20: '#EF9F27',
  sma50: 'rgba(234, 179, 8, 0.95)',
  sma200: 'rgba(99, 102, 241, 0.92)',
  ema20: 'rgba(56, 189, 248, 0.92)',
  ema50: '#8b5cf6',
  ema200: 'rgba(167, 139, 250, 0.92)',
  wma20: 'rgba(251, 191, 36, 0.86)',
  wma50: 'rgba(245, 158, 11, 0.9)',
  bbUpper: 'rgba(132, 204, 22, 0.95)',
  bbMiddle: 'rgba(163, 230, 53, 0.8)',
  bbLower: 'rgba(190, 242, 100, 0.95)',
  vwap: '#2dd4bf',
  supertrend: '#34d399',
  ichimokuTenkan: '#60a5fa',
  ichimokuKijun: '#f59e0b',
  ichimokuSpanA: 'rgba(16, 185, 129, 0.85)',
  ichimokuSpanB: 'rgba(239, 68, 68, 0.85)',
  keltnerUpper: '#fb7185',
  keltnerMiddle: '#fda4af',
  keltnerLower: '#fecdd3',
  donchianUpper: '#22d3ee',
  donchianMiddle: '#67e8f9',
  donchianLower: '#a5f3fc',
  pivot: '#facc15',
  previousHigh: '#fb923c',
  previousLow: '#fdba74',
  high52: '#f472b6',
  low52: '#f9a8d4',
  levels: '#f43f5e',
  volume: '#38bdf8',
  volumeMA: '#60a5fa',
  rsi: '#378add',
  macd: '#378add',
  macdSignal: '#E24B4A',
}

function getBaseChartHeight(expanded) {
  if (typeof window === 'undefined') return expanded ? 720 : 600
  if (expanded) return Math.round(window.innerHeight * 0.72)
  if (window.innerWidth < 640) return 400
  if (window.innerWidth < 768) return 500
  if (window.innerWidth < 1280) return 600
  return 700
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

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
  return `rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
    active
      ? 'border-cyan-400 bg-cyan-500 text-white shadow-lg shadow-cyan-500/40'
      : 'border-slate-600 bg-transparent text-slate-300 hover:border-cyan-400 hover:bg-slate-900/70 hover:text-white'
  }`
}

function quietControlClass(active) {
  return `rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
    active
      ? 'border-emerald-400 bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30'
      : 'border-slate-600 bg-transparent text-slate-300 hover:border-emerald-400 hover:bg-slate-900/70 hover:text-white'
  }`
}

function Group({ label, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/85 p-4 shadow-[0_16px_40px_rgba(2,6,23,0.35)]">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</div>
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

function SeriesKey({ label, color }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-slate-950/65 px-3 py-1.5 text-[11px] font-medium text-slate-200">
      <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  )
}

function PanelToggle({ label, value, onToggle }) {
  return (
    <button type="button" className={quietControlClass(value)} onClick={onToggle}>
      {label}
    </button>
  )
}

function LabelWithIcon({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  )
}

function ChartControls({
  chartType,
  setChartType,
  coreIndicators,
  advancedIndicatorGroups,
  chartCopy,
  showTriangles,
  setShowTriangles,
  showLevels,
  setShowLevels,
  showFibonacci,
  setShowFibonacci,
  showFibExtension,
  setShowFibExtension,
  showGaps,
  setShowGaps,
  showPatterns,
  setShowPatterns,
  measureMode,
  setMeasureMode,
  chartExpanded,
  setChartExpanded,
  handleResetChart,
  handleClearDrawings,
  changeVisibleBars,
  canZoom,
  canPan,
  setViewOffset,
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      <Group label={chartCopy.chartType}>
        {[
          ['candlestick', '🕯️', chartCopy.candles],
          ['line', '📈', chartCopy.line],
          ['area', '🟦', chartCopy.area],
        ].map(([value, icon, label]) => (
          <button key={value} type="button" className={controlClass(chartType === value)} onClick={() => setChartType(value)}>
            <LabelWithIcon icon={icon} label={label} />
          </button>
        ))}
      </Group>

      <Group label={chartCopy.indicators}>
        {coreIndicators.map(([label, value, onToggle]) => (
          <PanelToggle key={label} label={label} value={value} onToggle={onToggle} />
        ))}
        <details className="relative">
          <summary className={`${quietControlClass(false)} list-none cursor-pointer`}>
            <LabelWithIcon icon="➕" label={chartCopy.moreIndicators} />
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

      <Group label={chartCopy.analysisTools}>
        <PanelToggle label={<LabelWithIcon icon="📏" label={chartCopy.trendline} />} value={showTriangles} onToggle={() => setShowTriangles(value => !value)} />
        <PanelToggle label={<LabelWithIcon icon="📍" label={chartCopy.horizontalLine} />} value={showLevels} onToggle={() => setShowLevels(value => !value)} />
        <PanelToggle label={<LabelWithIcon icon="🌀" label={chartCopy.fibonacci} />} value={showFibonacci} onToggle={() => setShowFibonacci(value => !value)} />
        <PanelToggle label={<LabelWithIcon icon="🧭" label={chartCopy.fibExtension} />} value={showFibExtension} onToggle={() => setShowFibExtension(value => !value)} />
        <PanelToggle label={<LabelWithIcon icon="🧱" label={chartCopy.zone} />} value={showGaps} onToggle={() => setShowGaps(value => !value)} />
        <PanelToggle label={<LabelWithIcon icon="🏷️" label={chartCopy.patternMarkers} />} value={showPatterns} onToggle={() => setShowPatterns(value => !value)} />
        <PanelToggle label={<LabelWithIcon icon="📐" label={chartCopy.ruler} />} value={measureMode} onToggle={() => setMeasureMode(value => !value)} />
      </Group>

      <Group label={chartCopy.view}>
        <button type="button" className={controlClass(chartExpanded)} onClick={() => setChartExpanded(value => !value)}>
          <LabelWithIcon icon={chartExpanded ? '🗕' : '🗖'} label={chartExpanded ? chartCopy.collapse : chartCopy.expand} />
        </button>
        <button type="button" className={controlClass(false)} onClick={handleResetChart}><LabelWithIcon icon="🔄" label={chartCopy.resetChart} /></button>
        <button type="button" className={controlClass(false)} onClick={handleClearDrawings}><LabelWithIcon icon="🧹" label={chartCopy.clearDrawings} /></button>
        <button type="button" className={controlClass(false)} onClick={() => changeVisibleBars(0.65)} disabled={!canZoom}><LabelWithIcon icon="＋" label={chartCopy.zoomIn} /></button>
        <button type="button" className={controlClass(false)} onClick={() => changeVisibleBars(1.55)} disabled={!canZoom}><LabelWithIcon icon="－" label={chartCopy.zoomOut} /></button>
        <button type="button" className={controlClass(false)} onClick={() => setViewOffset(0)} disabled={!canPan}><LabelWithIcon icon="🎯" label={chartCopy.fitLatest} /></button>
      </Group>
    </div>
  )
}

function PresetControls({
  chartCopy,
  language,
  selectedPresetId,
  handleSelectPreset,
  canPan,
  panBy,
  viewOffset,
  activeLegend,
  activeVisibleBars,
  totalBars,
  interval,
}) {
  const allPresets = [...PRIMARY_PRESETS, ...INTRADAY_PRESETS]
  const selectedPreset = allPresets.find(preset => preset.id === selectedPresetId)
  const isHebrew = language === 'he'
  const presetCopy = isHebrew
    ? {
        timeRange: 'טווח זמן',
        timeRangeHint: 'בחר כמה היסטוריה לראות ומה גודל הנר בגרף.',
        range: 'טווח',
        candleSize: 'גודל נר',
        navigate: 'ניווט',
        showing: 'מציג',
        bars: 'נרות',
      }
    : {
        timeRange: 'Time range',
        timeRangeHint: 'Choose how much history to view and the candle size on the chart.',
        range: 'Range',
        candleSize: 'Candle size',
        navigate: 'Navigate',
        showing: 'Showing',
        bars: 'bars',
      }
  const intervalLabel = INTERVAL_LABELS.he?.[interval] && isHebrew
    ? INTERVAL_LABELS.he[interval]
    : INTERVAL_LABELS.en?.[interval] ?? interval

  return (
    <div className="rounded-[24px] border border-white/8 bg-slate-950/78 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{presetCopy.timeRange}</div>
          <div className="mt-1 text-sm text-slate-300">{presetCopy.timeRangeHint}</div>
        </div>
        <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
          {presetCopy.showing} {selectedPreset?.label ?? selectedPresetId} · {intervalLabel} · {Math.min(activeVisibleBars, totalBars)}/{totalBars} {presetCopy.bars}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{presetCopy.range}</div>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {PRIMARY_PRESETS.map(preset => (
              <button key={preset.id} type="button" title={`${presetCopy.range}: ${preset.label}`} className={controlClass(selectedPresetId === preset.id)} onClick={() => handleSelectPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{presetCopy.candleSize}</div>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {INTRADAY_PRESETS.map(preset => (
              <button key={preset.id} type="button" title={`${presetCopy.candleSize}: ${preset.label}`} className={quietControlClass(selectedPresetId === preset.id)} onClick={() => handleSelectPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{presetCopy.navigate}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietControlClass(false)} onClick={() => panBy(20)} disabled={!canPan}>{chartCopy.older}</button>
            <button type="button" className={quietControlClass(false)} onClick={() => panBy(-20)} disabled={viewOffset === 0}>{chartCopy.newer}</button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {activeLegend.map(item => (
          <LegendPill key={item.label} label={item.label} color={item.color} onRemove={item.action} />
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {Math.min(activeVisibleBars, totalBars)}/{totalBars} {chartCopy.barsFeed} {interval}
        </span>
      </div>
    </div>
  )
}

function PatternSummaryCard({ patterns = [], copy }) {
  const topPatterns = [...patterns].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 3)
  const strongest = topPatterns[0]

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/78 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.patternRead}</div>
          <div className="mt-1 text-sm font-semibold text-white">{copy.activeStructures}</div>
        </div>
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-xs text-slate-300">{patterns.length} {copy.found}</span>
      </div>
      {topPatterns.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/8 bg-white/3 px-4 py-5 text-sm text-slate-400">
          {copy.noPattern}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {strongest && (
            <div className="rounded-2xl border border-cyan-400/14 bg-cyan-400/8 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">{copy.strongestPattern}</div>
                  <div className="mt-1 text-base font-semibold text-white">{strongest.name}</div>
                </div>
                <Badge tone={strongest.direction === 'Bullish' ? 'positive' : strongest.direction === 'Bearish' ? 'danger' : 'balanced'}>
                  {strongest.confidence}%
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <span>{copy.breakout}: {strongest.breakoutLevel ?? '-'}</span>
                <span>{copy.invalidation}: {strongest.invalidationLevel ?? '-'}</span>
                <span>{copy.volume}: {strongest.volumeConfirmed ? copy.confirmed : copy.mixed}</span>
                <span>{strongest.status ?? copy.developing}</span>
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
                <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1">{copy.confidence} {pattern.confidence}%</span>
                <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1">{pattern.category ?? copy.pattern}</span>
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

function IndicatorSummaryCard({ analysis, copy }) {
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
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.technicalScore}</div>
          <div className="mt-1 text-sm text-slate-300">{copy.indicatorReadout}</div>
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
  paperTradingAccount,
  isLoading,
}) {
  const { setInterval, language } = useStore()
  const n = ohlcv.length
  const volumeRatio = indicators?.volRatio?.[n - 1]
  const rsiLast = indicators?.rsi14?.[n - 1]
  const macdLine = indicators?.macd?.line?.[n - 1]
  const macdSignal = indicators?.macd?.signal?.[n - 1]
  const activeTrend = technicalAnalysis?.overallTechnicalBias ?? 'Neutral'
  const riskLevel = technicalAnalysis?.riskAssessment?.riskLevel ?? 'Medium'

  const [selectedPresetId, setSelectedPresetId] = useState('1D')
  const [chartType, setChartType] = useState('candlestick')
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
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
  const [showVolumeMA, setShowVolumeMA] = useState(false)
  const [showPivotPoints, setShowPivotPoints] = useState(false)
  const [showPrevHighLow, setShowPrevHighLow] = useState(false)
  const [showHighLow52, setShowHighLow52] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showRSI, setShowRSI] = useState(false)
  const [showMACD, setShowMACD] = useState(false)
  const [showPatterns, setShowPatterns] = useState(false)
  const [showTriangles, setShowTriangles] = useState(false)
  const [showFibonacci, setShowFibonacci] = useState(false)
  const [showFibExtension, setShowFibExtension] = useState(false)
  const [showGaps, setShowGaps] = useState(false)
  const [showLevels, setShowLevels] = useState(false)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [visibleBars, setVisibleBars] = useState(null)
  const [viewOffset, setViewOffset] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [pricePanelHeightPx, setPricePanelHeightPx] = useState(null)
  const [priceScale, setPriceScale] = useState(1)
  const [layoutHydrated, setLayoutHydrated] = useState(false)
  const [resizeState, setResizeState] = useState(null)

  const allPresets = useMemo(() => [...PRIMARY_PRESETS, ...INTRADAY_PRESETS], [])
  const activePreset = allPresets.find(item => item.id === selectedPresetId) ?? PRIMARY_PRESETS[0]
  const defaultVisibleBars = DEFAULT_VISIBLE_BARS[interval] ?? n
  const activeVisibleBars = Math.min(n, visibleBars ?? defaultVisibleBars)
  const maxOffset = Math.max(0, n - activeVisibleBars)
  const canZoom = n > 40
  const canPan = maxOffset > 0

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHART_LAYOUT_STORAGE_KEY) ?? 'null')
      if (!saved) {
        setLayoutHydrated(true)
        return
      }

      if (saved.chartType) setChartType(saved.chartType)
      if (saved.visibleBars != null) setVisibleBars(saved.visibleBars)
      if (saved.priceScale != null) setPriceScale(clamp(saved.priceScale, 0.35, 4))
      if (saved.pricePanelHeightPx != null) setPricePanelHeightPx(saved.pricePanelHeightPx)
      if (typeof saved.showSMA === 'boolean') setShowSMA(saved.showSMA)
      if (typeof saved.showEMA === 'boolean') setShowEMA(saved.showEMA)
      if (typeof saved.showVWAP === 'boolean') setShowVWAP(saved.showVWAP)
      if (typeof saved.showBB === 'boolean') setShowBB(saved.showBB)
      if (typeof saved.showVolume === 'boolean') setShowVolume(saved.showVolume)
      if (typeof saved.showRSI === 'boolean') setShowRSI(saved.showRSI)
      if (typeof saved.showMACD === 'boolean') setShowMACD(saved.showMACD)
      if (typeof saved.showLevels === 'boolean') setShowLevels(saved.showLevels)
    } catch {
      window.localStorage.removeItem(CHART_LAYOUT_STORAGE_KEY)
    } finally {
      setLayoutHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!layoutHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(CHART_LAYOUT_STORAGE_KEY, JSON.stringify({
      chartType,
      visibleBars,
      priceScale,
      pricePanelHeightPx,
      showSMA,
      showEMA,
      showVWAP,
      showBB,
      showVolume,
      showRSI,
      showMACD,
      showLevels,
    }))
  }, [chartType, layoutHydrated, pricePanelHeightPx, priceScale, showBB, showEMA, showLevels, showMACD, showRSI, showSMA, showVWAP, showVolume, visibleBars])

  useEffect(() => {
    setViewOffset(0)
    setHoveredIndex(null)
  }, [currentTicker, interval, n])

  useEffect(() => {
    if (!ohlcv.length || interval !== activePreset.interval) return
    setVisibleBars(resolvePresetBars(activePreset, ohlcv))
  }, [activePreset, interval, ohlcv])

  useEffect(() => {
    if (!resizeState) return undefined

    const handlePointerMove = event => {
      if (resizeState.type === 'height') {
        const nextHeight = clamp(
          resizeState.startHeight + (event.clientY - resizeState.startY),
          360,
          Math.round(window.innerHeight * 0.92),
        )
        setPricePanelHeightPx(nextHeight)
      }

      if (resizeState.type === 'timeScale') {
        const multiplier = clamp(1 + ((event.clientX - resizeState.startX) / 320), 0.28, 3.4)
        const nextVisible = Math.round(clamp(resizeState.startVisibleBars * multiplier, 24, n))
        const anchorRatio = 0.5
        const oldStart = n - resizeState.startViewOffset - resizeState.startVisibleBars
        const anchorIndex = oldStart + resizeState.startVisibleBars * anchorRatio
        const nextStart = anchorIndex - nextVisible * anchorRatio
        const nextOffset = clamp(n - nextVisible - nextStart, 0, Math.max(0, n - nextVisible))
        setVisibleBars(nextVisible)
        setViewOffset(Math.round(nextOffset))
      }

      if (resizeState.type === 'priceScale') {
        const multiplier = clamp(1 + ((event.clientY - resizeState.startY) / 260), 0.35, 3.5)
        setPriceScale(clamp(resizeState.startPriceScale * multiplier, 0.35, 4))
      }
    }

    const handlePointerUp = () => setResizeState(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [n, resizeState])

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

  function zoomVisibleBars(multiplier, anchorRatio = 1) {
    if (!canZoom) return
    const base = Math.min(n, visibleBars ?? activeVisibleBars)
    const next = Math.round(clamp(base * multiplier, 24, n))
    const oldStart = n - viewOffset - base
    const anchorIndex = oldStart + base * anchorRatio
    const nextStart = anchorIndex - next * anchorRatio
    const nextOffset = clamp(n - next - nextStart, 0, Math.max(0, n - next))
    setVisibleBars(next)
    setViewOffset(Math.round(nextOffset))
  }

  function changeVisibleBars(multiplier) {
    zoomVisibleBars(multiplier, 1)
  }

  function handlePriceChartWheel(event) {
    if (!canZoom) return
    event.preventDefault()
    const rect = event.currentTarget?.getBoundingClientRect?.()
    const anchorRatio = rect
      ? clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0.05, 0.95)
      : 0.5
    zoomVisibleBars(event.deltaY < 0 ? 0.82 : 1.22, anchorRatio)
  }

  function panBy(delta) {
    if (!canPan) return
    setViewOffset(current => Math.max(0, Math.min(maxOffset, current + delta)))
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomVisibleBars(0.82, 0.5)
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        zoomVisibleBars(1.22, 0.5)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        panBy(12)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        panBy(-12)
      }
      if (event.key === '0') {
        event.preventDefault()
        setViewOffset(0)
        setPriceScale(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canPan, canZoom, maxOffset, n, activeVisibleBars, visibleBars, viewOffset])

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
    setPriceScale(1)
    setPricePanelHeightPx(null)
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

  function startResize(type, event) {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return
    event.preventDefault()
    setResizeState({
      type,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: pricePanelHeightPx ?? getBaseChartHeight(chartExpanded),
      startVisibleBars: activeVisibleBars,
      startViewOffset: viewOffset,
      startPriceScale: priceScale,
    })
  }

  const coreIndicators = [
    ['📊 SMA', showSMA, () => setShowSMA(value => !value)],
    ['📈 EMA', showEMA, () => setShowEMA(value => !value)],
    ['⚡ RSI', showRSI, () => setShowRSI(value => !value)],
    ['〰️ MACD', showMACD, () => setShowMACD(value => !value)],
    ['📦 Volume', showVolume, () => setShowVolume(value => !value)],
    ['🎯 VWAP', showVWAP, () => setShowVWAP(value => !value)],
    ['🫧 Bands', showBB, () => setShowBB(value => !value)],
    ['📏 ATR', showATR, () => setShowATR(value => !value)],
    ['⚙️ Stoch RSI', showStochRsi, () => setShowStochRsi(value => !value)],
    ['🧭 ADX', showADX, () => setShowADX(value => !value)],
    ['📚 OBV', showOBV, () => setShowOBV(value => !value)],
    ['🚦 Supertrend', showSupertrend, () => setShowSupertrend(value => !value)],
    ['📍 Pivot Points', showPivotPoints, () => setShowPivotPoints(value => !value)],
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
    chartType === 'candlestick' ? { label: 'Candles', color: OVERLAY_COLORS.candles, action: () => setChartType('line') } : null,
    chartType === 'line' ? { label: 'Line', color: OVERLAY_COLORS.line, action: () => setChartType('candlestick') } : null,
    chartType === 'area' ? { label: 'Area', color: OVERLAY_COLORS.area, action: () => setChartType('candlestick') } : null,
    showSMA ? { label: 'SMA 20', color: OVERLAY_COLORS.sma20, action: () => setShowSMA(false) } : null,
    showSMA ? { label: 'SMA 50', color: OVERLAY_COLORS.sma50, action: () => setShowSMA(false) } : null,
    showSMA ? { label: 'SMA 200', color: OVERLAY_COLORS.sma200, action: () => setShowSMA(false) } : null,
    showEMA ? { label: 'EMA 20', color: OVERLAY_COLORS.ema20, action: () => setShowEMA(false) } : null,
    showEMA ? { label: 'EMA 50', color: OVERLAY_COLORS.ema50, action: () => setShowEMA(false) } : null,
    showEMA ? { label: 'EMA 200', color: OVERLAY_COLORS.ema200, action: () => setShowEMA(false) } : null,
    showWMA ? { label: 'WMA 20', color: OVERLAY_COLORS.wma20, action: () => setShowWMA(false) } : null,
    showBB ? { label: 'BB Upper', color: OVERLAY_COLORS.bbUpper, action: () => setShowBB(false) } : null,
    showBB ? { label: 'BB Mid', color: OVERLAY_COLORS.bbMiddle, action: () => setShowBB(false) } : null,
    showBB ? { label: 'BB Lower', color: OVERLAY_COLORS.bbLower, action: () => setShowBB(false) } : null,
    showVWAP ? { label: 'VWAP', color: OVERLAY_COLORS.vwap, action: () => setShowVWAP(false) } : null,
    showSupertrend ? { label: 'Supertrend', color: OVERLAY_COLORS.supertrend, action: () => setShowSupertrend(false) } : null,
    showIchimoku ? { label: 'Ichimoku Tenkan', color: OVERLAY_COLORS.ichimokuTenkan, action: () => setShowIchimoku(false) } : null,
    showIchimoku ? { label: 'Ichimoku Kijun', color: OVERLAY_COLORS.ichimokuKijun, action: () => setShowIchimoku(false) } : null,
    showKeltner ? { label: 'Keltner Upper', color: OVERLAY_COLORS.keltnerUpper, action: () => setShowKeltner(false) } : null,
    showKeltner ? { label: 'Keltner Mid', color: OVERLAY_COLORS.keltnerMiddle, action: () => setShowKeltner(false) } : null,
    showKeltner ? { label: 'Keltner Lower', color: OVERLAY_COLORS.keltnerLower, action: () => setShowKeltner(false) } : null,
    showDonchian ? { label: 'Donchian Upper', color: OVERLAY_COLORS.donchianUpper, action: () => setShowDonchian(false) } : null,
    showDonchian ? { label: 'Donchian Mid', color: OVERLAY_COLORS.donchianMiddle, action: () => setShowDonchian(false) } : null,
    showDonchian ? { label: 'Donchian Lower', color: OVERLAY_COLORS.donchianLower, action: () => setShowDonchian(false) } : null,
    showLevels ? { label: 'Levels', color: OVERLAY_COLORS.levels, action: () => setShowLevels(false) } : null,
    showPivotPoints ? { label: 'Pivot Points', color: OVERLAY_COLORS.pivot, action: () => setShowPivotPoints(false) } : null,
    showPrevHighLow ? { label: 'Prev High', color: OVERLAY_COLORS.previousHigh, action: () => setShowPrevHighLow(false) } : null,
    showPrevHighLow ? { label: 'Prev Low', color: OVERLAY_COLORS.previousLow, action: () => setShowPrevHighLow(false) } : null,
    showHighLow52 ? { label: '52W High', color: OVERLAY_COLORS.high52, action: () => setShowHighLow52(false) } : null,
    showHighLow52 ? { label: '52W Low', color: OVERLAY_COLORS.low52, action: () => setShowHighLow52(false) } : null,
    showVolume ? { label: 'Volume', color: OVERLAY_COLORS.volume, action: () => setShowVolume(false) } : null,
    showVolumeMA ? { label: 'Volume MA', color: OVERLAY_COLORS.volumeMA, action: () => setShowVolumeMA(false) } : null,
    showRSI ? { label: 'RSI', color: OVERLAY_COLORS.rsi, action: () => setShowRSI(false) } : null,
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
    showMACD ? { label: 'MACD', color: OVERLAY_COLORS.macd, action: () => setShowMACD(false) } : null,
  ].filter(Boolean)

  const mainChartKeys = [
    showSMA ? { label: 'SMA 20', color: OVERLAY_COLORS.sma20 } : null,
    showSMA ? { label: 'SMA 50', color: OVERLAY_COLORS.sma50 } : null,
    showSMA ? { label: 'SMA 200', color: OVERLAY_COLORS.sma200 } : null,
    showEMA ? { label: 'EMA 20', color: OVERLAY_COLORS.ema20 } : null,
    showEMA ? { label: 'EMA 50', color: OVERLAY_COLORS.ema50 } : null,
    showEMA ? { label: 'EMA 200', color: OVERLAY_COLORS.ema200 } : null,
    showWMA ? { label: 'WMA 20', color: OVERLAY_COLORS.wma20 } : null,
    showBB ? { label: 'BB Upper', color: OVERLAY_COLORS.bbUpper } : null,
    showBB ? { label: 'BB Mid', color: OVERLAY_COLORS.bbMiddle } : null,
    showBB ? { label: 'BB Lower', color: OVERLAY_COLORS.bbLower } : null,
    showVWAP ? { label: 'VWAP', color: OVERLAY_COLORS.vwap } : null,
    showSupertrend ? { label: 'Supertrend', color: OVERLAY_COLORS.supertrend } : null,
    showPivotPoints ? { label: 'Pivot', color: OVERLAY_COLORS.pivot } : null,
    showPrevHighLow ? { label: 'Prev High', color: OVERLAY_COLORS.previousHigh } : null,
    showPrevHighLow ? { label: 'Prev Low', color: OVERLAY_COLORS.previousLow } : null,
    showHighLow52 ? { label: '52W High', color: OVERLAY_COLORS.high52 } : null,
    showHighLow52 ? { label: '52W Low', color: OVERLAY_COLORS.low52 } : null,
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
  const signalCount = technicalAnalysis?.indicatorInterpretations?.length ?? 0
  const chartCopy = language === 'he'
    ? {
        activeStructures: 'מבני גרף פעילים',
        patternRead: 'קריאת תבניות',
        found: 'נמצאו',
        noPattern: 'אין כרגע תבנית דומיננטית. אפשר להשתמש בגרף כדי לבדוק רמות מחיר בצורה ידנית.',
        strongestPattern: 'התבנית החזקה',
        breakout: 'פריצה',
        invalidation: 'ביטול',
        volume: 'מחזור',
        confirmed: 'מאושר',
        mixed: 'מעורב',
        developing: 'מתפתח',
        confidence: 'ביטחון',
        pattern: 'תבנית',
        technicalScore: 'ציון טכני',
        indicatorReadout: 'קריאת אינדיקטורים ותבניות',
        chartType: 'סוג גרף',
        candles: 'נרות',
        line: 'קו',
        area: 'שטח',
        indicators: 'אינדיקטורים',
        moreIndicators: 'עוד אינדיקטורים',
        analysisTools: 'כלי ניתוח',
        view: 'תצוגה',
        trendline: 'קו מגמה',
        horizontalLine: 'קו אופקי',
        fibonacci: 'פיבונאצ׳י',
        fibExtension: 'הרחבת פיבו',
        zone: 'אזור',
        patternMarkers: 'סימוני תבניות',
        ruler: 'סרגל %',
        collapse: 'צמצם',
        expand: 'הרחב',
        resetChart: 'איפוס גרף',
        clearDrawings: 'נקה סימונים',
        zoomIn: 'הגדל',
        zoomOut: 'הקטן',
        fitLatest: 'התאם לאחרון',
        older: 'ישן יותר',
        newer: 'חדש יותר',
        summary: 'סיכום',
        patternsWord: 'תבניות',
        signalsWord: 'איתותים',
        priceChart: 'גרף מחיר',
        priceChartSubtitle: `${currentTicker} · ${chartType === 'candlestick' ? 'נרות' : chartType === 'area' ? 'שטח' : 'קו'}`,
        measuringHint: 'גרור על גבי הגרף כדי למדוד אחוז שינוי ומרחק במספר נרות.',
        barsFeed: 'נרות · פיד',
        volumeSubtitle: 'אישור מהמחזור עם עמודות צבועות וממוצע מחזור',
        rsiPanel: 'פאנל RSI',
        macdPanel: 'פאנל MACD',
        disclaimerFoot: 'השתמש בהסתברות ובניהול סיכון, לא בוודאות.',
        risk: 'סיכון',
      }
    : {
        activeStructures: 'Active chart structures',
        patternRead: 'Pattern read',
        found: 'found',
        noPattern: 'No dominant pattern is active right now. Use the chart for level-by-level price inspection.',
        strongestPattern: 'Strongest pattern',
        breakout: 'Breakout',
        invalidation: 'Invalidation',
        volume: 'Volume',
        confirmed: 'Confirmed',
        mixed: 'Mixed',
        developing: 'Developing',
        confidence: 'Confidence',
        pattern: 'Pattern',
        technicalScore: 'Technical score',
        indicatorReadout: 'Indicator and pattern readout',
        chartType: 'Chart type',
        candles: 'Candles',
        line: 'Line',
        area: 'Area',
        indicators: 'Indicators',
        moreIndicators: 'More indicators',
        analysisTools: 'Analysis tools',
        view: 'View',
        trendline: 'Trendline',
        horizontalLine: 'Horizontal line',
        fibonacci: 'Fibonacci',
        fibExtension: 'Fib extension',
        zone: 'Zone',
        patternMarkers: 'Pattern markers',
        ruler: '% ruler',
        collapse: 'Collapse',
        expand: 'Expand',
        resetChart: 'Reset chart',
        clearDrawings: 'Clear drawings',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        fitLatest: 'Fit latest',
        older: 'Older',
        newer: 'Newer',
        summary: 'Summary',
        patternsWord: 'patterns',
        signalsWord: 'signals',
        priceChart: 'Price chart',
        priceChartSubtitle: `${currentTicker} · ${chartType === 'candlestick' ? 'Candlestick' : chartType === 'area' ? 'Area' : 'Line'} view`,
        measuringHint: 'Drag on the price panel to measure percentage move and distance in bars.',
        barsFeed: 'bars · feed',
        volumeSubtitle: 'Confirmation panel with color-coded bars and average volume',
        rsiPanel: 'RSI panel',
        macdPanel: 'MACD panel',
        disclaimerFoot: 'Use probability and risk, not certainty.',
        risk: 'Risk',
      }

  const resolvedPriceChartHeight = pricePanelHeightPx ?? getBaseChartHeight(chartExpanded)
  const resizeHint = language === 'he'
    ? 'גרור בתוך הגרף להזזה, גלגלת לזום, צד ימין לסקאלת מחיר ותחתית לצפיפות נרות'
    : 'Drag inside to pan, wheel to zoom, right rail for price scale, bottom rail for candle density'

  return (
    <section className="space-y-4">

      <div className="grid gap-4">
        {false && measureMode && (
          <div className="rounded-2xl border border-cyan-400/18 bg-cyan-400/10 px-4 py-3 text-xs font-medium text-cyan-100">
            Drag on the price panel to measure percentage move and distance in bars.
          </div>
        )}

        <div className="hidden lg:block">
          <div className="grid gap-4">
            <ChartControls
              chartType={chartType}
              setChartType={setChartType}
              coreIndicators={coreIndicators}
              advancedIndicatorGroups={advancedIndicatorGroups}
              chartCopy={chartCopy}
              showTriangles={showTriangles}
              setShowTriangles={setShowTriangles}
              showLevels={showLevels}
              setShowLevels={setShowLevels}
              showFibonacci={showFibonacci}
              setShowFibonacci={setShowFibonacci}
              showFibExtension={showFibExtension}
              setShowFibExtension={setShowFibExtension}
              showGaps={showGaps}
              setShowGaps={setShowGaps}
              showPatterns={showPatterns}
              setShowPatterns={setShowPatterns}
              measureMode={measureMode}
              setMeasureMode={setMeasureMode}
              chartExpanded={chartExpanded}
              setChartExpanded={setChartExpanded}
              handleResetChart={handleResetChart}
              handleClearDrawings={handleClearDrawings}
              changeVisibleBars={changeVisibleBars}
              canZoom={canZoom}
              canPan={canPan}
              setViewOffset={setViewOffset}
            />

            <PresetControls
              chartCopy={chartCopy}
              language={language}
              selectedPresetId={selectedPresetId}
              handleSelectPreset={handleSelectPreset}
              canPan={canPan}
              panBy={panBy}
              viewOffset={viewOffset}
              activeLegend={activeLegend}
              activeVisibleBars={activeVisibleBars}
              totalBars={n}
              interval={interval}
            />
          </div>
        </div>

        <ChartContainer
          title={chartCopy.priceChart}
          subtitle={chartCopy.priceChartSubtitle}
          height="h-auto"
          className="transition-[width] duration-150"
          bodyClassName="relative"
          bodyStyle={{ height: `${resolvedPriceChartHeight}px` }}
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
          <div className="mb-3 hidden items-center justify-between gap-3 text-xs text-slate-400 lg:flex">
            <span>{resizeHint}</span>
            <span>{activeVisibleBars} bars · Y {priceScale.toFixed(2)}x</span>
          </div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-400 md:hidden">
            <span>{language === 'he' ? 'צופה ב-' : 'Viewing:'}</span>
            <strong className="text-white">{INTERVAL_LABELS[language]?.[interval] ?? interval}</strong>
          </div>
          {mainChartKeys.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {mainChartKeys.map(item => <SeriesKey key={`${item.label}-${item.color}`} label={item.label} color={item.color} />)}
            </div>
          )}
          <button
            type="button"
            aria-label="Adjust price scale"
            onPointerDown={event => startResize('priceScale', event)}
            className="absolute inset-y-8 right-1 z-10 hidden w-3 cursor-ns-resize items-center justify-center rounded-full lg:flex"
          >
            <span className="h-16 w-1 rounded-full bg-cyan-400/70 shadow-[0_0_18px_rgba(34,211,238,0.55)]" />
          </button>
          <button
            type="button"
            aria-label="Adjust candle density"
            onPointerDown={event => startResize('timeScale', event)}
            className="absolute bottom-1 left-12 right-12 z-10 hidden h-3 cursor-ew-resize items-center justify-center rounded-full lg:flex"
          >
            <span className="h-1 w-full rounded-full bg-cyan-400/70 shadow-[0_0_18px_rgba(34,211,238,0.55)]" />
          </button>
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
              language={language}
              technicalAnalysis={technicalAnalysis}
              demoAccount={paperTradingAccount}
              interval={interval}
              visibleBars={activeVisibleBars}
              viewOffset={viewOffset}
              priceScale={priceScale}
              measurementEnabled={measureMode}
              hoveredIndex={hoveredIndex}
              onHoverIndexChange={setHoveredIndex}
              onPanBars={panBy}
            />
          </SafeChart>
        </ChartContainer>

        {measureMode && (
          <div className="rounded-2xl border border-cyan-400/18 bg-cyan-400/10 px-4 py-3 text-xs font-medium text-cyan-100">
            {chartCopy.measuringHint}
          </div>
        )}

        <div className="lg:hidden">
          <div className="grid gap-4">
            <ChartControls
              chartType={chartType}
              setChartType={setChartType}
            coreIndicators={coreIndicators}
            advancedIndicatorGroups={advancedIndicatorGroups}
            chartCopy={chartCopy}
            showTriangles={showTriangles}
            setShowTriangles={setShowTriangles}
            showLevels={showLevels}
            setShowLevels={setShowLevels}
            showFibonacci={showFibonacci}
            setShowFibonacci={setShowFibonacci}
            showFibExtension={showFibExtension}
            setShowFibExtension={setShowFibExtension}
            showGaps={showGaps}
            setShowGaps={setShowGaps}
            showPatterns={showPatterns}
            setShowPatterns={setShowPatterns}
            measureMode={measureMode}
            setMeasureMode={setMeasureMode}
            chartExpanded={chartExpanded}
            setChartExpanded={setChartExpanded}
            handleResetChart={handleResetChart}
            handleClearDrawings={handleClearDrawings}
            changeVisibleBars={changeVisibleBars}
            canZoom={canZoom}
            canPan={canPan}
            setViewOffset={setViewOffset}
          />

          <PresetControls
            chartCopy={chartCopy}
            language={language}
            selectedPresetId={selectedPresetId}
            handleSelectPreset={handleSelectPreset}
            canPan={canPan}
            panBy={panBy}
            viewOffset={viewOffset}
              activeLegend={activeLegend}
              activeVisibleBars={activeVisibleBars}
              totalBars={n}
              interval={interval}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {chartCopy.summary} · {patternSummary.length} {chartCopy.patternsWord} · {signalCount} {chartCopy.signalsWord}
            </div>
            <button className="text-primary text-xs font-bold hover:underline">
              {showDetails ? (language === 'he' ? 'הסתר פירוט' : 'Hide Details') : (language === 'he' ? 'הצג פירוט' : 'Show Details')}
            </button>
          </div>
          {showDetails && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <PatternSummaryCard patterns={patternSummary} copy={chartCopy} />
              <IndicatorSummaryCard analysis={technicalAnalysis} copy={chartCopy} />
            </div>
          )}
        </div>

        {showVolume && (
          <ChartContainer
            title={chartCopy.volume}
            subtitle={chartCopy.volumeSubtitle}
            height="h-[170px] sm:h-[190px]"
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <SeriesKey label="Volume" color={OVERLAY_COLORS.volume} />
              {showVolumeMA && <SeriesKey label="Volume MA" color={OVERLAY_COLORS.volumeMA} />}
            </div>
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
                title={chartCopy.rsiPanel}
                subtitle={`RSI (14)${rsiLast != null ? ` · ${rsiLast.toFixed(1)}` : ''}`}
                height="h-[190px]"
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  <SeriesKey label="RSI 14" color={OVERLAY_COLORS.rsi} />
                  <SeriesKey label="70 overbought" color="rgba(244, 63, 94, 0.52)" />
                  <SeriesKey label="30 oversold" color="rgba(16, 185, 129, 0.52)" />
                </div>
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
                title={chartCopy.macdPanel}
                subtitle={`MACD (12, 26, 9)${macdLine != null && macdSignal != null ? ` · ${macdLine.toFixed(2)} / ${macdSignal.toFixed(2)}` : ''}`}
                height="h-[190px]"
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  <SeriesKey label="MACD" color={OVERLAY_COLORS.macd} />
                  <SeriesKey label="Signal" color={OVERLAY_COLORS.macdSignal} />
                  <SeriesKey label="Histogram +" color="#22c55e" />
                  <SeriesKey label="Histogram -" color="#ef4444" />
                </div>
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
                <div className="mb-3 flex flex-wrap gap-2">
                  {panel.datasets.map(dataset => (
                    <SeriesKey key={`${panel.key}-${dataset.label}`} label={dataset.label} color={dataset.color} />
                  ))}
                </div>
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
            {technicalAnalysis?.disclaimer ?? (language === 'he'
              ? 'הניתוח הטכני מיועד למטרות לימוד ומידע בלבד. הוא אינו ייעוץ פיננסי או המלצת מסחר.'
              : 'This technical analysis is for educational and informational purposes only. It is not financial advice or a trading recommendation.')}
          </div>
          <div className="text-xs text-slate-500">
            {chartCopy.disclaimerFoot}
          </div>
        </div>
      </div>
    </section>
  )
}
