import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
const PaperTradingPanel = lazy(() => import('./components/analysis/PaperTradingPanel'))
import TechnicalAnalysisPanel from './components/analysis/TechnicalAnalysisPanel'
import AnalysisSidebar from './components/analysis/AnalysisSidebar'
import FinnhubPanel from './components/analysis/FinnhubPanel'
import TradingStopsPanel from './components/analysis/TradingStopsPanel'
import TradeChecklistPanel from './components/analysis/TradeChecklistPanel'
import PositionSizeCalculator from './components/analysis/PositionSizeCalculator'
import PlainVerdictCard from './components/analysis/PlainVerdictCard'
// These render only inside their own tab, so their cost belongs to the click
// that opens it rather than to every first paint.
const StockAnalysisProPanel = lazy(() => import('./components/analysis/StockAnalysisProPanel'))
const ValidationPanel = lazy(() => import('./components/analysis/ValidationPanel'))
import MaStructurePanel from './components/analysis/MaStructurePanel'
import HeroSection from './components/marketing/HeroSection'
import TrustSection from './components/marketing/TrustSection'
import DisclaimerBanner from './components/legal/DisclaimerBanner'
import Button from './components/ui/Button'
import ErrorState from './components/ui/ErrorState'
import KpiCard from './components/ui/KpiCard'
import LoadingState from './components/ui/LoadingState'
import SectionTitle from './components/ui/SectionTitle'
import TradeActionCard from './components/ui/TradeActionCard'
import StockLogo from './components/ui/StockLogo'
import { fmtVolume, fmtPercent, fmtPrice } from './lib/formatters'
import { computeForecastOpinion } from './lib/forecastOpinion'
import { buildAnalysisResult } from './lib/analysisResult'
import { buildTradeChecklist } from './lib/tradeChecklist'
import usePaperTrading from './hooks/usePaperTrading'
import useTradingBot from './hooks/useTradingBot'
import useTechnicalAnalysis from './hooks/useTechnicalAnalysis'
import useStockAnalysisPro from './hooks/useStockAnalysisPro'
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

