import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import useStore from './store/useStore'
import useTicker from './hooks/useTicker'
import useIndicators from './hooks/useIndicators'
import useSignal from './hooks/useSignal'
import useSocket from './hooks/useSocket'
import useMultiTimeframe from './hooks/useMultiTimeframe'
import useMarketContext from './hooks/useMarketContext'
import Layout from './components/layout/Layout'
import ChartContainer from './components/charts/ChartContainer'
import ChartErrorBoundary from './components/charts/ChartErrorBoundary'
import PriceChart from './components/charts/PriceChart'
import VolumeChart from './components/charts/VolumeChart'
import RsiChart from './components/charts/RsiChart'
import StochChart from './components/charts/StochChart'
import WilliamsRChart from './components/charts/WilliamsRChart'
import MacdChart from './components/charts/MacdChart'
import EarningsPanel from './components/analysis/EarningsPanel'
import ForecastOpinionPanel from './components/analysis/ForecastOpinionPanel'
import MarketContextPanel from './components/analysis/MarketContextPanel'
import MarketTradeAlert from './components/analysis/MarketTradeAlert'
import SignalPanel from './components/analysis/SignalPanel'
import AdvancedTrendsPanel from './components/analysis/AdvancedTrendsPanel'
import AnalysisResultCard from './components/analysis/AnalysisResultCard'
import HeroSection from './components/marketing/HeroSection'
import TrustSection from './components/marketing/TrustSection'
import Badge from './components/ui/Badge'
import Button from './components/ui/Button'
import Card from './components/ui/Card'
import ErrorState from './components/ui/ErrorState'
import KpiCard from './components/ui/KpiCard'
import LoadingState from './components/ui/LoadingState'
import SectionTitle from './components/ui/SectionTitle'
import Spinner from './components/ui/Spinner'
import { fmtVolume, fmtPercent, fmtPrice } from './lib/formatters'
import { computeForecastOpinion } from './lib/forecastOpinion'
import { buildAnalysisResult } from './lib/analysisResult'

const FG_COLOR = value => (
  value >= 75 ? 'text-green-400'
    : value >= 55 ? 'text-lime-400'
    : value >= 45 ? 'text-yellow-400'
    : value >= 25 ? 'text-orange-400'
    : 'text-red-400'
)

const FG_LABEL_HE = classification => ({
  'Extreme Greed': 'חמדנות קיצונית',
  Greed: 'חמדנות',
  Neutral: 'ניטרלי',
  Fear: 'פחד',
  'Extreme Fear': 'פחד קיצוני',
})[classification] ?? classification

const DEFAULT_VISIBLE_BARS = {
  '1m': 120,
  '5m': 120,
  '15m': 120,
  '1h': 160,
  '4h': 160,
  '1d': 180,
  '1mo': 23,
  '1y': 252,
  '5y': 260,
}

const EXAMPLES = [
  { ticker: 'AAPL', title: 'Mega-cap trend read', summary: 'Balanced market leader with strong support around moving averages.' },
  { ticker: 'NVDA', title: 'Momentum vs valuation tension', summary: 'High-upside setup with elevated volatility and sentiment extremes.' },
  { ticker: 'TSLA', title: 'Risk-heavy swing example', summary: 'Useful for seeing how the model handles mixed trend and event risk.' },
]

const PRODUCT_FEATURES = [
  { title: 'Recent analysis examples', body: 'One-click demo presets make the landing page feel like a product, not just a blank dashboard.' },
  { title: 'Saved watchlist placeholder', body: 'The watchlist module remains available and now reads like part of a larger workflow.' },
  { title: 'Compare mode placeholder', body: 'A compare-two-stocks CTA is surfaced to signal roadmap direction without pretending full support exists.' },
  { title: 'Shareable report CTA', body: 'A lightweight report action makes it easier to imagine sharing the AI output with teammates or clients.' },
]

function SafeChart({ isLoading, resetKey, children }) {
  if (isLoading) return <Spinner />
  return <ChartErrorBoundary resetKey={resetKey}>{children}</ChartErrorBoundary>
}

function chartToggleClass(active, activeClass = 'bg-primary text-surface-muted shadow-[0_0_10px_rgba(34,211,238,0.22)]') {
  return `rounded-full border px-3 py-1 text-xs font-medium transition-all ${
    active
      ? activeClass
      : 'border-white/10 bg-surface-muted/35 text-slate-400 hover:bg-surface-bright/50 hover:text-white'
  }`
}

