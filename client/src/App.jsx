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
import AnalysisSidebar from './components/analysis/AnalysisSidebar'
import HeroSection from './components/marketing/HeroSection'
import TrustSection from './components/marketing/TrustSection'
import DisclaimerBanner from './components/legal/DisclaimerBanner'
import Button from './components/ui/Button'
import ErrorState from './components/ui/ErrorState'
import KpiCard from './components/ui/KpiCard'
import LoadingState from './components/ui/LoadingState'
import SectionTitle from './components/ui/SectionTitle'
import TradeActionCard from './components/ui/TradeActionCard'
import { fmtVolume, fmtPercent } from './lib/formatters'
import { computeForecastOpinion } from './lib/forecastOpinion'
import { buildAnalysisResult } from './lib/analysisResult'
import useTechnicalAnalysis from './hooks/useTechnicalAnalysis'
import { TRADER_TEXT } from './lib/traderColors'

const FG_COLOR = value => (
  value >= 75 ? TRADER_TEXT.bullish
    : value >= 55 ? TRADER_TEXT.support
    : value >= 45 ? TRADER_TEXT.neutral
    : value >= 25 ? TRADER_TEXT.warning
    : TRADER_TEXT.bearish
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
    intervalRefreshing,
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
  const [timeframeToast, setTimeframeToast] = useState('')
  const [showMoreKpis, setShowMoreKpis] = useState(false)
  const [activeMainTab, setActiveMainTab] = useState('chart')

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
  const rsiLast = indicators?.rsi14?.[n - 1]
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

  useEffect(() => {
    if (!intervalRefreshing) return undefined
    const label = interval.toUpperCase()
    setTimeframeToast(isHebrew ? `מחשב מחדש סיגנלים עבור ${label}...` : `Recalculating signals for ${label}...`)
    const timer = window.setTimeout(() => setTimeframeToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [interval, intervalRefreshing, isHebrew])

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
    uptrend: TRADER_TEXT.bullish,
    downtrend: TRADER_TEXT.bearish,
    sideways: TRADER_TEXT.neutral,
  }[regime] ?? 'text-slate-400'

  const copy = {
    changePct: isHebrew ? 'שינוי %' : 'Change %',
    high20: isHebrew ? 'שיא 20 נרות' : '20-bar high',
    low20: isHebrew ? 'שפל 20 נרות' : '20-bar low',
    trend: isHebrew ? 'מגמה' : 'Trend',
    vsSma20: isHebrew ? 'מול SMA20' : 'vs SMA20',
    volume: isHebrew ? 'מחזור' : 'Volume',
    fearGreed: isHebrew ? 'פחד וחמדנות' : 'Fear & Greed',
    refresh: isHebrew ? 'רענן ניתוח' : 'Refresh analysis',
    share: isHebrew ? 'דוח לשיתוף' : 'Shareable report',
    copied: isHebrew ? 'הדוח הועתק' : 'Report copied',
    tabs: {
      chart: isHebrew ? 'גרף וניתוח' : 'Chart & Analysis',
      intelligence: isHebrew ? 'בינה מלאכותית' : 'AI Intelligence',
      extended: isHebrew ? 'נתונים מורחבים' : 'Extended Data',
    }
  }

  const loadingSteps = useMemo(() => ([
    {
      label: isHebrew ? 'טוען נתוני שוק...' : 'Fetching market data...',
      detail: isHebrew ? `טוען היסטוריית מחירים ותמונת מצב עבור ${currentTicker}.` : `Loading price history and snapshot for ${currentTicker}.`,
      state: snapshot ? 'done' : 'active',
    },
    {
      label: isHebrew ? 'מנתח סנטימנט חדשות...' : 'Analyzing news sentiment...',
      detail: isHebrew ? 'מעריך את טון האירועים לפי דוחות, חדשות והקשר שוק רחב.' : 'Inferring event tone from earnings timing and broad market context.',
      state: !isMarketContextLoading && !isEarningsLoading ? 'done' : snapshot ? 'active' : 'queued',
    },
    {
      label: isHebrew ? 'משווה בין איתותים שוריים ודוביים...' : 'Comparing bullish and bearish signals...',
      detail: isHebrew ? 'מדרג אינדיקטורים, תבניות והסכמה בין כמה טווחי זמן.' : 'Scoring indicators, patterns, and multi-timeframe agreement.',
      state: signal && forecast ? 'done' : (!isLoading ? 'active' : 'queued'),
    },
    {
      label: isHebrew ? 'בונה תמונת מצב סופית...' : 'Generating final outlook...',
      detail: isHebrew ? 'מסדר את הסיכום, רמת הביטחון, הסיכון והפעולה המומלצת.' : 'Structuring the final TL;DR, confidence, risk, and action summary.',
      state: analysisResult ? 'done' : (signal ? 'active' : 'queued'),
    },
  ]), [analysisResult, currentTicker, forecast, isEarningsLoading, isHebrew, isLoading, isMarketContextLoading, signal, snapshot])

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
        <DisclaimerBanner />

        {!snapshot && (
          <>
            <HeroSection
              currentTicker={currentTicker}
              isLoading={overallLoading}
              onAnalyze={handleAnalyzeTicker}
              onPickTicker={handleAnalyzeTicker}
              lastLoadedTicker={lastLoadedTicker}
            />
            <ExampleSection onAnalyzeTicker={handleAnalyzeTicker} />
            <TrustSection />
          </>
        )}

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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-black text-primary">
                    {currentTicker[0]}
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">{currentTicker}</h1>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {isHebrew ? 'ניתוח פעיל' : 'Active Analysis'} · {interval.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={handleRetry} className="h-9 text-xs">{copy.refresh}</Button>
                  <Button variant="ghost" className="h-9 text-xs border border-white/10" onClick={handleShareReport}>
                    {copiedReport ? copy.copied : copy.share}
                  </Button>
                  <Button variant="primary" onClick={() => setCurrentTicker('')} className="h-9 text-xs">
                    {isHebrew ? 'חיפוש חדש' : 'New Search'}
                  </Button>
                </div>
              </div>

              {/* Executive Summary Row */}
              <div className="relative">
                <div className={`grid grid-cols-1 xl:grid-cols-[1fr_1.5fr] gap-4 transition-opacity duration-300 ${intervalRefreshing ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
                  <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 flex flex-col justify-center">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                      {isHebrew ? 'החלטה מיידית' : 'Immediate Action'}
                    </div>
                    <TradeActionCard decision={signal?.decision} language={language} />
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <KpiCard label={copy.changePct} value={fmtPercent(snapshot.changePct)} color={snapshot.changePct >= 0 ? TRADER_TEXT.bullish : TRADER_TEXT.bearish} />
                      <KpiCard label={copy.trend} value={regimeLabel} color={regimeColor} />
                      <KpiCard label="RSI (14)" value={rsiLast?.toFixed(1) ?? '-'} color={rsiLast < 30 ? TRADER_TEXT.bullish : rsiLast > 70 ? TRADER_TEXT.bearish : TRADER_TEXT.neutral} />
                      <KpiCard label={copy.volume} value={fmtVolume(snapshot.volume)} />
                      
                      {showMoreKpis && (
                        <>
                          <KpiCard label={copy.high20} value={high20 ? `$${high20}` : '-'} />
                          <KpiCard label={copy.low20} value={low20 ? `$${low20}` : '-'} />
                          <KpiCard label="Stoch %K" value={stochLast?.toFixed(1) ?? '-'} color={stochLast < 20 ? TRADER_TEXT.bullish : stochLast > 80 ? TRADER_TEXT.bearish : TRADER_TEXT.neutral} />
                          {fearGreed?.value != null ? (
                            <KpiCard label={copy.fearGreed} value={`${fearGreed.value} - ${isHebrew ? FG_LABEL_HE(fearGreed.classification) : fearGreed.classification}`} color={FG_COLOR(fearGreed.value)} />
                          ) : (
                            <KpiCard
                              label={copy.vsSma20}
                              value={smaDistPct != null ? `${parseFloat(smaDistPct) >= 0 ? '+' : ''}${smaDistPct}%` : '-'}
                              color={smaDistPct != null ? (parseFloat(smaDistPct) >= 0 ? TRADER_TEXT.bullish : TRADER_TEXT.bearish) : ''}
                            />
                          )}
                        </>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => setShowMoreKpis(!showMoreKpis)}
                      className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest border border-dashed border-white/5 rounded-xl bg-white/2"
                    >
                      {showMoreKpis ? (isHebrew ? 'הצג פחות' : 'Show Less') : (isHebrew ? 'הצג עוד נתונים' : 'Show More Metrics')}
                    </button>
                  </div>
                </div>

                {intervalRefreshing && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/40 backdrop-blur-[2px] z-10">
                    <div className="rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-sm text-slate-300 shadow-2xl">
                      {isHebrew ? 'מחשב מחדש...' : 'Recalculating...'}
                    </div>
                  </div>
                )}
              </div>

              {/* Main Tabbed Content Area */}
              <div className="space-y-6">
                <div className="flex gap-1 p-1 w-fit rounded-2xl bg-slate-900/50 border border-white/5 mx-auto lg:mx-0">
                  {[
                    { id: 'chart', label: copy.tabs.chart },
                    { id: 'intelligence', label: copy.tabs.intelligence },
                    { id: 'extended', label: copy.tabs.extended },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveMainTab(tab.id)}
                      className={`px-8 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        activeMainTab === tab.id
                          ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="animate-in fade-in duration-500">
                  {activeMainTab === 'chart' && (
                    <div className="space-y-4">
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
                  )}

                  {activeMainTab === 'intelligence' && (
                    <div className="space-y-6">
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
                    </div>
                  )}

                  {activeMainTab === 'extended' && (
                    <div className="max-w-4xl mx-auto">
                      <AnalysisSidebar 
                        forecast={forecast}
                        marketContext={marketContext}
                        earnings={earnings}
                        trends={signal?.trends}
                        signal={signal}
                        isLoadingForecast={isMultiTimeframeLoading}
                        isLoadingMarket={isMarketContextLoading}
                        isLoadingEarnings={isEarningsLoading}
                        language={language}
                      />
                    </div>
                  )}
                </div>
              </div>

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

            <div className="sticky bottom-4 z-40 mt-2 lg:hidden">
              <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-white/10 bg-slate-950/92 p-1 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-md">
                {[
                  { id: 'chart', label: isHebrew ? 'גרף' : 'Chart' },
                  { id: 'intelligence', label: isHebrew ? 'בינה' : 'AI' },
                  { id: 'extended', label: isHebrew ? 'עוד' : 'More' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveMainTab(tab.id)}
                    className={`flex-1 rounded-full py-2 text-xs font-bold transition-all ${
                      activeMainTab === tab.id ? 'bg-primary text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {timeframeToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/20 bg-slate-950/92 px-4 py-2 text-sm text-slate-100 shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur-md">
          {timeframeToast}
        </div>
      )}
    </Layout>
  )
}
