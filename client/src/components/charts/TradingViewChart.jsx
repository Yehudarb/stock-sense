import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries,
  createSeriesMarkers, CrosshairMode, LineStyle,
} from 'lightweight-charts'
import useStore from '../../store/useStore'
import {
  buildGapMarkers,
  buildPatternMarkers,
  computeFibonacci,
  isTrendlinePattern,
  measuredMoveTargets,
  OVERLAY_COLORS,
  patternBreakoutLevel,
} from './chartHelpers'
import { TRADER_COLORS } from '../../lib/traderColors'

// TradingView-quality chart (lightweight-charts, MIT). Rendering + navigation
// (mouse-wheel zoom, click-drag pan, native crosshair, right-side price axis,
// synced volume) come free from the library. The interesting work is wiring
// every indicator toggle the app's ChartControls exposes to the right kind of
// series, so the button in the header actually changes what's drawn.

// Axis label size. The library's own default is 11px, small enough that the
// price column on the right was hard to read at a glance.
const AXIS_FONT_SIZE = 13

// Distinct colors per overlay so a busy chart is still readable.
// Palette lives in chartHelpers so the legend that names these lines and the
// code that draws them can never disagree again.
const C = OVERLAY_COLORS

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// ── Data adapters ────────────────────────────────────────────────────────
// Convert our {t,o,h,l,c,v} bars to the shapes lightweight-charts expects.
function toCandles(ohlcv) {
  if (!Array.isArray(ohlcv)) return []
  const out = []
  for (const b of ohlcv) {
    const time = Math.floor((b.t || 0) / 1000)
    if (!Number.isFinite(time) || time <= 0) continue
    if (!Number.isFinite(b.c) || !Number.isFinite(b.o)) continue
    out.push({ time, open: b.o, high: b.h, low: b.l, close: b.c })
  }
  return out
}
function toVolume(ohlcv) {
  if (!Array.isArray(ohlcv)) return []
  const out = []
  for (const b of ohlcv) {
    const time = Math.floor((b.t || 0) / 1000)
    if (!Number.isFinite(time) || time <= 0) continue
    out.push({
      time,
      value: b.v || 0,
      color: b.c >= b.o ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
    })
  }
  return out
}
function toLine(ohlcv, values) {
  if (!Array.isArray(ohlcv) || !Array.isArray(values)) return []
  const out = []
  const n = Math.min(ohlcv.length, values.length)
  for (let i = 0; i < n; i += 1) {
    const v = values[i]
    if (v == null || !Number.isFinite(v)) continue
    const time = Math.floor((ohlcv[i].t || 0) / 1000)
    if (!Number.isFinite(time) || time <= 0) continue
    out.push({ time, value: v })
  }
  return out
}
function toClose(ohlcv) {
  if (!Array.isArray(ohlcv)) return []
  return ohlcv
    .filter(b => Number.isFinite(b.c) && Number.isFinite(b.t))
    .map(b => ({ time: Math.floor(b.t / 1000), value: b.c }))
}

// Patterns and gaps are expressed in BAR INDEXES; lightweight-charts addresses
// everything by unix seconds. This is the only bridge between the two worlds —
// an out-of-range index yields null so the caller can drop that shape rather
// than draw it at a wrong place on the time axis.
function timeAtIndex(ohlcv, index) {
  const bar = ohlcv?.[index]
  if (!bar) return null
  const time = Math.floor((bar.t || 0) / 1000)
  return Number.isFinite(time) && time > 0 ? time : null
}

// A pattern's `visual` carries either explicit lines (trendlines, necklines,
// triangle boundaries) or an ordered point list. Both reduce to two-point
// segments we can hand to a LineSeries.
function patternSegments(ohlcv, pattern) {
  const visual = pattern?.visual
  if (!visual) return []
  const segments = []

  for (const line of visual.lines ?? []) {
    const from = timeAtIndex(ohlcv, line?.from?.index)
    const to = timeAtIndex(ohlcv, line?.to?.index)
    if (from == null || to == null || from === to) continue
    if (!Number.isFinite(line.from.price) || !Number.isFinite(line.to.price)) continue
    segments.push([
      { time: from, value: line.from.price },
      { time: to, value: line.to.price },
    ])
  }

  // Fall back to connecting the points only when no explicit lines were given,
  // otherwise a pattern would be drawn twice.
  if (!segments.length && (visual.points?.length ?? 0) >= 2) {
    const pts = visual.points
      .map(p => ({ time: timeAtIndex(ohlcv, p.index), value: p.price }))
      .filter(p => p.time != null && Number.isFinite(p.value))
      .sort((a, b) => a.time - b.time)
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i].time !== pts[i - 1].time) segments.push([pts[i - 1], pts[i]])
    }
  }

  return segments
}

// Which patterns get their entry/target/stop drawn.
//
// A ticker routinely carries five or six detected patterns pointing in opposite
// directions — SPY currently has six — and three price lines each would bury
// the chart in eighteen labels that contradict one another. Two kinds earn the
// space: the strongest pattern by |weight| (the one the engine itself treats as
// the read), and any pattern actually at its trigger, since that is the only
// one you can act on right now.
const ACTIONABLE_STAGES = new Set(['near_breakout', 'broken_out'])
const MAX_TARGET_PATTERNS = 3

function patternsWorthTargeting(patterns) {
  const list = patterns?.patterns ?? []
  if (!list.length) return []

  const best = patterns?.best?.key
  const picked = list.filter(p =>
    p.key === best || ACTIONABLE_STAGES.has(p.meta?.stage),
  )
  // Strongest first so the cap keeps the most significant ones.
  return picked
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))
    .slice(0, MAX_TARGET_PATTERNS)
}

// A bullish target below spot, or a bearish one above it, is a measurement that
// price has already overtaken. Drawing it would label a level "target" while
// pointing the wrong way. Rare — one pattern in twenty-nine across six tickers —
// but wrong in exactly the way a trader would act on.
function targetIsCoherent(pattern, spot) {
  const target = pattern?.targetPrice
  if (!Number.isFinite(target) || !Number.isFinite(spot)) return false
  const dir = pattern?.direction ?? pattern?.bias
  if (dir === 'bullish') return target > spot
  if (dir === 'bearish') return target < spot
  return true
}

