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
import KpiCard from './components/ui/KpiCard'
import Spinner from './components/ui/Spinner'
import { fmtVolume, fmtPercent } from './lib/formatters'
import { computeForecastOpinion } from './lib/forecastOpinion'

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

function SafeChart({ isLoading, resetKey, children }) {
  if (isLoading) return <Spinner />
  return <ChartErrorBoundary resetKey={resetKey}>{children}</ChartErrorBoundary>
}

export default function App() {
  const { currentTicker, interval, ohlcv, snapshot, isLoading, error } = useStore()
  const indicators = useIndicators(ohlcv)
  const signal = useSignal(ohlcv, indicators)
  const { isConnected } = useSocket()
  const { data: multiTimeframe, isLoading: isMultiTimeframeLoading } = useMultiTimeframe(currentTicker)
  const { data: marketContext, isLoading: isMarketContextLoading } = useMarketContext(currentTicker)

  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showBB, setShowBB] = useState(false)
  const [showFibonacci, setShowFibonacci] = useState(false)
  const [showGaps, setShowGaps] = useState(true)
  const [showPatterns, setShowPatterns] = useState(true)
  const [cleanChart, setCleanChart] = useState(false)
  const [chartType, setChartType] = useState('candlestick')
  const [visibleBars, setVisibleBars] = useState(null)
  const [fearGreed, setFearGreed] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [isEarningsLoading, setIsEarningsLoading] = useState(false)

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

    axios.get(`/api/market/earnings/${currentTicker}`)
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
  }), [ohlcv, indicators, signal, interval, earnings, multiTimeframe, marketContext])

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
  const changeVisibleBars = multiplier => {
    if (!canZoom) return
    setVisibleBars(current => {
      const base = Math.min(n, current ?? activeVisibleBars)
      const next = Math.round(base * multiplier)
      if (next >= n) return n
      return Math.max(20, next)
    })
  }
  const zoomIn = () => {
    changeVisibleBars(0.65)
  }
  const zoomOut = () => {
    changeVisibleBars(1.55)
  }
  const handlePriceChartWheel = event => {
    if (!canZoom) return
    event.preventDefault()
    changeVisibleBars(event.deltaY < 0 ? 0.86 : 1.16)
  }
  const chartShowSMA = !cleanChart && showSMA
  const chartShowEMA = !cleanChart && showEMA
  const chartShowBB = !cleanChart && showBB
  const chartShowFibonacci = !cleanChart && showFibonacci
  const chartShowGaps = !cleanChart && showGaps
  const chartShowPatterns = !cleanChart && showPatterns
  const chartShowLevels = !cleanChart

  const smaDistPct = last && sma20Last ? (((last.c - sma20Last) / sma20Last) * 100).toFixed(1) : null
  const high20 = n ? Math.max(...ohlcv.slice(-20).map(bar => bar.h)).toFixed(2) : null
  const low20 = n ? Math.min(...ohlcv.slice(-20).map(bar => bar.l)).toFixed(2) : null

  const regime = signal?.gates?.trend?.regime
  const regimeLabel = {
    uptrend: 'מגמה עולה',
    downtrend: 'מגמה יורדת',
    sideways: 'שוק צדדי',
    unknown: 'לא ידוע',
  }[regime] ?? 'לא ידוע'
  const regimeColor = {
    uptrend: 'text-green-400',
    downtrend: 'text-red-400',
    sideways: 'text-yellow-400',
  }[regime] ?? 'text-slate-400'

  return (
    <Layout isConnected={isConnected}>
      {error && (
        <div className="mb-3 rounded-lg bg-red-900 p-3 text-right text-sm text-red-300">{error}</div>
      )}

      {snapshot && (
        <div className="mb-3 grid grid-cols-4 gap-2 md:grid-cols-8">
          <KpiCard label="שינוי %" value={fmtPercent(snapshot.changePct)} color={snapshot.changePct >= 0 ? 'text-green-400' : 'text-red-400'} />
          <KpiCard label="שיא 20 נרות" value={high20 ? `$${high20}` : '-'} />
          <KpiCard label="שפל 20 נרות" value={low20 ? `$${low20}` : '-'} />
          <KpiCard label="Volume" value={fmtVolume(snapshot.volume)} />
          <KpiCard label="RSI (14)" value={rsiLast?.toFixed(1) ?? '-'} color={rsiLast < 30 ? 'text-green-400' : rsiLast > 70 ? 'text-red-400' : 'text-white'} />
          <KpiCard label="Stoch %K" value={stochLast?.toFixed(1) ?? '-'} color={stochLast < 20 ? 'text-green-400' : stochLast > 80 ? 'text-red-400' : 'text-white'} />
          <KpiCard label="מגמה" value={regimeLabel} color={regimeColor} />
          {fearGreed?.value != null ? (
            <KpiCard label="Fear & Greed" value={`${fearGreed.value} - ${FG_LABEL_HE(fearGreed.classification)}`} color={FG_COLOR(fearGreed.value)} />
          ) : (
            <KpiCard
              label="vs SMA20"
              value={smaDistPct != null ? `${parseFloat(smaDistPct) >= 0 ? '+' : ''}${smaDistPct}%` : '-'}
              color={smaDistPct != null ? (parseFloat(smaDistPct) >= 0 ? 'text-green-400' : 'text-red-400') : ''}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className={`flex flex-col gap-3 ${cleanChart ? 'xl:col-span-3' : 'xl:col-span-2'}`}>
          {!cleanChart && (
            <MarketTradeAlert marketContext={marketContext} isLoading={isMarketContextLoading} />
          )}

          <div className="flex flex-wrap gap-2">
            {[['candlestick', 'נרות'], ['line', 'קו']].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setChartType(value)}
                className={`rounded px-3 py-1 text-xs font-medium ${chartType === value ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >
                {label}
              </button>
            ))}
            <div className="mx-1 w-px bg-slate-700" />
            {[
              ['showSMA', showSMA, setShowSMA, 'SMA 20'],
              ['showEMA', showEMA, setShowEMA, 'EMA 50'],
              ['showBB', showBB, setShowBB, 'BB'],
            ].map(([key, value, setter, label]) => (
              <button
                key={key}
                onClick={() => setter(!value)}
                className={`rounded px-3 py-1 text-xs font-medium ${!cleanChart && value ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
              >
                {label}
              </button>
            ))}
            <div className="mx-1 w-px bg-slate-700" />
            {[
              ['showFibonacci', showFibonacci, setShowFibonacci, 'פיבונאצ׳י'],
              ['showGaps', showGaps, setShowGaps, 'גאפים'],
              ['showPatterns', showPatterns, setShowPatterns, 'תבניות'],
            ].map(([key, value, setter, label]) => (
              <button
                key={key}
                onClick={() => setter(!value)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  !cleanChart && value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setCleanChart(value => !value)}
              className={`rounded px-3 py-1 text-xs font-bold ${
                cleanChart
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              גרף נקי
            </button>
            <div className="mx-1 w-px bg-slate-700" />
            <button
              onClick={zoomIn}
              disabled={!canZoom}
              className="rounded bg-slate-700 px-3 py-1 text-xs font-bold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              זום +
            </button>
            <button
              onClick={zoomOut}
              disabled={!canZoom}
              className="rounded bg-slate-700 px-3 py-1 text-xs font-bold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              זום -
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
                className={`rounded px-3 py-1 text-xs font-medium ${
                  activeVisibleBars === Math.min(n, bars)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {label} נרות
              </button>
            ))}
            <button
              onClick={() => setVisibleBars(n)}
              disabled={!canZoom}
              className={`rounded px-3 py-1 text-xs font-medium ${
                activeVisibleBars === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              הכל
            </button>
            <span className="self-center text-xs text-slate-500">
              מוצגים {Math.min(activeVisibleBars, n)}/{n} נרות
            </span>
          </div>

          <ChartContainer title="גרף מחיר" height="h-[440px] md:h-[560px]" onWheel={handlePriceChartWheel}>
            <SafeChart isLoading={isLoading} resetKey={`price-${chartResetKey}-${chartShowSMA}-${chartShowEMA}-${chartShowBB}-${chartShowFibonacci}-${chartShowGaps}-${chartShowPatterns}-${chartShowLevels}-${patternResetKey}-${activeVisibleBars}`}>
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
                showLevels={chartShowLevels}
                ticker={currentTicker}
                decision={signal?.decision}
                interval={interval}
                visibleBars={activeVisibleBars}
              />
            </SafeChart>
          </ChartContainer>

          {!cleanChart && chartType !== 'candlestick' && (
            <ChartContainer title="Volume" height="h-20">
              <SafeChart isLoading={isLoading} resetKey={`volume-${chartResetKey}`}>
                <VolumeChart ohlcv={ohlcv} interval={interval} visibleBars={activeVisibleBars} />
              </SafeChart>
            </ChartContainer>
          )}

          {!cleanChart && (
            <>
              <ChartContainer title={`RSI (14)${rsiLast != null ? ` - ${rsiLast.toFixed(1)}` : ''}`} height="h-24">
                <SafeChart isLoading={isLoading} resetKey={`rsi-${chartResetKey}`}>
                  <RsiChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                </SafeChart>
              </ChartContainer>

              <ChartContainer title={`Stochastic %K${stochLast != null ? ` - ${stochLast.toFixed(1)}` : ''}`} height="h-24">
                <SafeChart isLoading={isLoading} resetKey={`stoch-${chartResetKey}`}>
                  <StochChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                </SafeChart>
              </ChartContainer>

              <ChartContainer title={`Williams %R${willRLast != null ? ` - ${willRLast.toFixed(1)}` : ''}`} height="h-24">
                <SafeChart isLoading={isLoading} resetKey={`willr-${chartResetKey}`}>
                  <WilliamsRChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                </SafeChart>
              </ChartContainer>

              <ChartContainer title="MACD (12, 26, 9)" height="h-24">
                <SafeChart isLoading={isLoading} resetKey={`macd-${chartResetKey}`}>
                  <MacdChart ohlcv={ohlcv} indicators={indicators} interval={interval} visibleBars={activeVisibleBars} />
                </SafeChart>
              </ChartContainer>
            </>
          )}
        </div>

        {!cleanChart && (
          <div className="flex flex-col gap-3">
            <ForecastOpinionPanel forecast={forecast} isLoading={isMultiTimeframeLoading} />
            <MarketContextPanel marketContext={marketContext} isLoading={isMarketContextLoading} />
            <EarningsPanel earnings={earnings} isLoading={isEarningsLoading} />
            <SignalPanel signal={signal} />
          </div>
        )}
      </div>
    </Layout>
  )
}
