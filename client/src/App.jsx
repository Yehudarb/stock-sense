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
import ChartWorkspace from './components/charts/ChartWorkspace'
import EarningsPanel from './components/analysis/EarningsPanel'
import ForecastOpinionPanel from './components/analysis/ForecastOpinionPanel'
import MarketContextPanel from './components/analysis/MarketContextPanel'
import MarketTradeAlert from './components/analysis/MarketTradeAlert'
import SignalPanel from './components/analysis/SignalPanel'
import AdvancedTrendsPanel from './components/analysis/AdvancedTrendsPanel'
import AnalysisResultCard from './components/analysis/AnalysisResultCard'
import TechnicalAnalysisPanel from './components/analysis/TechnicalAnalysisPanel'
import HeroSection from './components/marketing/HeroSection'
import TrustSection from './components/marketing/TrustSection'
import Button from './components/ui/Button'
import ErrorState from './components/ui/ErrorState'
import KpiCard from './components/ui/KpiCard'
import LoadingState from './components/ui/LoadingState'
import SectionTitle from './components/ui/SectionTitle'
import { fmtVolume, fmtPercent } from './lib/formatters'
import { computeForecastOpinion } from './lib/forecastOpinion'
import { buildAnalysisResult } from './lib/analysisResult'
import useTechnicalAnalysis from './hooks/useTechnicalAnalysis'

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

const EXAMPLES = [
  { ticker: 'AAPL', title: 'Trend overview', summary: 'Quickly see whether the chart is steady, stretched, or turning.' },
  { ticker: 'NVDA', title: 'Risk snapshot', summary: 'Check nearby resistance, support, and pressure zones at a glance.' },
  { ticker: 'TSLA', title: 'Market context', summary: 'Understand whether the broader environment supports the move.' },
]

function ExampleSection({ onAnalyzeTicker }) {
  return (
    <section className="space-y-6">
      <SectionTitle
        eyebrow="How people use it"
        title="A simple way to review a stock before acting."
        subtitle="Start with a ticker, scan the summary, and move into the chart only if you need more detail."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {EXAMPLES.map(example => (
          <button
            key={example.ticker}
            className="rounded-2xl border border-white/6 bg-slate-950/35 p-5 text-left transition-colors hover:border-primary/25 hover:bg-slate-950/55"
            onClick={() => onAnalyzeTicker(example.ticker)}
            type="button"
          >
            <div className="text-sm font-bold text-white">{example.title}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-primary/80">{example.ticker}</div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{example.summary}</p>
          </button>
        ))}
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
    lastLoadedTicker,
    bumpAnalysisRun,
  } = useStore()

  const isHebrew = language === 'he'
  const indicators = useIndicators(ohlcv)
  const signal = useSignal(ohlcv, indicators, language)
  const { isConnected } = useSocket()
  const { data: multiTimeframe, isLoading: isMultiTimeframeLoading } = useMultiTimeframe(currentTicker)
  const { data: marketContext, isLoading: isMarketContextLoading } = useMarketContext(currentTicker)
  const { data: technicalAnalysis, isLoading: isTechnicalAnalysisLoading, error: technicalAnalysisError } = useTechnicalAnalysis(currentTicker)

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

  const n = ohlcv.length
  const last = ohlcv[n - 1]
  const sma20Last = indicators?.sma20?.[n - 1]
  const stochLast = indicators?.stoch?.k?.[n - 1]
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
          lastLoadedTicker={lastLoadedTicker}
        />

        <ExampleSection onAnalyzeTicker={handleAnalyzeTicker} />
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
                  title={`Reviewing ${currentTicker} with a clearer market view`}
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

              <TechnicalAnalysisPanel
                analysis={technicalAnalysis}
                isLoading={isTechnicalAnalysisLoading}
                error={technicalAnalysisError}
              />

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
              <div className="flex flex-col gap-4 xl:col-span-2">
                <MarketTradeAlert marketContext={marketContext} isLoading={isMarketContextLoading} language={language} />
                <ChartWorkspace
                  currentTicker={currentTicker}
                  interval={interval}
                  snapshot={snapshot}
                  ohlcv={ohlcv}
                  indicators={indicators}
                  signal={signal}
                  technicalAnalysis={technicalAnalysis}
                  isLoading={isLoading}
                />
              </div>

              <div className="flex flex-col gap-4">
                <ForecastOpinionPanel forecast={forecast} isLoading={isMultiTimeframeLoading} language={language} />
                <MarketContextPanel marketContext={marketContext} isLoading={isMarketContextLoading} language={language} />
                <EarningsPanel earnings={earnings} isLoading={isEarningsLoading} language={language} />
                <AdvancedTrendsPanel trends={signal?.trends} language={language} />
                <SignalPanel signal={signal} language={language} />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