function patternColor(pattern) {
  const dir = pattern?.direction ?? pattern?.bias
  if (dir === 'bullish') return TRADER_COLORS.bullish
  if (dir === 'bearish') return TRADER_COLORS.bearish
  return TRADER_COLORS.neutral
}

// Projects a pattern line forward to the last bar at its own slope.
//
// A trendline that stops at its final pivot is a historical artifact: it says
// where the line WAS. Traders read a trendline as a level that is still in
// force, so it has to reach the current bar to be worth anything — that is the
// difference between a drawn segment and a usable level.
//
// Slope is per BAR, not per second: bars are not evenly spaced in wall-clock
// time (weekends, holidays, session gaps), so extrapolating on timestamps would
// bend the line. Indexes are then mapped back to times for the chart.
// A line may be extended by at most its own span, and never more than this.
// Extrapolation amplifies slope error with distance: measured on real bars, an
// MSFT line fitted over ~20 bars and dragged 161 bars forward landed 42% away
// from spot. Anchoring the reach to the line's own length keeps a long, well
// established trendline useful while stopping a short one from inventing a
// level, and a line too stale to reach the current bar simply stops early —
// which is the honest reading: it is no longer in force.
const MAX_PROJECTION_BARS = 60

function projectLineToLastBar(ohlcv, line) {
  const lastIndex = ohlcv.length - 1
  const fromIndex = line?.from?.index
  const toIndex = line?.to?.index
  if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return null
  if (toIndex >= lastIndex || toIndex === fromIndex) return null

  const fromPrice = line.from.price
  const toPrice = line.to.price
  if (!Number.isFinite(fromPrice) || !Number.isFinite(toPrice)) return null

  const span = Math.abs(toIndex - fromIndex)
  const reach = Math.min(span, MAX_PROJECTION_BARS, lastIndex - toIndex)
  if (reach < 1) return null

  const endIndex = toIndex + reach
  const slopePerBar = (toPrice - fromPrice) / (toIndex - fromIndex)
  const projectedPrice = toPrice + slopePerBar * reach
  if (!Number.isFinite(projectedPrice) || projectedPrice <= 0) return null

  const startTime = timeAtIndex(ohlcv, toIndex)
  const endTime = timeAtIndex(ohlcv, endIndex)
  if (startTime == null || endTime == null || startTime === endTime) return null

  return [
    { time: startTime, value: toPrice },
    { time: endTime, value: projectedPrice },
  ]
}

// Supertrend has direction switches; a single line series looks best when we
// split it into "up" (green) and "down" (red) segments and let the color
// change tell the story. We build two aligned arrays with gaps at the
// direction changes so each series only draws its half of the signal.
export function toSupertrendSeries(ohlcv, supertrend) {
  // computeAll() emits { upper, lower, line, direction, flipped } — the plotted
  // series is `line`, and `direction` holds the strings 'bullish' / 'bearish'.
  // PriceChart reads supertrend.line; this chart read a `value` key that has
  // never existed, so the series was always empty.
  if (!Array.isArray(supertrend?.line)) return { up: [], down: [] }
  const up = []
  const down = []
  const n = Math.min(ohlcv.length, supertrend.line.length)
  for (let i = 0; i < n; i += 1) {
    const v = supertrend.line[i]
    if (v == null || !Number.isFinite(v)) continue
    const time = Math.floor((ohlcv[i].t || 0) / 1000)
    if (!Number.isFinite(time) || time <= 0) continue
    const dir = supertrend.direction?.[i]
    up.push(dir === 'bullish' ? { time, value: v } : { time })
    down.push(dir === 'bearish' ? { time, value: v } : { time })
  }
  return { up, down }
}