function WorkspaceNav({ activeTab, onChange, language }) {
  const isHebrew = language === 'he'
  const tabs = [
    ['intelligence', '01', isHebrew ? 'החלטה' : 'Decision', isHebrew ? 'מה עושים עכשיו' : 'What to do now'],
    ['chart', '02', isHebrew ? 'גרף' : 'Chart', isHebrew ? 'מחיר, נרות ורמות' : 'Price, candles, levels'],
    ['validation', '03', isHebrew ? 'אימות' : 'Validate', isHebrew ? 'בדיקת האות' : 'Check the signal'],
    ['pro', '04', isHebrew ? 'דוח מקצועי' : 'Pro report', isHebrew ? 'תמונה מלאה' : 'Full research view'],
    ['paper', '05', isHebrew ? 'דמו' : 'Paper', isHebrew ? 'תרגול בלבד' : 'Practice only'],
  ]

  return (
    <nav className="workspace-nav workspace-nav--mobile" aria-label={isHebrew ? 'ניווט סביבת העבודה' : 'Workspace navigation'}>
      <div className="workspace-nav__intro">
        <div className="workspace-nav__eyebrow">{isHebrew ? 'מסלול ניתוח' : 'Analysis flow'}</div>
        <div className="workspace-nav__hint">{isHebrew ? 'מתחילים בהחלטה ורק אז יורדים לפרטים.' : 'Start with the decision, then go deeper.'}</div>
      </div>
      <div className="workspace-nav__items">
        {tabs.map(([id, step, label, description]) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeTab === id}
            onClick={() => onChange(id)}
            className={`workspace-nav__item ${activeTab === id ? 'workspace-nav__item--active' : ''}`}
          >
            <span className="workspace-nav__step">{step}</span>
            <span className="workspace-nav__copy">
              <span className="workspace-nav__label">{label}</span>
              <span className="workspace-nav__description">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}

function PanelFallback() {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-400">
      טוען…
    </div>
  )
}

export default function AdvancedApp() {
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
  const indicators = useIndicators(ohlcv, interval)
  // Multi-timeframe scoring is fetched BEFORE the signal so the signal engine
  // can factor higher-timeframe bias into its final decision (block bullish
  // reads against a weekly downtrend, etc).
  const { data: multiTimeframe, isLoading: isMultiTimeframeLoading } = useMultiTimeframe(currentTicker)
  const signal = useSignal(ohlcv, indicators, language, multiTimeframe, interval)
  const { isConnected } = useSocket()
  const { data: marketContext, isLoading: isMarketContextLoading } = useMarketContext(currentTicker)
  const { data: technicalAnalysis, isLoading: isTechnicalAnalysisLoading, error: technicalAnalysisError } = useTechnicalAnalysis(currentTicker)
  const paperTrading = usePaperTrading(`${currentTicker}-${snapshot?.price ?? 'na'}`)
  const tradingBot = useTradingBot(currentTicker)

  const [fearGreed, setFearGreed] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [isEarningsLoading, setIsEarningsLoading] = useState(false)
  const [isBackendSlow, setIsBackendSlow] = useState(false)
  const [copiedReport, setCopiedReport] = useState(false)
  const [timeframeToast, setTimeframeToast] = useState('')
  const [showMoreKpis, setShowMoreKpis] = useState(false)
  const [activeMainTab, setActiveMainTab] = useState('intelligence')
  const autoBotRunRef = useRef(false)

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

  // An open paper position for this ticker feeds the report's existing-position
  // section; without one that section is simply omitted.
  const proPosition = useMemo(() => {
    const open = paperTrading.account?.openPositions?.find(item => item.ticker === currentTicker)
    if (!open) return null
    return {
      avgPrice: open.entryPrice,
      quantity: open.quantity,
      portfolioSize: paperTrading.account?.equity ?? paperTrading.account?.initialBalance ?? null,
    }
  }, [currentTicker, paperTrading.account])

  const { report: proReport, isFetchingContext: isProContextLoading } = useStockAnalysisPro({
    ticker: currentTicker,
    interval,
    ohlcv,
    indicators,
    signal,
    snapshot,
    earnings,
    marketContext,
    multiTimeframe,
    fearGreed,
    position: proPosition,
    language,
    enabled: Boolean(snapshot),
  })

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

  const checklist = useMemo(() => buildTradeChecklist({
    ohlcv,
    indicators,
    signal,
    forecast,
    earnings,
    language,
  }), [ohlcv, indicators, signal, forecast, earnings, language])

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

  useEffect(() => {
    const bot = tradingBot.bot
    if (!bot?.botEnabled || bot.mode !== 'paper' || bot.killSwitch) return undefined
    if (!currentTicker || !snapshot?.price || !signal?.decision) return undefined

    let cancelled = false

    async function runCycle() {
      if (autoBotRunRef.current) return
      autoBotRunRef.current = true
      try {
        const result = await tradingBot.runAutoCycle({
          ticker: currentTicker,
          snapshot,
          decision: signal.decision,
          language,
        })
        if (!cancelled && result?.account) {
          paperTrading.setAccount(result.account)
        }
      } catch {
        // surface errors via the existing trading bot hook state
      } finally {
        autoBotRunRef.current = false
      }
    }

    runCycle()
    const timer = window.setInterval(runCycle, 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  // Field-level dependencies on purpose. This effect starts a 30-second
  // auto-execute cycle that places paper trades; depending on the whole
  // snapshot / signal / tradingBot objects would restart it on every render
  // and could fire repeated trade cycles. The specific values it reacts to
  // are all listed.
  }, [
    currentTicker,
    language,
    snapshot?.price,
    signal?.decision?.action,
    signal?.decision?.currentPrice,
    signal?.decision?.invalidation,
    signal?.decision?.stopLoss,
    signal?.decision?.takeProfit,
    signal?.decision?.holdUntil,
    tradingBot.bot?.botEnabled,
    tradingBot.bot?.mode,
    tradingBot.bot?.killSwitch,
  ])

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
      chart: isHebrew ? 'גרף' : 'Chart',
      intelligence: isHebrew ? 'החלטה' : 'Decision',
    }
  }

  copy.tabs.paper = isHebrew ? 'דמו' : 'Paper'
  copy.tabs.pro = isHebrew ? 'מקצועי' : 'Pro'
  copy.tabs.validation = isHebrew ? 'ולידציה' : 'Validation'

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
    <Layout isConnected={isConnected} activeTab={activeMainTab} onTabChange={setActiveMainTab}>
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
              <div className="dashboard-command">
                <div className="dashboard-command__asset">
                  <StockLogo ticker={currentTicker} size="lg" />
                  <div className="min-w-0">
                    <div className="dashboard-command__eyebrow">{isHebrew ? 'ניתוח פעיל' : 'Active analysis'}</div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h1>{currentTicker}</h1>
                      {snapshot?.name && <span>{snapshot.name}</span>}
                    </div>
                  </div>
                </div>

                <div className="dashboard-command__quote">
                  <span>{isHebrew ? 'מחיר נוכחי' : 'Current price'}</span>
                  <div dir="ltr">
                    <strong>{fmtPrice(snapshot.price)}</strong>
                    <small className={snapshot.changePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      {fmtPercent(snapshot.changePct)}
                    </small>
                  </div>
                </div>

                <div className="dashboard-command__context">
                  <div>
                    <span>{isHebrew ? 'טווח' : 'Range'}</span>
                    <strong>{interval.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span>{isHebrew ? 'סטטוס נתונים' : 'Data status'}</span>
                    <strong className={isConnected ? 'text-emerald-300' : 'text-amber-300'}>
                      <i />
                      {isConnected ? (isHebrew ? 'מחובר' : 'Connected') : (isHebrew ? 'נתונים מושהים' : 'Delayed')}
                    </strong>
                  </div>
                </div>

                <div className="dashboard-command__actions">
                  <Button variant="secondary" onClick={handleRetry} className="h-9 text-xs">{copy.refresh}</Button>
                  <Button variant="ghost" className="h-9 border border-white/10 text-xs" onClick={handleShareReport}>
                    {copiedReport ? copy.copied : copy.share}
                  </Button>
                  <Button variant="primary" onClick={() => setCurrentTicker('')} className="h-9 text-xs">
                    {isHebrew ? 'חיפוש מניה' : 'Find stock'}
                  </Button>
                </div>
              </div>

              {/* Executive Summary Row */}
              <div className="relative">
                <div className={`dashboard-overview transition-opacity duration-300 ${intervalRefreshing ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
                  <div className="dashboard-overview__decision">
                    <div className="dashboard-section-heading">
                      <span className="dashboard-section-heading__index">01</span>
                      <span>
                        <strong>{isHebrew ? 'החלטת מסחר' : 'Trading decision'}</strong>
                        <small>{isHebrew ? 'מה המנוע ממליץ לעשות עכשיו' : 'What the engine recommends now'}</small>
                      </span>
                    </div>
                    <TradeActionCard decision={signal?.decision} language={language} />
                  </div>

                  <div className="dashboard-overview__metrics">
                    <div className="dashboard-section-heading">
                      <span className="dashboard-section-heading__index">02</span>
                      <span>
                        <strong>{isHebrew ? 'תמונת מצב' : 'Market snapshot'}</strong>
                        <small>{isHebrew ? 'המדדים שחשוב לבדוק לפני פעולה' : 'Key readings before taking action'}</small>
                      </span>
                    </div>
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
                      type="button"
                      onClick={() => setShowMoreKpis(!showMoreKpis)}
                      className="dashboard-metrics-toggle"
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
                <WorkspaceNav activeTab={activeMainTab} onChange={setActiveMainTab} language={language} />

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
                        paperTradingAccount={paperTrading.account}
                        isLoading={isLoading}
                      />
                      <ForecastOpinionPanel forecast={forecast} isLoading={overallLoading} language={language} />
                    </div>
                  )}

                  {activeMainTab === 'intelligence' && (
                    <div className="space-y-6">
                      <PlainVerdictCard decision={signal?.decision} checklist={checklist} language={language} />

                      <MaStructurePanel
                        indicators={indicators}
                        price={ohlcv?.[ohlcv.length - 1]?.c}
                        language={language}
                      />

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

                      <TradeChecklistPanel
                        ohlcv={ohlcv}
                        indicators={indicators}
                        signal={signal}
                        forecast={forecast}
                        earnings={earnings}
                        language={language}
                      />

                      <TradingStopsPanel
                        ticker={currentTicker}
                        currentPrice={snapshot?.price}
                        atr={indicators?.atr14?.[indicators.atr14.length - 1]}
                        supportPrice={null}
                        language={language}
                      />

                      <PositionSizeCalculator
                        currentPrice={snapshot?.price}
                        suggestedStop={forecast?.invalidBelow}
                        language={language}
                      />

                      <TechnicalAnalysisPanel
                        analysis={technicalAnalysis}
                        isLoading={isTechnicalAnalysisLoading}
                        error={technicalAnalysisError}
                      />

                      {/* Moved here from the old "details" tab: the same
                          question, read the analysis, was split across two
                          tabs with no rule for which held what. */}
                      <FinnhubPanel ticker={currentTicker} language={language} />
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

                  {activeMainTab === 'pro' && (
                    <Suspense fallback={<PanelFallback />}>
                      <div className="max-w-4xl mx-auto">
                        <StockAnalysisProPanel
                          report={proReport}
                          isLoading={overallLoading || isProContextLoading}
                          language={language}
                        />
                      </div>
                    </Suspense>
                  )}

                  {activeMainTab === 'validation' && (
                    <Suspense fallback={<PanelFallback />}>
                      <div className="max-w-4xl mx-auto">
                        <ValidationPanel
                          ohlcv={ohlcv}
                          ticker={currentTicker}
                          language={language}
                        />
                      </div>
                    </Suspense>
                  )}

                  {activeMainTab === 'paper' && (
                    <Suspense fallback={<PanelFallback />}>
                      <div className="space-y-6">
                        <PaperTradingPanel
                          currentTicker={currentTicker}
                          snapshot={snapshot}
                          decision={signal?.decision}
                          language={language}
                          account={paperTrading.account}
                          isLoading={paperTrading.isLoading}
                          isSaving={paperTrading.isSaving}
                          error={paperTrading.error}
                          tradingBot={tradingBot.bot}
                          tradingBotLoading={tradingBot.isLoading}
                          tradingBotSaving={tradingBot.isSaving}
                          tradingBotError={tradingBot.error}
                          onCreateOrder={paperTrading.createOrder}
                          onCancelOrder={paperTrading.cancelOrder}
                          onClosePosition={paperTrading.closePosition}
                          onResetAccount={paperTrading.resetAccount}
                          onUpdateSettings={paperTrading.updateSettings}
                          onUpdateBotSettings={tradingBot.updateSettings}
                          onRecordBotEvent={tradingBot.recordEvent}
                        />
                      </div>
                    </Suspense>
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

            <div className="mobile-bottom-nav lg:hidden">
              <div className="mobile-bottom-nav__inner">
                {[ 
                  { id: 'intelligence', label: isHebrew ? 'החלטה' : 'Decision' },
                  { id: 'chart', label: isHebrew ? 'גרף' : 'Chart' },
                  { id: 'validation', label: isHebrew ? 'אימות' : 'Validate' },
                  { id: 'pro', label: isHebrew ? 'דוח' : 'Report' },
                  { id: 'paper', label: isHebrew ? 'דמו' : 'Paper' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={activeMainTab === tab.id}
                    onClick={() => setActiveMainTab(tab.id)}
                    className={`mobile-bottom-nav__item ${activeMainTab === tab.id ? 'mobile-bottom-nav__item--active' : ''}`}
                  >
                    <span className="mobile-bottom-nav__dot" />
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