function TriangleChartPanel({ triangles, language }) {
  const isHebrew = language === 'he'
  const labels = {
    title: isHebrew ? 'Triangles on chart' : 'Triangles on chart',
    empty: isHebrew
      ? 'No active triangle was found on this timeframe. Try another range like 1D / 1H or show more candles.'
      : 'No active triangle was found on this timeframe. Try another range like 1D / 1H or show more candles.',
    found: isHebrew ? 'Found' : 'Found',
    resistance: isHebrew ? 'Resistance' : 'Resistance',
    support: isHebrew ? 'Support' : 'Support',
    target: isHebrew ? 'Target' : 'Target',
    completion: isHebrew ? 'Completion' : 'Completion',
    hint: isHebrew
      ? 'When detected, the pattern lines are drawn directly on the price chart.'
      : 'When detected, the pattern lines are drawn directly on the price chart.',
  }
  const typeLabel = {
    ascending: 'Ascending triangle',
    descending: 'Descending triangle',
    symmetrical: 'Symmetrical triangle',
    expanding: 'Megaphone / expanding triangle',
  }

  return (
    <div className="glass-panel border-emerald-500/20 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-emerald-200">{labels.title}</div>
          <div className="mt-0.5 text-xs text-emerald-300/75">{labels.hint}</div>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-300">
          {labels.found}: {triangles.length}
        </span>
      </div>

      {triangles.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-800/50 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-400">{labels.empty}</div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {triangles.map(triangle => {
            const target = triangle.direction === 'bearish' ? triangle.targetDown : triangle.targetUp
            return (
              <div key={`${triangle.key}-${triangle.status}`} className="rounded-lg border border-slate-800/50 bg-slate-900/40 p-3 text-xs text-slate-300">
                <div className="font-black text-white">{typeLabel[triangle.type] ?? triangle.type}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="text-slate-500">{labels.resistance}</span><span className="font-mono text-orange-300">{fmtPrice(triangle.resistance)}</span>
                  <span className="text-slate-500">{labels.support}</span><span className="font-mono text-cyan-300">{fmtPrice(triangle.support)}</span>
                  <span className="text-slate-500">{labels.target}</span><span className="font-mono text-green-300">{fmtPrice(target)}</span>
                  <span className="text-slate-500">{labels.completion}</span><span className="font-mono text-emerald-300">{triangle.completionPct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FeaturePreviewSection({ onAnalyzeTicker }) {
  return (
    <section className="space-y-6">
      <SectionTitle
        eyebrow="Product surface"
        title="Demo affordances that make the experience feel closer to a real financial AI product."
        subtitle="These sections are intentionally lightweight, but they frame the dashboard as part of a broader workflow rather than a one-off technical prototype."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {PRODUCT_FEATURES.map(item => (
          <Card key={item.title} className="rounded-2xl p-5">
            <div className="text-sm font-bold text-white">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Recent analysis examples</div>
              <div className="mt-2 text-lg font-bold text-white">Jump into a realistic demo flow</div>
            </div>
            <Badge tone="balanced">Example presets</Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {EXAMPLES.map(example => (
              <button
                key={example.ticker}
                className="rounded-2xl border border-white/6 bg-slate-950/40 p-4 text-left transition-colors hover:border-primary/25 hover:bg-slate-950/60"
                onClick={() => onAnalyzeTicker(example.ticker)}
                type="button"
              >
                <div className="text-sm font-bold text-white">{example.title}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-primary/80">{example.ticker}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{example.summary}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Next workflow placeholders</div>
          <div className="mt-2 text-lg font-bold text-white">Compare, save, and share</div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-white">Compare two stocks</div>
              <div className="mt-1 text-sm text-slate-400">Placeholder CTA for side-by-side AI outlooks on two names.</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-white">Saved watchlist workflow</div>
              <div className="mt-1 text-sm text-slate-400">Keep commonly analyzed names one click away in the sidebar and hero.</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-white">Shareable report button</div>
              <div className="mt-1 text-sm text-slate-400">A lightweight CTA is included below the main analysis to support future sharing flows.</div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

export default function App() {
  const {
    currentTicker,
    interval,
    ohlcv,
    snapshot,
    isLoading,
    error,
    language,
    setCurrentTicker,
    watchlist,
    lastLoadedTicker,
    bumpAnalysisRun,
  } = useStore()

  const isHebrew = language === 'he'
  const indicators = useIndicators(ohlcv)
  const signal = useSignal(ohlcv, indicators, language)
  const { isConnected } = useSocket()
  const { data: multiTimeframe, isLoading: isMultiTimeframeLoading } = useMultiTimeframe(currentTicker)
  const { data: marketContext, isLoading: isMarketContextLoading } = useMarketContext(currentTicker)

  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showBB, setShowBB] = useState(false)
  const [showFibonacci, setShowFibonacci] = useState(false)
  const [showGaps, setShowGaps] = useState(true)
  const [showPatterns, setShowPatterns] = useState(true)
  const [showTriangles, setShowTriangles] = useState(false)
  const [cleanChart, setCleanChart] = useState(false)
  const [chartType, setChartType] = useState('candlestick')
  const [chartExpanded, setChartExpanded] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [visibleBars, setVisibleBars] = useState(null)
  const [fearGreed, setFearGreed] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [isEarningsLoading, setIsEarningsLoading] = useState(false)
  const [isBackendSlow, setIsBackendSlow] = useState(false)
  const [copiedReport, setCopiedReport] = useState(false)

  useTicker()

  useEffect(() => {
    axios.get('/api/market/feargreed').then(response => {
      setFearGreed(response.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setVisibleBars(null)
  }, [currentTicker, interval])

  useEffect(() => {
    let cancelled = false
    setIsEarningsLoading(true)
    setEarnings(null)

    axios.get(`/api/market/earnings/${currentTicker}`, { timeout: 20000 })
      .then(response => {
        if (!cancelled) setEarnings(response.data)
      })
      .catch(() => {
        if (!cancelled) setEarnings(null)
      })
      .finally(() => {
        if (!cancelled) setIsEarningsLoading(false)
      })

    return () => { cancelled = true }
  }, [currentTicker])

  const forecast = useMemo(() => computeForecastOpinion({
    ohlcv,
    indicators,
    signal,
    interval,
    earnings,
    multiTimeframe,
    marketContext,
    language,
  }), [ohlcv, indicators, signal, interval, earnings, multiTimeframe, marketContext, language])

  const analysisResult = useMemo(() => buildAnalysisResult({
    forecast,
    signal,
    marketContext,
    earnings,
  }), [earnings, forecast, marketContext, signal])

  const last = ohlcv[ohlcv.length - 1]
  const n = ohlcv.length
  const sma20Last = indicators?.sma20?.[n - 1]
  const rsiLast = indicators?.rsi14?.[n - 1]
  const stochLast = indicators?.stoch?.k?.[n - 1]
  const willRLast = indicators?.willR?.[n - 1]
  const chartResetKey = `${ohlcv[0]?.t ?? 0}-${ohlcv[n - 1]?.t ?? 0}-${n}-${chartType}`
  const patternResetKey = `${signal?.patterns?.score ?? 0}-${signal?.patterns?.best?.key ?? 'none'}`
  const defaultVisibleBars = DEFAULT_VISIBLE_BARS[interval] ?? n
  const activeVisibleBars = Math.min(n, visibleBars ?? defaultVisibleBars)
  const canZoom = n > 30
  const chartShowSMA = !cleanChart && showSMA
  const chartShowEMA = !cleanChart && showEMA
  const chartShowBB = !cleanChart && showBB
  const chartShowFibonacci = !cleanChart && showFibonacci
  const chartShowGaps = !cleanChart && showGaps
  const chartShowPatterns = !cleanChart && showPatterns
  const chartShowTriangles = !cleanChart && showTriangles
  const chartShowLevels = !cleanChart
  const triangleList = signal?.trends?.triangles ?? []
  const overallLoading = isLoading || isMultiTimeframeLoading || isMarketContextLoading || isEarningsLoading

  useEffect(() => {
    if (!overallLoading) {
      setIsBackendSlow(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsBackendSlow(true)
    }, 3500)

    return () => window.clearTimeout(timeoutId)
  }, [overallLoading])

  const regime = signal?.gates?.trend?.regime
  const regimeLabel = {
    he: {
      uptrend: 'מגמה עולה',
      downtrend: 'מגמה יורדת',
      sideways: 'שוק צדי',
      unknown: 'לא ידוע',
    },
    en: {
      uptrend: 'Uptrend',
      downtrend: 'Downtrend',
      sideways: 'Sideways',
      unknown: 'Unknown',
    },
  }[language]?.[regime] ?? (isHebrew ? 'לא ידוע' : 'Unknown')

  const regimeColor = {
    uptrend: 'text-green-400',
    downtrend: 'text-red-400',
    sideways: 'text-yellow-400',
  }[regime] ?? 'text-slate-400'

  const copy = {
    changePct: isHebrew ? 'Change %' : 'Change %',
    high20: isHebrew ? '20-bar high' : '20-bar high',
    low20: isHebrew ? '20-bar low' : '20-bar low',
    trend: isHebrew ? 'Trend' : 'Trend',
    vsSma20: 'vs SMA20',
    candles: isHebrew ? 'Candles' : 'Candles',
    line: isHebrew ? 'Line' : 'Line',
    fib: 'Fibonacci',
    gaps: 'Gaps',
    patterns: 'Patterns',
    triangles: 'Triangles',
    cleanChart: isHebrew ? 'Clean chart' : 'Clean chart',
    expandChart: isHebrew ? 'Expand chart' : 'Expand chart',
    shrinkChart: isHebrew ? 'Shrink chart' : 'Shrink chart',
    measure: isHebrew ? '% ruler' : '% ruler',
    measuring: isHebrew ? 'Measure mode: drag on the chart to measure percent change.' : 'Measure mode: drag on the chart to measure percent change.',
    zoomIn: isHebrew ? 'Zoom +' : 'Zoom +',
    zoomOut: isHebrew ? 'Zoom -' : 'Zoom -',
    bars: isHebrew ? 'bars' : 'bars',
    all: isHebrew ? 'All' : 'All',
    showing: isHebrew ? 'Showing' : 'Showing',
    priceChart: isHebrew ? 'Price chart' : 'Price chart',
    volume: 'Volume',
  }

  const loadingSteps = useMemo(() => ([
    {
      label: 'Fetching market data...',
      detail: `Loading price history and snapshot for ${currentTicker}.`,
      state: snapshot ? 'done' : 'active',
    },
    {
      label: 'Analyzing news sentiment...',
      detail: 'Inferring event tone from earnings timing and broad market context.',
      state: !isMarketContextLoading && !isEarningsLoading ? 'done' : snapshot ? 'active' : 'queued',
    },
    {
      label: 'Comparing bullish and bearish signals...',
      detail: 'Scoring indicators, patterns, and multi-timeframe agreement.',
      state: signal && forecast ? 'done' : (!isLoading ? 'active' : 'queued'),
    },
    {
      label: 'Generating final outlook...',
      detail: 'Structuring the final TL;DR, confidence, risk, and action summary.',
      state: analysisResult ? 'done' : (signal ? 'active' : 'queued'),
    },
  ]), [analysisResult, currentTicker, forecast, isEarningsLoading, isLoading, isMarketContextLoading, signal, snapshot])

  function changeVisibleBars(multiplier) {
    if (!canZoom) return
    setVisibleBars(current => {
      const base = Math.min(n, current ?? activeVisibleBars)
      const next = Math.round(base * multiplier)
      if (next >= n) return n
      return Math.max(20, next)
    })
  }

  function zoomIn() {
    changeVisibleBars(0.65)
  }

  function zoomOut() {
    changeVisibleBars(1.55)
  }

  function handlePriceChartWheel(event) {
    if (!canZoom) return
    event.preventDefault()
    changeVisibleBars(event.deltaY < 0 ? 0.86 : 1.16)
  }

  function handleAnalyzeTicker(nextTicker) {
    if (!nextTicker) return
    setCurrentTicker(nextTicker.trim().toUpperCase())
  }

  function handleRetry() {
    bumpAnalysisRun()
  }

  async function handleShareReport() {
    if (!analysisResult || typeof navigator === 'undefined' || !navigator.clipboard) return

    const text = [
      `Stock Sense Demo report: ${currentTicker}`,
      `Sentiment: ${analysisResult.overallSentiment}`,
      `Confidence: ${analysisResult.confidenceScore}%`,
      `Risk: ${analysisResult.riskLevel}`,
      `Final outlook: ${analysisResult.finalOutlook}`,
      `Summary: ${analysisResult.summary}`,
    ].join('\n')

    await navigator.clipboard.writeText(text)
    setCopiedReport(true)
    window.setTimeout(() => setCopiedReport(false), 2000)
  }

  const smaDistPct = last && sma20Last ? (((last.c - sma20Last) / sma20Last) * 100).toFixed(1) : null
  const high20 = n ? Math.max(...ohlcv.slice(-20).map(bar => bar.h)).toFixed(2) : null
  const low20 = n ? Math.min(...ohlcv.slice(-20).map(bar => bar.l)).toFixed(2) : null

  return (
    <Layout isConnected={isConnected}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
        <HeroSection
          currentTicker={currentTicker}
          isLoading={overallLoading}
          onAnalyze={handleAnalyzeTicker}
          onPickTicker={handleAnalyzeTicker}
          watchlistCount={watchlist.length}
          lastLoadedTicker={lastLoadedTicker}
        />

        <FeaturePreviewSection onAnalyzeTicker={handleAnalyzeTicker} />
        <TrustSection />

        {overallLoading && !snapshot && (
          <LoadingState
            title="Preparing the analysis"
            subtitle="The system is building a structured market read before rendering the dashboard."
            steps={loadingSteps}
            hint={isBackendSlow ? 'The backend may be waking up on Render. If this is a cold start, the first request can take a little longer than usual.' : ''}
          />
        )}

        {error && !snapshot && (
          <ErrorState
            title="Analysis could not be completed"
            message="We could not assemble a usable market view for this ticker."
            detail={error}
            actionLabel="Retry analysis"
            onAction={handleRetry}
          />
        )}

        {snapshot && (
          <>
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <SectionTitle
                  eyebrow="Live analysis workspace"
                  title={`Reviewing ${currentTicker} like a financial AI product should`}
                  subtitle="The dashboard below keeps the tactical detail, while the structured AI result at the top makes the output easier to trust, question, and act on."
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={handleRetry}>Refresh analysis</Button>
                  <Button variant="ghost" className="border border-white/10" onClick={handleShareReport}>
                    {copiedReport ? 'Report copied' : 'Shareable report'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                <KpiCard label={copy.changePct} value={fmtPercent(snapshot.changePct)} color={snapshot.changePct >= 0 ? 'text-green-400' : 'text-red-400'} />
                <KpiCard label={copy.high20} value={high20 ? `$${high20}` : '-'} />
                <KpiCard label={copy.low20} value={low20 ? `$${low20}` : '-'} />
                <KpiCard label="Volume" value={fmtVolume(snapshot.volume)} />
                <KpiCard label="RSI (14)" value={rsiLast?.toFixed(1) ?? '-'} color={rsiLast < 30 ? 'text-green-400' : rsiLast > 70 ? 'text-red-400' : 'text-white'} />
                <KpiCard label="Stoch %K" value={stochLast?.toFixed(1) ?? '-'} color={stochLast < 20 ? 'text-green-400' : stochLast > 80 ? 'text-red-400' : 'text-white'} />
                <KpiCard label={copy.trend} value={regimeLabel} color={regimeColor} />
                {fearGreed?.value != null ? (
                  <KpiCard label="Fear & Greed" value={`${fearGreed.value} - ${isHebrew ? FG_LABEL_HE(fearGreed.classification) : fearGreed.classification}`} color={FG_COLOR(fearGreed.value)} />
                ) : (
                  <KpiCard
                    label={copy.vsSma20}
                    value={smaDistPct != null ? `${parseFloat(smaDistPct) >= 0 ? '+' : ''}${smaDistPct}%` : '-'}
                    color={smaDistPct != null ? (parseFloat(smaDistPct) >= 0 ? 'text-green-400' : 'text-red-400') : ''}
                  />
                )}
              </div>

              {analysisResult && (
                <AnalysisResultCard
                  language={language}
                  summary={analysisResult.summary}
                  sentiment={analysisResult.overallSentiment}
                  confidenceScore={analysisResult.confidenceScore}
                  riskLevel={analysisResult.riskLevel}
                  bullCase={analysisResult.bullCase}
                  bearCase={analysisResult.bearCase}
                  keyRisks={analysisResult.keyRisks}
                  newsSentiment={analysisResult.newsSentiment}
                  technicalOutlook={analysisResult.technicalOutlook}
                  finalOutlook={analysisResult.finalOutlook}
                />
              )}

              {error && snapshot && (
                <ErrorState
                  title="Analysis loaded with warnings"
                  message="Some modules may be delayed or partially unavailable, but the dashboard is still usable."
                  detail={error}
                  actionLabel="Retry analysis"
                  onAction={handleRetry}
                />
              )}
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className={`flex flex-col gap-4 ${cleanChart || chartExpanded ? 'xl:col-span-3' : 'xl:col-span-2'}`}>
                {!cleanChart && (
                  <MarketTradeAlert marketContext={marketContext} isLoading={isMarketContextLoading} language={language} />
                )}

                <Card className="rounded-2xl p-4">
                  <div className="-mx-1 overflow-x-auto px-1">
                    <div className="flex min-w-max flex-nowrap gap-2 pb-1 sm:flex-wrap sm:pb-0">
                      {[['candlestick', copy.candles], ['line', copy.line]].map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => setChartType(value)}
                          className={chartToggleClass(chartType === value)}
                        >
                          {label}
                        </button>
                      ))}
                      <div className="mx-1 w-px bg-white/10" />
                      {[
                        ['showSMA', showSMA, setShowSMA, 'SMA 20'],
                        ['showEMA', showEMA, setShowEMA, 'EMA 50'],
                        ['showBB', showBB, setShowBB, 'BB'],
                      ].map(([key, value, setter, label]) => (
                        <button
                          key={key}
                          onClick={() => setter(!value)}
                          className={chartToggleClass(!cleanChart && value, 'border-slate-500/30 bg-slate-200/10 text-white')}
                        >
                          {label}
                        </button>
                      ))}
                      <div className="mx-1 w-px bg-white/10" />
                      {[
                        ['showFibonacci', showFibonacci, setShowFibonacci, copy.fib],
                        ['showGaps', showGaps, setShowGaps, copy.gaps],
                        ['showPatterns', showPatterns, setShowPatterns, copy.patterns],
                        ['showTriangles', showTriangles, setShowTriangles, copy.triangles],
                      ].map(([key, value, setter, label]) => (
                        <button
                          key={key}
                          onClick={() => setter(!value)}
                          className={chartToggleClass(!cleanChart && value, 'border-emerald-500/30 bg-emerald-500/20 text-emerald-100')}
                        >
                          {label}{key === 'showTriangles' ? ` (${triangleList.length})` : ''}
                        </button>
                      ))}
                      <button
                        onClick={() => setMeasureMode(value => !value)}
                        className={chartToggleClass(measureMode, 'border-cyan-500/30 bg-cyan-500/20 text-cyan-100')}
                      >
                        {copy.measure}
                      </button>
                      <button
                        onClick={() => setChartExpanded(value => !value)}
                        className={chartToggleClass(chartExpanded)}
                      >
                        {chartExpanded ? copy.shrinkChart : copy.expandChart}
                      </button>
                      <button
                        onClick={() => setCleanChart(value => !value)}
                        className={chartToggleClass(cleanChart, 'border-amber-500/30 bg-amber-500/20 text-amber-100')}
                      >
                        {copy.cleanChart}
                      </button>
                      <div className="mx-1 w-px bg-white/10" />
                      <button
                        onClick={zoomIn}
                        disabled={!canZoom}
                        className="rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-surface-bright/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {copy.zoomIn}
                      </button>
                      <button
                        onClick={zoomOut}
                        disabled={!canZoom}
                        className="rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-surface-bright/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {copy.zoomOut}
                      </button>
                      {[
                        [50, '50'],
                        [100, '100'],
                        [200, '200'],
                      ].map(([bars, label]) => (
                        <button
                          key={bars}
                          onClick={() => setVisibleBars(Math.min(n, bars))}
                          disabled={!canZoom}
                          className={`${chartToggleClass(activeVisibleBars === Math.min(n, bars))} disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {label} {copy.bars}
                        </button>
                      ))}
                      <button
                        onClick={() => setVisibleBars(n)}
                        disabled={!canZoom}
                        className={`${chartToggleClass(activeVisibleBars === n)} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {copy.all}
                      </button>
                      <span className="self-center whitespace-nowrap text-xs text-slate-500">
                        {copy.showing} {Math.min(activeVisibleBars, n)}/{n} {copy.bars}
                      </span>
                    </div>
                  </div>
                </Card>

                {!cleanChart && measureMode && (
                  <div className="rounded-2xl border border-cyan-400/14 bg-cyan-400/8 px-4 py-3 text-xs font-semibold text-cyan-100" dir={isHebrew ? 'rtl' : 'ltr'}>
                    {copy.measuring}
                  </div>
                )}

                {!cleanChart && showTriangles && (
                  <TriangleChartPanel triangles={triangleList} language={language} />
                )}

                <ChartContainer title={copy.priceChart} height={chartExpanded ? 'h-[72vh]' : 'h-[320px] sm:h-[380px] md:h-[560px]'} onWheel={handlePriceChartWheel}>
                  <SafeChart isLoading={isLoading} resetKey={`price-${chartResetKey}-${chartShowSMA}-${chartShowEMA}-${chartShowBB}-${chartShowFibonacci}-${chartShowGaps}-${chartShowPatterns}-${chartShowTriangles}-${chartShowLevels}-${patternResetKey}-${activeVisibleBars}`}>
                    <PriceChart
                      ohlcv={ohlcv}
                      indicators={indicators}
                      showSMA={chartShowSMA}
                      showEMA={chartShowEMA}
                      showBB={chartShowBB}
                      chartType={chartType}
                      patterns={signal?.patterns}
                      gaps={signal?.pro?.gaps}
                      showFibonacci={chartShowFibonacci}
                      showGaps={chartShowGaps}
                      showPatterns={chartShowPatterns}
                      showTriangles={chartShowTriangles}
                      showLevels={chartShowLevels}
                      ticker={currentTicker}
                      decision={signal?.decision}
                      interval={interval}
                      visibleBars={activeVisibleBars}
                      measurementEnabled={measureMode}
                    />
                  </SafeChart>
                </ChartContainer>

                {!cleanChart && chartType !== 'candlestick' && (
                  <ChartContainer title={copy.volume} height="h-20 sm:h-24">
                    <SafeChart isLoading={isLoading} resetKey={`volume-${chartResetKey}`}>
                      <VolumeChart ohlcv={ohlcv} interval={interval} visibleBars={activeVisibleBars} />
                    </SafeChart>
                  </ChartContainer>
                )}

                {!cleanChart && (
                  <>
                    <ChartContainer title={`RSI (14)${rsiLast != null ? ` - ${rsiLast.toFixed(1)}` : ''}`} height="h-24 sm:h-28">
                      <SafeChart isLoading={isLoading} resetKey={`rsi-${chartResetKey}`}>
                        <RsiChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                      </SafeChart>
                    </ChartContainer>

                    <ChartContainer title={`Stochastic %K${stochLast != null ? ` - ${stochLast.toFixed(1)}` : ''}`} height="h-24 sm:h-28">
                      <SafeChart isLoading={isLoading} resetKey={`stoch-${chartResetKey}`}>
                        <StochChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                      </SafeChart>
                    </ChartContainer>

                    <ChartContainer title={`Williams %R${willRLast != null ? ` - ${willRLast.toFixed(1)}` : ''}`} height="h-24 sm:h-28">
                      <SafeChart isLoading={isLoading} resetKey={`willr-${chartResetKey}`}>
                        <WilliamsRChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                      </SafeChart>
                    </ChartContainer>

                    <ChartContainer title="MACD (12, 26, 9)" height="h-24 sm:h-28">
                      <SafeChart isLoading={isLoading} resetKey={`macd-${chartResetKey}`}>
                        <MacdChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                      </SafeChart>
                    </ChartContainer>
                  </>
                )}
              </div>

              {!cleanChart && !chartExpanded && (
                <div className="flex flex-col gap-4">
                  <ForecastOpinionPanel forecast={forecast} isLoading={isMultiTimeframeLoading} language={language} />
                  <MarketContextPanel marketContext={marketContext} isLoading={isMarketContextLoading} language={language} />
                  <EarningsPanel earnings={earnings} isLoading={isEarningsLoading} language={language} />
                  <AdvancedTrendsPanel trends={signal?.trends} language={language} />
                  <SignalPanel signal={signal} language={language} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