export default function TradingViewChart({
  ohlcv,
  indicators,
  height = 460,
  // Overlay toggles routed from ChartControls in the header. Any missing
  // prop is treated as false — the chart just doesn't draw that series.
  showSMA = false,
  showEMA = false,
  showWMA = false,
  showBB = false,
  showVWAP = false,
  showVolume = false,
  showVolumeMA = false,
  showSupertrend = false,
  showIchimoku = false,
  showKeltner = false,
  showDonchian = false,
  showPivotPoints = false,
  showPrevHighLow = false,
  showHighLow52 = false,
  // Analysis overlays. These used to be PriceChart-only: ChartControls exposed
  // the buttons in Pro mode too, but the props were never forwarded here, so
  // the toggles lit up and drew nothing.
  showLevels = false,
  showFibonacci = false,
  showFibExtension = false,
  showPatterns = false,
  showTriangles = false,
  showGaps = false,
  // Entry / target / stop for the patterns the engine considers actionable.
  showTargets = true,
  // Projects each trendline forward at its own slope to the current bar, so
  // it reads as a live level instead of a historical segment.
  extendTrendlines = true,
  patterns = null,          // signal.patterns  — { patterns: [{ visual, ... }] }
  gaps = null,              // signal.pro.gaps  — { gaps: [{ zoneLow, zoneHigh, ... }] }
  decision = null,          // entry / stop / target / support / resistance
  technicalMethod = null,   // Long-Term Technical Confluence Method zones
  showTechnicalMethod = false,
  technicalAnalysis = null, // keyLevels.support | .resistance | .breakoutLevels
  // How many of the loaded bars to show. The rest is warmup history that
  // feeds the indicators without being displayed.
  visibleBars = null,
  viewOffset = 0,
  // Needed for framing: several presets share a visibleBars value (1H and 4H
  // are both 180, as are 1m/5m/15m at 160), so visibleBars alone cannot tell
  // that the timeframe changed underneath the chart.
  interval = null,
  chartType = 'candlestick',
  measurementEnabled = false,
  resetToken = 0,
}) {
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const seriesRef     = useRef({})       // { candle, volume, sma20, ... }
  const priceLinesRef = useRef([])       // horizontal lines (pivots, hi/lo)
  const markersRef    = useRef(null)
  const theme         = useStore(s => s.theme) || 'dark'
  const currentTicker = useStore(s => s.currentTicker)
  const language      = useStore(s => s.language) || 'he'
  const [hovered, setHovered] = useState(null)
  const [measurement, setMeasurement] = useState(null)
  const [logicalWindow, setLogicalWindow] = useState(null)
  // Bumped every time the chart instance is rebuilt (theme / chart-type change).
  // The overlay effects below depend on it, otherwise they keep their old deps,
  // never re-run, and every indicator silently disappears with the old chart.
  const [chartEpoch, setChartEpoch] = useState(0)

  const palette = useMemo(() => (theme === 'light' ? {
    bg: '#ffffff', text: '#111827', grid: '#e5e7eb', axis: '#94a3b8',
    up: '#10b981', down: '#ef4444', wickUp: '#10b981', wickDown: '#ef4444',
  } : {
    bg: '#0b0f19', text: '#e5e7eb', grid: '#1f2937', axis: '#4b5563',
    up: '#10b981', down: '#ef4444', wickUp: '#34d399', wickDown: '#f87171',
  }), [theme])

  const candles = useMemo(() => toCandles(ohlcv), [ohlcv])
  const volume  = useMemo(() => toVolume(ohlcv),  [ohlcv])
  const lineData = useMemo(() => toClose(ohlcv),  [ohlcv])

  // ── Chart lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: palette.bg },
        textColor: palette.text,
        fontFamily: 'inherit',
        // lightweight-charts defaults to 11px, which is what made the price
        // and time labels hard to read on a dense chart.
        fontSize: AXIS_FONT_SIZE,
      },
      grid: {
        vertLines: { color: palette.grid, style: LineStyle.Dotted },
        horzLines: { color: palette.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: palette.axis,
        scaleMargins: { top: 0.08, bottom: 0.25 },
        // Reserve room so the larger labels are not clipped or crowded.
        minimumWidth: 78,
        entireTextOnly: true,
      },
      timeScale: { borderColor: palette.axis, timeVisible: true, secondsVisible: false, rightOffset: 8 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: palette.axis, width: 1, style: LineStyle.Dashed, labelBackgroundColor: palette.axis },
        horzLine: { color: palette.axis, width: 1, style: LineStyle.Dashed, labelBackgroundColor: palette.axis },
      },
      autoSize: true,
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })
    chartRef.current = chart

    // Primary series is either candles or a line-of-closes — respects the app
    // "chart type" toggle without duplicating rendering.
    const priceSeries = chartType === 'area'
      ? chart.addSeries(AreaSeries, {
          topColor: 'rgba(59,130,246,0.35)',
          bottomColor: 'rgba(59,130,246,0)',
          lineColor: '#3b82f6', lineWidth: 2,
          priceLineVisible: true, lastValueVisible: true,
        })
      : chartType === 'line'
        ? chart.addSeries(LineSeries, {
            color: '#38bdf8', lineWidth: 2,
            priceLineVisible: true, lastValueVisible: true,
          })
        : chart.addSeries(CandlestickSeries, {
          upColor: palette.up, downColor: palette.down,
          borderUpColor: palette.up, borderDownColor: palette.down,
          wickUpColor: palette.wickUp, wickDownColor: palette.wickDown,
          priceLineVisible: true, lastValueVisible: true,
          })
    seriesRef.current.price = priceSeries
    markersRef.current = createSeriesMarkers(priceSeries, [], { autoScale: true, zOrder: 'aboveSeries' })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#94a3b8',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      visible: showVolume,
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    seriesRef.current.volume = volumeSeries

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData?.size) { setHovered(null); return }
      const bar = param.seriesData.get(priceSeries)
      if (!bar) { setHovered(null); return }
      // Candle bars carry OHLC; line/area bars only carry `value`.
      setHovered(bar.open != null
        ? { open: bar.open, high: bar.high, low: bar.low, close: bar.close }
        : { close: bar.value })
    })

    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return
      const next = { startIndex: Math.floor(range.from), endIndex: Math.ceil(range.to) }
      setLogicalWindow(current => (
        current?.startIndex === next.startIndex && current?.endIndex === next.endIndex ? current : next
      ))
    })

    // Tell the overlay effects the series registry is empty and must be refilled.
    setChartEpoch(epoch => epoch + 1)

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = {}
      priceLinesRef.current = []
      markersRef.current = null
    }
  // Rebuild when the palette (theme) or the chart type changes.
  // `palette` itself, not three of its eight fields. It is a useMemo on
  // [theme], so every field changes together and depending on the object is
  // both correct and complete — listing a subset only worked because bg
  // happened to change alongside axis, grid, text and the wick colours.
  }, [palette, chartType])

  // ── Primary data ─────────────────────────────────────────────────
  useEffect(() => {
    const { price, volume: vol } = seriesRef.current
    if (!price) return
    price.setData(chartType === 'candlestick' ? candles : lineData)
    if (vol) vol.setData(volume)
    if (candles.length && !chartRef.current._fittedOnce) {
      // The series now carries warmup history the user did not ask to see, so
      // fitContent() would zoom out past the selected period. Show the last
      // `visibleBars` instead — the warmup stays loaded and feeds the
      // indicators, it just sits off-screen to the left.
      const ts = chartRef.current.timeScale()
      const endIndex = Math.max(1, candles.length - viewOffset)
      if (visibleBars && endIndex > visibleBars) {
        ts.setVisibleRange({
          from: candles[endIndex - visibleBars].time,
          to: candles[endIndex - 1].time,
        })
      } else {
        ts.fitContent()
      }
      chartRef.current._fittedOnce = true
    }
  // chartEpoch: a theme switch rebuilds the chart without changing chartType,
  // so without it the freshly created price/volume series never get their data.
  }, [chartEpoch, candles, volume, lineData, chartType, viewOffset, visibleBars])

  // A new ticker or a new period must re-frame the view.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !candles.length) return
    const endIndex = Math.max(1, candles.length - viewOffset)
    const startIndex = visibleBars ? Math.max(0, endIndex - visibleBars) : 0
    chart.timeScale().setVisibleRange({
      from: candles[startIndex].time,
      to: candles[endIndex - 1].time,
    })
    chart._fittedOnce = true
  }, [candles, chartEpoch, currentTicker, interval, resetToken, viewOffset, visibleBars])

  const selectedEndIndex = Math.max(0, candles.length - 1 - viewOffset)
  const selectedStartIndex = visibleBars ? Math.max(0, selectedEndIndex - visibleBars + 1) : 0
  const visibleStartIndex = clamp(logicalWindow?.startIndex ?? selectedStartIndex, 0, Math.max(0, candles.length - 1))
  const visibleEndIndex = clamp(
    logicalWindow?.endIndex ?? selectedEndIndex,
    visibleStartIndex,
    Math.max(visibleStartIndex, candles.length - 1),
  )
  const patternMarkerData = useMemo(
    () => showPatterns ? buildPatternMarkers(ohlcv, patterns) : [],
    [ohlcv, patterns, showPatterns],
  )
  const gapMarkerData = useMemo(
    () => showGaps ? buildGapMarkers(ohlcv, gaps, visibleStartIndex, visibleEndIndex) : [],
    [gaps, ohlcv, showGaps, visibleEndIndex, visibleStartIndex],
  )

  // ── Overlay wiring ───────────────────────────────────────────────
  // Each overlay is created lazily and torn down when its toggle turns off so
  // we don't pay for chart series the user isn't looking at.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ohlcv?.length || !indicators) return

    const ensureLine = (key, values, color, opts = {}) => {
      if (!values) return remove(key)
      const data = toLine(ohlcv, values)
      if (!data.length) return remove(key)
      if (!seriesRef.current[key]) {
        seriesRef.current[key] = chart.addSeries(LineSeries, {
          color, lineWidth: opts.width || 2,
          priceLineVisible: false, lastValueVisible: true,
          lineStyle: opts.style || LineStyle.Solid,
          ...(opts.priceScaleId ? { priceScaleId: opts.priceScaleId } : {}),
        })
      }
      seriesRef.current[key].setData(data)
    }
    const remove = (key) => {
      if (seriesRef.current[key]) {
        try { chart.removeSeries(seriesRef.current[key]) } catch {}
        delete seriesRef.current[key]
      }
    }

    // Moving averages — when the SMA/EMA/WMA family toggle is on we show the
    // classic pair (20 + 50) because that's what most analysts want to see;
    // SMA200 gets its own toggle via the chip UI in a later pass.
    // 100/150 were computed on every load and never drawn. 150 in particular is
    // the trend gate this workflow reads ("above the 150 MA"), so it was being
    // paid for and thrown away.
    if (showSMA) {
      ensureLine('sma20', indicators.sma20, C.sma20)
      ensureLine('sma50', indicators.sma50, C.sma50)
      ensureLine('sma100', indicators.sma100, C.sma100, { width: 1 })
      ensureLine('sma150', indicators.sma150, C.sma150, { width: 2 })
      ensureLine('sma200', indicators.sma200, C.sma200)
    }
    else { remove('sma20'); remove('sma50'); remove('sma100'); remove('sma150'); remove('sma200') }

    if (showEMA) {
      ensureLine('ema9', indicators.ema9, C.ema9, { width: 1 })
      ensureLine('ema10', indicators.ema10, C.ema10, { width: 1 })
      ensureLine('ema20', indicators.ema20, C.ema20)
      ensureLine('ema50', indicators.ema50, C.ema50)
      ensureLine('ema200', indicators.ema200, C.ema200, { width: 1 })
    } else { remove('ema9'); remove('ema10'); remove('ema20'); remove('ema50'); remove('ema200') }

    if (showWMA) { ensureLine('wma20', indicators.wma20, C.wma20); ensureLine('wma50', indicators.wma50, C.wma50) }
    else         { remove('wma20'); remove('wma50') }

    if (showBB && indicators.bb20) {
      ensureLine('bbUpper', indicators.bb20.upper, C.bbUpper, { width: 1, style: LineStyle.Dashed })
      ensureLine('bbLower', indicators.bb20.lower, C.bbLower, { width: 1, style: LineStyle.Dashed })
      ensureLine('bbMid',   indicators.bb20.middle, C.bbMiddle,  { width: 1 })
    } else { remove('bbUpper'); remove('bbLower'); remove('bbMid') }

    if (showVWAP) ensureLine('vwap', indicators.vwap, C.vwap, { width: 2 })
    else          remove('vwap')

    if (showSupertrend && indicators.supertrend) {
      const { up, down } = toSupertrendSeries(ohlcv, indicators.supertrend)
      // Two separate series (up / down) so the color tells the story.
      const setSplit = (key, data, color) => {
        if (!data.length) return remove(key)
        if (!seriesRef.current[key]) {
          seriesRef.current[key] = chart.addSeries(LineSeries, {
            color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
          })
        }
        seriesRef.current[key].setData(data)
      }
      setSplit('supertrendUp',   up,   C.supertrendUp)
      setSplit('supertrendDown', down, C.supertrendDown)
    } else { remove('supertrendUp'); remove('supertrendDown') }

    if (showIchimoku && indicators.ichimoku) {
      ensureLine('ichConv', indicators.ichimoku.conversion, C.ichimokuTenkan, { width: 1 })
      ensureLine('ichBase', indicators.ichimoku.base,       C.ichimokuKijun, { width: 1 })
      ensureLine('ichSpanA', indicators.ichimoku.spanA,     C.ichimokuSpanA, { width: 1 })
      ensureLine('ichSpanB', indicators.ichimoku.spanB,     C.ichimokuSpanB, { width: 1 })
      ensureLine('ichLagging', indicators.ichimoku.laggingSpan, C.ichimokuChikou, { width: 1 })
    } else { remove('ichConv'); remove('ichBase'); remove('ichSpanA'); remove('ichSpanB'); remove('ichLagging') }

    if (showKeltner && indicators.keltner) {
      ensureLine('keltUpper', indicators.keltner.upper, C.keltnerUpper, { width: 1, style: LineStyle.Dashed })
      ensureLine('keltMiddle', indicators.keltner.middle, C.keltnerMiddle, { width: 1 })
      ensureLine('keltLower', indicators.keltner.lower, C.keltnerLower, { width: 1, style: LineStyle.Dashed })
    } else { remove('keltUpper'); remove('keltMiddle'); remove('keltLower') }

    if (showDonchian && indicators.donchian) {
      ensureLine('donchUpper', indicators.donchian.upper, C.donchianUpper, { width: 1, style: LineStyle.Dashed })
      ensureLine('donchMiddle', indicators.donchian.middle, C.donchianMiddle, { width: 1, style: LineStyle.Dotted })
      ensureLine('donchLower', indicators.donchian.lower, C.donchianLower, { width: 1, style: LineStyle.Dashed })
    } else { remove('donchUpper'); remove('donchMiddle'); remove('donchLower') }

    if (showVolume && showVolumeMA) {
      ensureLine('volumeMA', indicators.avgVol, C.volumeMA, { width: 1, priceScaleId: 'volume' })
    } else remove('volumeMA')
  }, [
    chartEpoch,
    ohlcv, indicators,
    showSMA, showEMA, showWMA, showBB, showVWAP, showVolume, showVolumeMA,
    showSupertrend, showIchimoku, showKeltner, showDonchian,
  ])

  useEffect(() => {
    seriesRef.current.volume?.applyOptions({ visible: showVolume })
    if (showVolume) {
      seriesRef.current.volume?.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    }
  }, [chartEpoch, showVolume])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    chart.applyOptions({
      handleScroll: measurementEnabled
        ? false
        : { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: measurementEnabled
        ? false
        : { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })

    if (!measurementEnabled) setMeasurement(null)
  }, [chartEpoch, measurementEnabled, resetToken])

  useEffect(() => {
    const markerApi = markersRef.current
    if (!markerApi) return
    markerApi.setMarkers([...patternMarkerData, ...gapMarkerData].sort((a, b) => (
      a.time - b.time || String(a.id).localeCompare(String(b.id))
    )))
  }, [chartEpoch, gapMarkerData, patternMarkerData])

  // ── Chart-pattern, triangle and gap geometry ─────────────────────
  // These are shapes spanning a bar range rather than a value per bar, so each
  // one gets its own short LineSeries. Keys are regenerated every run and any
  // series left over from the previous run is removed, which keeps the chart
  // correct when a pattern disappears after new data arrives.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ohlcv?.length) return

    const drawn = new Set()
    const draw = (key, points, color, opts = {}) => {
      drawn.add(key)
      if (!seriesRef.current[key]) {
        seriesRef.current[key] = chart.addSeries(LineSeries, {
          color,
          lineWidth: opts.width ?? 2,
          lineStyle: opts.style ?? LineStyle.Solid,
          priceLineVisible: false,
          // A projected trendline is a level you trade against, so its current
          // value belongs on the price axis. Everything else stays unlabelled
          // or the axis turns into noise.
          lastValueVisible: opts.showLastValue ?? false,
          crosshairMarkerVisible: false,
          ...(opts.title ? { title: opts.title } : {}),
        })
      }
      seriesRef.current[key].setData(points)
    }

    const wanted = (patterns?.patterns ?? []).filter(pattern => (
      (showPatterns && !isTrendlinePattern(pattern)) || (showTriangles && isTrendlinePattern(pattern))
    ))

    wanted.forEach((pattern, patternIndex) => {
      const color = patternColor(pattern)
      const id = pattern.key ?? patternIndex
      const isTrendline = isTrendlinePattern(pattern)

      patternSegments(ohlcv, pattern).forEach((segment, segmentIndex) => {
        draw(`pat:${id}:${segmentIndex}`, segment, color, { width: 2 })
      })

      // Confirmed segment above, projection below: solid through the pivots
      // that define the line, dashed from the last pivot to the current bar so
      // it is obvious which part is observed and which is extrapolated.
      if (isTrendline && extendTrendlines) {
        ;(pattern.visual?.lines ?? []).forEach((line, lineIndex) => {
          const projection = projectLineToLastBar(ohlcv, line)
          if (!projection) return
          draw(`pat:${id}:proj:${lineIndex}`, projection, color, {
            width: 2,
            style: LineStyle.Dashed,
            showLastValue: true,
          })
        })
      }
    })

    if (showGaps) {
      // lightweight-charts has no rectangle primitive, so a gap is drawn as its
      // two boundaries spanning the bars the gap is open for. That shows both
      // the price zone and how long it stayed unfilled.
      //
      // Keep only gaps that actually overlap what is on screen, then take the
      // newest ten of those.
      //
      // Sorting newest-first and capping globally was still wrong once the
      // window narrowed: the visible slice differs sharply by timeframe (78
      // bars on 1D, 180 on 1H, 126 on 6M), so on the shorter windows several of
      // the ten newest gaps sat off-screen and the toggle looked half-broken. A
      // gap counts as visible if any part of its span is — an old gap still
      // unfilled reaches into view even though its index is low, and that is
      // exactly the one worth seeing.
      const recentGaps = (gaps?.gaps ?? [])
        .filter(gap => (gap.endIndex ?? visibleEndIndex) >= visibleStartIndex && gap.index <= visibleEndIndex)
        .sort((a, b) => b.index - a.index)
        .slice(0, 10)
      recentGaps.forEach(gap => {
        const gapEndIndex = Math.min(gap.endIndex ?? visibleEndIndex, visibleEndIndex)
        const lineStartIndex = gapEndIndex === gap.index
          ? Math.max(visibleStartIndex, gap.index - 1)
          : gap.index
        const from = timeAtIndex(ohlcv, lineStartIndex)
        const to = timeAtIndex(ohlcv, gapEndIndex)
        if (from == null || to == null || from === to) return
        if (!Number.isFinite(gap.zoneLow) || !Number.isFinite(gap.zoneHigh)) return
        // Most gaps are only 1-4 bars wide, and a 1px dotted hairline over that
        // span is invisible on a 126-bar view. Weight by status instead: an
        // unfilled gap is the one that can still be traded, so it gets a solid
        // 2px boundary, while a closed one stays deliberately faint.
        const style = gap.status === 'closed'
          ? { color: 'rgba(100, 116, 139, 0.7)', width: 1, style: LineStyle.Dotted }
          : gap.status === 'partial'
            ? { color: TRADER_COLORS.warning, width: 2, style: LineStyle.Dashed }
            : { color: TRADER_COLORS.resistance, width: 2, style: LineStyle.Solid }
        draw(`gap:${gap.id}:hi`, [{ time: from, value: gap.zoneHigh }, { time: to, value: gap.zoneHigh }], style.color, style)
        draw(`gap:${gap.id}:lo`, [{ time: from, value: gap.zoneLow  }, { time: to, value: gap.zoneLow  }], style.color, style)
      })
    }

    if (showFibonacci || showFibExtension) {
      const fib = computeFibonacci(ohlcv.slice(visibleStartIndex, visibleEndIndex + 1), showFibExtension)
      if (fib) {
        const firstIndex = visibleStartIndex + fib.anchorA.index
        const secondIndex = visibleStartIndex + fib.anchorB.index
        const firstTime = timeAtIndex(ohlcv, firstIndex)
        const secondTime = timeAtIndex(ohlcv, secondIndex)
        if (firstTime != null && secondTime != null && firstTime !== secondTime) {
          const points = [
            { time: firstTime, value: fib.anchorA.price },
            { time: secondTime, value: fib.anchorB.price },
          ].sort((a, b) => a.time - b.time)
          draw('fib:anchor', points, 'rgba(234, 179, 8, 0.9)', {
            width: 2,
            style: LineStyle.Dashed,
          })
        }
      }
    }

    for (const key of Object.keys(seriesRef.current)) {
      if ((key.startsWith('pat:') || key.startsWith('gap:') || key.startsWith('fib:')) && !drawn.has(key)) {
        try { chart.removeSeries(seriesRef.current[key]) } catch { /* already gone */ }
        delete seriesRef.current[key]
      }
    }
  }, [
    chartEpoch, ohlcv, patterns, gaps,
    showPatterns, showTriangles, showGaps, showFibonacci, showFibExtension,
    extendTrendlines, visibleEndIndex, visibleStartIndex,
  ])

  // ── Horizontal price lines (pivots, prev high/low, 52-week hi/lo) ──
  // These are per-level and don't need per-bar data, so createPriceLine on
  // the primary series is the right tool.
  useEffect(() => {
    const { price } = seriesRef.current
    if (!price) return

    // Wipe old horizontal lines before recreating (toggles change frequently).
    for (const line of priceLinesRef.current) {
      try { price.removePriceLine(line) } catch {}
    }
    priceLinesRef.current = []

    // Every price line puts a label on the right axis, and with Fibonacci and
    // the pivot set on at once that axis reached 32 stacked labels — unreadable
    // regardless of font size. Structural levels keep their label; the dense
    // grids draw the line and stay off the axis.
    const addLine = ({ value, color, title, style = LineStyle.Dotted, width = 1, axisLabel = true }) => {
      if (value == null || !Number.isFinite(value)) return
      const line = price.createPriceLine({ price: value, color, lineWidth: width, lineStyle: style, axisLabelVisible: axisLabel, title })
      priceLinesRef.current.push(line)
    }

    if (showPivotPoints && indicators?.pivotPoints) {
      // Keys are lowercase { pivot, r1, s1, r2, s2, r3, s3 } — reading P/R1/S1
      // yielded undefined, so addLine bailed on every level and no pivot line
      // was ever drawn.
      const p = indicators.pivotPoints
      addLine({ value: p.pivot, color: C.pivot,  title: 'P',  width: 1 })
      addLine({ value: p.r1,    color: C.pivotR1, title: 'R1' })
      addLine({ value: p.r2,    color: C.pivotR1, title: 'R2', axisLabel: false })
      addLine({ value: p.r3,    color: C.pivotR1, title: 'R3', axisLabel: false })
      addLine({ value: p.s1,    color: C.pivotS1, title: 'S1' })
      addLine({ value: p.s2,    color: C.pivotS1, title: 'S2', axisLabel: false })
      addLine({ value: p.s3,    color: C.pivotS1, title: 'S3', axisLabel: false })
    }
    // Prefer indicators.priceLevels — the values PriceChart and the analysis
    // panels use — so both engines label the same levels. Recomputing them
    // locally let the two charts disagree by a few cents.
    const levels = indicators?.priceLevels
    if (showPrevHighLow) {
      // On intraday charts these are the prior session's extremes, not the
      // previous candle. If no complete prior session exists, draw nothing.
      addLine({ value: levels?.previousHigh, color: C.prevHigh, title: 'PDH' })
      addLine({ value: levels?.previousLow, color: C.prevLow, title: 'PDL' })
    }
    if (showHighLow52 && ohlcv?.length) {
      addLine({ value: technicalAnalysis?.keyLevels?.high52Week ?? levels?.high52Week, color: C.high52, title: '52W High' })
      addLine({ value: technicalAnalysis?.keyLevels?.low52Week ?? levels?.low52Week, color: C.low52, title: '52W Low' })
    }

    // ── Trade levels and key structure (the "Levels" / אזור toggle) ──
    if (showLevels) {
      addLine({ value: decision?.support,    color: TRADER_COLORS.support,    title: 'S', width: 1.5, style: LineStyle.Solid })
      addLine({ value: decision?.resistance, color: TRADER_COLORS.resistance, title: 'R', width: 1.5, style: LineStyle.Solid })
      addLine({ value: decision?.invalidation ?? decision?.stopLoss, color: TRADER_COLORS.stopLoss,   title: 'SL', width: 1.8, style: LineStyle.Dashed })
      addLine({ value: decision?.takeProfit, color: TRADER_COLORS.takeProfit, title: 'TP', width: 1.8, style: LineStyle.Dashed })
      ;(technicalAnalysis?.keyLevels?.support ?? []).slice(0, 2)
        .forEach((value, i) => addLine({ value, color: 'rgba(6, 182, 212, 0.9)', title: `S${i + 2}`, axisLabel: false }))
      ;(technicalAnalysis?.keyLevels?.resistance ?? []).slice(0, 2)
        .forEach((value, i) => addLine({ value, color: 'rgba(249, 115, 22, 0.9)', title: `R${i + 2}`, axisLabel: false }))
      ;(technicalAnalysis?.keyLevels?.breakoutLevels ?? []).slice(0, 1)
        .forEach(value => addLine({ value, color: 'rgba(56, 189, 248, 0.9)', title: 'BO' }))
    }
    if (showLevels || showTechnicalMethod) {
      addLine({ value: technicalMethod?.supportResistance?.nearestSupport?.midpoint, color: 'rgba(45, 212, 191, 0.9)', title: 'M-S', width: 1.5, style: LineStyle.Solid })
      addLine({ value: technicalMethod?.supportResistance?.nearestResistance?.midpoint, color: 'rgba(251, 146, 60, 0.92)', title: 'M-R', width: 1.5, style: LineStyle.Solid })
      addLine({ value: technicalMethod?.risk?.technicalInvalidationLevel, color: 'rgba(244, 114, 182, 0.92)', title: 'M Stop', width: 1.5, style: LineStyle.Dashed })
      addLine({ value: technicalMethod?.setup?.trigger?.price, color: 'rgba(56, 189, 248, 0.95)', title: 'M Trigger', width: 1.7, style: LineStyle.Solid })
      ;(technicalMethod?.setup?.possibleTargets ?? []).slice(0, 2)
        .forEach((value, i) => addLine({ value, color: 'rgba(168, 85, 247, 0.9)', title: `M T${i + 1}`, width: 1.5, style: LineStyle.Dashed }))
      addLine({ value: technicalMethod?.fibonacci?.goldenZone?.lower, color: 'rgba(234, 179, 8, 0.85)', title: 'M Fib 50', style: LineStyle.Dotted })
      addLine({ value: technicalMethod?.fibonacci?.goldenZone?.upper, color: 'rgba(234, 179, 8, 0.85)', title: 'M Fib 61.8', style: LineStyle.Dotted })
    }

    // ── Pattern entry / target / stop ──
    // The detector already computes all three; they were simply never drawn, so
    // a setup like a cup-and-handle sitting right under its pivot showed as a
    // shape with no levels — nothing to enter on and nothing to aim at.
    if (showTargets) {
      const spot = ohlcv?.[ohlcv.length - 1]?.c
      const chosen = patternsWorthTargeting(patterns)

      // Measured-move projections for the leading setup only. Three anchors on
      // each of three patterns would be nine more lines saying similar things;
      // the strongest pattern is the one whose breakout the projection assumes.
      const primary = chosen[0]
      const primaryTrigger = patternBreakoutLevel(primary, spot)
      if (primaryTrigger != null) {
        const dir = (primary.direction ?? primary.bias) === 'bearish' ? 'bearish' : 'bullish'
        measuredMoveTargets(ohlcv, primaryTrigger, dir).forEach(t => {
          addLine({
            value: t.price,
            color: 'rgba(168, 85, 247, 0.9)',
            // The anchor is in the label on purpose: a measured move is only as
            // good as the low it was measured from, so the number should never
            // appear without saying which structure produced it.
            title: `⌁ ${t.label} ${t.price.toFixed(2)}`,
            style: LineStyle.Dashed,
            width: 1.4,
          })
        })
      }

      chosen.forEach(pattern => {
        const bullish = (pattern.direction ?? pattern.bias) === 'bullish'
        const tag = pattern.label ?? pattern.key ?? ''
        const short = tag.length > 14 ? `${tag.slice(0, 13)}…` : tag

        addLine({
          value: patternBreakoutLevel(pattern, spot),
          color: 'rgba(56, 189, 248, 0.95)',
          title: `▲ ${short}`,
          style: LineStyle.Solid,
          width: 1.6,
        })
        if (targetIsCoherent(pattern, spot)) {
          addLine({
            value: pattern.targetPrice,
            color: bullish ? TRADER_COLORS.takeProfit : TRADER_COLORS.bearish,
            title: `🎯 ${pattern.targetPrice.toFixed(2)}`,
            style: LineStyle.Dashed,
            width: 1.8,
          })
        }
        addLine({
          value: pattern.meta?.invalidationLevel,
          color: TRADER_COLORS.stopLoss,
          title: '✕ SL',
          style: LineStyle.Dotted,
          width: 1.4,
        })
      })
    }

    // ── Fibonacci ──
    // Anchor to the selected visible range. Using the full warm-up history can
    // put every retracement outside the candles the user is inspecting.
    if (showFibonacci || showFibExtension) {
      const fib = computeFibonacci(ohlcv.slice(visibleStartIndex, visibleEndIndex + 1), showFibExtension)
      fib?.levels?.forEach(level => addLine({
        value: level.price,
        color: level.ratio === 0 || level.ratio === 1 ? 'rgba(148, 163, 184, 0.9)' : 'rgba(234, 179, 8, 0.75)',
        title: `FIB ${level.label}`,
        style: LineStyle.Dotted,
        axisLabel: [0, 0.5, 0.618, 1].includes(level.ratio),
      }))
    }
  }, [
    chartEpoch, ohlcv, indicators,
    showPivotPoints, showPrevHighLow, showHighLow52,
    showLevels, showTechnicalMethod, showFibonacci, showFibExtension, showTargets,
    decision, technicalMethod, technicalAnalysis, patterns, visibleEndIndex, visibleStartIndex,
  ])

  const measurementPoint = event => {
    const chart = chartRef.current
    const priceSeries = seriesRef.current.price
    if (!chart || !priceSeries) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const plotWidth = Math.max(1, chart.timeScale().width() - 1)
    const x = clamp(event.clientX - rect.left, 0, plotWidth)
    const y = clamp(event.clientY - rect.top, 0, Math.max(1, rect.height - 28))
    const price = priceSeries.coordinateToPrice(y)
    const logical = chart.timeScale().coordinateToLogical(x)
    if (!Number.isFinite(price)) return null
    return { x, y, price, logical }
  }

  const handleMeasurementPointerDown = event => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const point = measurementPoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setMeasurement({ active: true, start: point, end: point })
  }

  const handleMeasurementPointerMove = event => {
    const point = measurementPoint(event)
    if (!point) return
    setMeasurement(current => {
      if (!current?.active) return current
      return { ...current, end: point }
    })
  }

  const handleMeasurementPointerUp = event => {
    event.preventDefault()
    event.stopPropagation()
    const point = measurementPoint(event)
    setMeasurement(current => {
      if (!current?.active) return current
      return { ...current, active: false, end: point ?? current.end }
    })
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const validMeasurement = Number.isFinite(measurement?.start?.price) &&
    measurement.start.price > 0 && Number.isFinite(measurement?.end?.price)
  const measurementLabel = validMeasurement
    ? `${measurement.end.price >= measurement.start.price ? '+' : ''}${(((measurement.end.price - measurement.start.price) / measurement.start.price) * 100).toFixed(2)}% | ${measurement.end.price - measurement.start.price >= 0 ? '+' : ''}${(measurement.end.price - measurement.start.price).toFixed(2)} | ${Math.round(Math.abs((measurement.end.logical ?? 0) - (measurement.start.logical ?? 0)))} bars`
    : null

  return (
    <div
      data-pattern-marker-count={patternMarkerData.length}
      data-gap-marker-count={gapMarkerData.length}
      data-measurement-active={measurementEnabled ? 'true' : 'false'}
      style={{ position: 'relative' }}
    >
      {/* Floating OHLC readout on crosshair hover */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 8, insetInlineStart: 8, zIndex: 5,
          background: 'rgba(11,15,25,0.85)', border: '1px solid #1f2937',
          borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#e5e7eb',
          pointerEvents: 'none', fontVariantNumeric: 'tabular-nums', direction: 'ltr',
        }}>
          {hovered.open != null ? (
            <>
              O <b>{hovered.open?.toFixed(2)}</b>{'  '}
              H <b style={{ color: '#10b981' }}>{hovered.high?.toFixed(2)}</b>{'  '}
              L <b style={{ color: '#ef4444' }}>{hovered.low?.toFixed(2)}</b>{'  '}
              C <b>{hovered.close?.toFixed(2)}</b>
            </>
          ) : (
            <>C <b>{hovered.close?.toFixed(2)}</b></>
          )}
        </div>
      )}

      {(showPatterns || showGaps) && (
        <div style={{
          position: 'absolute', bottom: 8, insetInlineStart: 8, zIndex: 5,
          display: 'flex', gap: 6, pointerEvents: 'none',
        }}>
          {showPatterns && (
            <span style={{
              border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: 999,
              background: 'rgba(2, 6, 23, 0.84)', color: '#a7f3d0',
              padding: '3px 7px', fontSize: 10, fontWeight: 700,
            }}>
              {patternMarkerData.length} {language === 'he' ? 'סימוני תבנית' : 'pattern markers'}
            </span>
          )}
          {showGaps && (
            <span style={{
              border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 999,
              background: 'rgba(2, 6, 23, 0.84)', color: '#fde68a',
              padding: '3px 7px', fontSize: 10, fontWeight: 700,
            }}>
              {gapMarkerData.length} Gaps
            </span>
          )}
        </div>
      )}

      <div ref={containerRef} style={{ height, width: '100%' }} />
      {measurementEnabled && (
        <div
          role="application"
          aria-label={language === 'he' ? 'סרגל מדידת מחיר ואחוזים' : 'Price and percentage ruler'}
          onPointerDown={handleMeasurementPointerDown}
          onPointerMove={handleMeasurementPointerMove}
          onPointerUp={handleMeasurementPointerUp}
          onPointerCancel={handleMeasurementPointerUp}
          style={{
            position: 'absolute', inset: 0, zIndex: 7, cursor: 'crosshair',
            touchAction: 'none', userSelect: 'none',
          }}
        >
          {!measurement?.start && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              border: '1px solid rgba(34, 211, 238, 0.5)', borderRadius: 8,
              background: 'rgba(2, 6, 23, 0.92)', color: '#cffafe',
              padding: '7px 11px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              {language === 'he' ? 'גרור בין שתי נקודות על הגרף למדידת שינוי' : 'Drag between two chart points to measure the move'}
            </div>
          )}
          {measurement?.start && measurement?.end && (
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <line
              x1={measurement.start.x}
              y1={measurement.start.y}
              x2={measurement.end.x}
              y2={measurement.end.y}
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <circle cx={measurement.start.x} cy={measurement.start.y} r="4" fill="#22d3ee" />
            <circle cx={measurement.end.x} cy={measurement.end.y} r="4" fill="#22d3ee" />
            </svg>
          )}
          {measurementLabel && (
            <div style={{
              position: 'absolute',
              left: (measurement.start.x + measurement.end.x) / 2,
              top: (measurement.start.y + measurement.end.y) / 2,
              transform: 'translate(-50%, -130%)',
              border: '1px solid rgba(34, 211, 238, 0.55)',
              borderRadius: 6,
              background: 'rgba(2, 6, 23, 0.92)',
              color: '#cffafe',
              padding: '5px 8px',
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              {measurementLabel}
            </div>
          )}
          {measurement?.start && (
            <button
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setMeasurement(null) }}
              style={{
                position: 'absolute', top: 10, insetInlineEnd: 10,
                border: '1px solid rgba(148, 163, 184, 0.45)', borderRadius: 6,
                background: 'rgba(2, 6, 23, 0.9)', color: '#e2e8f0',
                padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {language === 'he' ? 'נקה מדידה' : 'Clear measure'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
