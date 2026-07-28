import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries,
  CrosshairMode, LineStyle,
} from 'lightweight-charts'
import useStore from '../../store/useStore'
import { computeFibonacci, isTrendlinePattern } from './chartHelpers'
import { TRADER_COLORS } from '../../lib/traderColors'

// TradingView-quality chart (lightweight-charts, MIT). Rendering + navigation
// (mouse-wheel zoom, click-drag pan, native crosshair, right-side price axis,
// synced volume) come free from the library. The interesting work is wiring
// every indicator toggle the app's ChartControls exposes to the right kind of
// series, so the button in the header actually changes what's drawn.

// Distinct colors per overlay so a busy chart is still readable.
const C = {
  sma20:   '#f59e0b',
  sma50:   '#3b82f6',
  sma100:  '#a855f7',
  sma200:  '#ec4899',
  ema20:   '#10b981',
  ema50:   '#ef4444',
  wma20:   '#facc15',
  wma50:   '#8b5cf6',
  bbUpper: '#94a3b8',
  bbLower: '#94a3b8',
  bbMid:   '#64748b',
  vwap:    '#22d3ee',
  supertrendUp:   '#10b981',
  supertrendDown: '#ef4444',
  ichConv: '#f59e0b',
  ichBase: '#3b82f6',
  ichSpanA: 'rgba(16, 185, 129, 0.5)',
  ichSpanB: 'rgba(239, 68, 68, 0.5)',
  keltUpper: '#0ea5e9',
  keltLower: '#0ea5e9',
  donchUpper: '#f97316',
  donchLower: '#f97316',
  pivotP:  '#94a3b8',
  pivotR1: '#10b981',
  pivotS1: '#ef4444',
  prevHigh: '#22d3ee',
  prevLow:  '#f97316',
  high52: '#84cc16',
  low52:  '#f43f5e',
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

function patternColor(pattern) {
  const dir = pattern?.direction ?? pattern?.bias
  if (dir === 'bullish') return TRADER_COLORS.bullish
  if (dir === 'bearish') return TRADER_COLORS.bearish
  return TRADER_COLORS.neutral
}

// Supertrend has direction switches; a single line series looks best when we
// split it into "up" (green) and "down" (red) segments and let the color
// change tell the story. We build two aligned arrays with gaps at the
// direction changes so each series only draws its half of the signal.
function toSupertrendSeries(ohlcv, supertrend) {
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
    if (dir === 'bullish')      up.push({ time, value: v })
    else if (dir === 'bearish') down.push({ time, value: v })
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
  patterns = null,          // signal.patterns  — { patterns: [{ visual, ... }] }
  gaps = null,              // signal.pro.gaps  — { gaps: [{ zoneLow, zoneHigh, ... }] }
  decision = null,          // entry / stop / target / support / resistance
  technicalAnalysis = null, // keyLevels.support | .resistance | .breakoutLevels
  // How many of the loaded bars to show. The rest is warmup history that
  // feeds the indicators without being displayed.
  visibleBars = null,
  chartType = 'candle', // 'candle' | 'line'
}) {
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const seriesRef     = useRef({})       // { candle, volume, sma20, ... }
  const priceLinesRef = useRef([])       // horizontal lines (pivots, hi/lo)
  const theme         = useStore(s => s.theme) || 'dark'
  const currentTicker = useStore(s => s.currentTicker)
  const [hovered, setHovered] = useState(null)
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
      },
      grid: {
        vertLines: { color: palette.grid, style: LineStyle.Dotted },
        horzLines: { color: palette.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: palette.axis, scaleMargins: { top: 0.08, bottom: 0.25 } },
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
    const priceSeries = chartType === 'line'
      ? chart.addSeries(AreaSeries, {
          topColor: 'rgba(59,130,246,0.35)',
          bottomColor: 'rgba(59,130,246,0)',
          lineColor: '#3b82f6', lineWidth: 2,
          priceLineVisible: true, lastValueVisible: true,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: palette.up, downColor: palette.down,
          borderUpColor: palette.up, borderDownColor: palette.down,
          wickUpColor: palette.wickUp, wickDownColor: palette.wickDown,
          priceLineVisible: true, lastValueVisible: true,
        })
    seriesRef.current.price = priceSeries

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#94a3b8',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
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

    // Tell the overlay effects the series registry is empty and must be refilled.
    setChartEpoch(epoch => epoch + 1)

    return () => { chart.remove(); chartRef.current = null; seriesRef.current = {}; priceLinesRef.current = [] }
  // Rebuild when the palette (theme) or the chart type changes.
  }, [palette.bg, palette.up, palette.down, chartType])

  // ── Primary data ─────────────────────────────────────────────────
  useEffect(() => {
    const { price, volume: vol } = seriesRef.current
    if (!price) return
    price.setData(chartType === 'line' ? lineData : candles)
    if (vol) vol.setData(volume)
    if (candles.length && !chartRef.current._fittedOnce) {
      // The series now carries warmup history the user did not ask to see, so
      // fitContent() would zoom out past the selected period. Show the last
      // `visibleBars` instead — the warmup stays loaded and feeds the
      // indicators, it just sits off-screen to the left.
      const ts = chartRef.current.timeScale()
      if (visibleBars && candles.length > visibleBars) {
        ts.setVisibleRange({
          from: candles[candles.length - visibleBars].time,
          to: candles[candles.length - 1].time,
        })
      } else {
        ts.fitContent()
      }
      chartRef.current._fittedOnce = true
    }
  // chartEpoch: a theme switch rebuilds the chart without changing chartType,
  // so without it the freshly created price/volume series never get their data.
  }, [chartEpoch, candles, volume, lineData, chartType, visibleBars])

  // A new ticker or a new period must re-frame the view.
  useEffect(() => {
    if (chartRef.current) chartRef.current._fittedOnce = false
  }, [currentTicker, visibleBars])

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
    if (showSMA) { ensureLine('sma20', indicators.sma20, C.sma20); ensureLine('sma50', indicators.sma50, C.sma50); ensureLine('sma200', indicators.sma200, C.sma200) }
    else         { remove('sma20'); remove('sma50'); remove('sma200') }

    if (showEMA) { ensureLine('ema20', indicators.ema20, C.ema20); ensureLine('ema50', indicators.ema50, C.ema50) }
    else         { remove('ema20'); remove('ema50') }

    if (showWMA) { ensureLine('wma20', indicators.wma20, C.wma20); ensureLine('wma50', indicators.wma50, C.wma50) }
    else         { remove('wma20'); remove('wma50') }

    if (showBB && indicators.bb20) {
      ensureLine('bbUpper', indicators.bb20.upper, C.bbUpper, { width: 1, style: LineStyle.Dashed })
      ensureLine('bbLower', indicators.bb20.lower, C.bbLower, { width: 1, style: LineStyle.Dashed })
      ensureLine('bbMid',   indicators.bb20.middle, C.bbMid,  { width: 1 })
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
      ensureLine('ichConv', indicators.ichimoku.conversion, C.ichConv, { width: 1 })
      ensureLine('ichBase', indicators.ichimoku.base,       C.ichBase, { width: 1 })
      ensureLine('ichSpanA', indicators.ichimoku.spanA,     C.ichSpanA, { width: 1 })
      ensureLine('ichSpanB', indicators.ichimoku.spanB,     C.ichSpanB, { width: 1 })
    } else { remove('ichConv'); remove('ichBase'); remove('ichSpanA'); remove('ichSpanB') }

    if (showKeltner && indicators.keltner) {
      ensureLine('keltUpper', indicators.keltner.upper, C.keltUpper, { width: 1, style: LineStyle.Dashed })
      ensureLine('keltLower', indicators.keltner.lower, C.keltLower, { width: 1, style: LineStyle.Dashed })
    } else { remove('keltUpper'); remove('keltLower') }

    if (showDonchian && indicators.donchian) {
      ensureLine('donchUpper', indicators.donchian.upper, C.donchUpper, { width: 1, style: LineStyle.Dashed })
      ensureLine('donchLower', indicators.donchian.lower, C.donchLower, { width: 1, style: LineStyle.Dashed })
    } else { remove('donchUpper'); remove('donchLower') }
  }, [
    chartEpoch,
    ohlcv, indicators,
    showSMA, showEMA, showWMA, showBB, showVWAP,
    showSupertrend, showIchimoku, showKeltner, showDonchian,
  ])

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
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
      }
      seriesRef.current[key].setData(points)
    }

    const wanted = (patterns?.patterns ?? []).filter(pattern => (
      (showPatterns && !isTrendlinePattern(pattern)) || (showTriangles && isTrendlinePattern(pattern))
    ))

    wanted.forEach((pattern, patternIndex) => {
      const color = patternColor(pattern)
      patternSegments(ohlcv, pattern).forEach((segment, segmentIndex) => {
        draw(`pat:${pattern.key ?? patternIndex}:${segmentIndex}`, segment, color, { width: 2 })
      })
    })

    if (showGaps) {
      // lightweight-charts has no rectangle primitive, so a gap is drawn as its
      // two boundaries spanning the bars the gap is open for. That shows both
      // the price zone and how long it stayed unfilled.
      ;(gaps?.gaps ?? []).slice(0, 10).forEach(gap => {
        const from = timeAtIndex(ohlcv, gap.index)
        const to = timeAtIndex(ohlcv, gap.endIndex ?? ohlcv.length - 1)
        if (from == null || to == null || from === to) return
        if (!Number.isFinite(gap.zoneLow) || !Number.isFinite(gap.zoneHigh)) return
        const color = gap.status === 'closed'
          ? 'rgba(100, 116, 139, 0.75)'
          : gap.status === 'partial'
            ? TRADER_COLORS.warning
            : TRADER_COLORS.resistance
        draw(`gap:${gap.id}:hi`, [{ time: from, value: gap.zoneHigh }, { time: to, value: gap.zoneHigh }], color, { width: 1, style: LineStyle.Dotted })
        draw(`gap:${gap.id}:lo`, [{ time: from, value: gap.zoneLow  }, { time: to, value: gap.zoneLow  }], color, { width: 1, style: LineStyle.Dotted })
      })
    }

    for (const key of Object.keys(seriesRef.current)) {
      if ((key.startsWith('pat:') || key.startsWith('gap:')) && !drawn.has(key)) {
        try { chart.removeSeries(seriesRef.current[key]) } catch { /* already gone */ }
        delete seriesRef.current[key]
      }
    }
  }, [chartEpoch, ohlcv, patterns, gaps, showPatterns, showTriangles, showGaps])

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

    const addLine = ({ value, color, title, style = LineStyle.Dotted, width = 1 }) => {
      if (value == null || !Number.isFinite(value)) return
      const line = price.createPriceLine({ price: value, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title })
      priceLinesRef.current.push(line)
    }

    if (showPivotPoints && indicators?.pivotPoints) {
      // Keys are lowercase { pivot, r1, s1, r2, s2, r3, s3 } — reading P/R1/S1
      // yielded undefined, so addLine bailed on every level and no pivot line
      // was ever drawn.
      const p = indicators.pivotPoints
      addLine({ value: p.pivot, color: C.pivotP,  title: 'P',  width: 1 })
      addLine({ value: p.r1,    color: C.pivotR1, title: 'R1' })
      addLine({ value: p.r2,    color: C.pivotR1, title: 'R2' })
      addLine({ value: p.s1,    color: C.pivotS1, title: 'S1' })
      addLine({ value: p.s2,    color: C.pivotS1, title: 'S2' })
    }
    // Prefer indicators.priceLevels — the values PriceChart and the analysis
    // panels use — so both engines label the same levels. Recomputing them
    // locally let the two charts disagree by a few cents.
    const levels = indicators?.priceLevels
    if (showPrevHighLow) {
      const prevBar = ohlcv?.length >= 2 ? ohlcv[ohlcv.length - 2] : null
      addLine({ value: levels?.previousHigh ?? prevBar?.h, color: C.prevHigh, title: 'PDH' })
      addLine({ value: levels?.previousLow  ?? prevBar?.l, color: C.prevLow,  title: 'PDL' })
    }
    if (showHighLow52 && ohlcv?.length) {
      const window = ohlcv.slice(-252) // ~1 trading year
      addLine({ value: levels?.high52Week ?? Math.max(...window.map(b => b.h)), color: C.high52, title: '52W High' })
      addLine({ value: levels?.low52Week  ?? Math.min(...window.map(b => b.l)), color: C.low52,  title: '52W Low' })
    }

    // ── Trade levels and key structure (the "Levels" / אזור toggle) ──
    if (showLevels) {
      addLine({ value: decision?.support,    color: TRADER_COLORS.support,    title: 'S', width: 1.5, style: LineStyle.Solid })
      addLine({ value: decision?.resistance, color: TRADER_COLORS.resistance, title: 'R', width: 1.5, style: LineStyle.Solid })
      addLine({ value: decision?.invalidation ?? decision?.stopLoss, color: TRADER_COLORS.stopLoss,   title: 'SL', width: 1.8, style: LineStyle.Dashed })
      addLine({ value: decision?.takeProfit, color: TRADER_COLORS.takeProfit, title: 'TP', width: 1.8, style: LineStyle.Dashed })
      ;(technicalAnalysis?.keyLevels?.support ?? []).slice(0, 2)
        .forEach((value, i) => addLine({ value, color: 'rgba(6, 182, 212, 0.9)', title: `S${i + 2}` }))
      ;(technicalAnalysis?.keyLevels?.resistance ?? []).slice(0, 2)
        .forEach((value, i) => addLine({ value, color: 'rgba(249, 115, 22, 0.9)', title: `R${i + 2}` }))
      ;(technicalAnalysis?.keyLevels?.breakoutLevels ?? []).slice(0, 1)
        .forEach(value => addLine({ value, color: 'rgba(56, 189, 248, 0.9)', title: 'BO' }))
    }

    // ── Fibonacci ──
    // Anchored on the full series: this chart's zoom is chart-native, so there
    // is no "visible window" to anchor to the way PriceChart has.
    if (showFibonacci || showFibExtension) {
      const fib = computeFibonacci(ohlcv, showFibExtension)
      fib?.levels?.forEach(level => addLine({
        value: level.price,
        color: level.ratio === 0 || level.ratio === 1 ? 'rgba(148, 163, 184, 0.9)' : 'rgba(234, 179, 8, 0.75)',
        title: `FIB ${level.label}`,
        style: LineStyle.Dotted,
      }))
    }
  }, [
    chartEpoch, ohlcv, indicators,
    showPivotPoints, showPrevHighLow, showHighLow52,
    showLevels, showFibonacci, showFibExtension,
    decision, technicalAnalysis,
  ])

  // ── Zoom presets (kept — they're chart-native, not indicator toggles) ──
  const zoomLast = (barCount) => {
    if (!chartRef.current || !candles.length) return
    const to = candles[candles.length - 1].time
    const from = candles[Math.max(0, candles.length - barCount)].time
    chartRef.current.timeScale().setVisibleRange({ from, to })
  }
  const fitAll = () => chartRef.current?.timeScale().fitContent()

  return (
    <div style={{ position: 'relative' }}>
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

      {/* Zoom presets — the header controls handle indicators. */}
      <div style={{
        position: 'absolute', top: 8, insetInlineEnd: 8, zIndex: 5,
        display: 'flex', gap: 4,
      }}>
        {[
          { label: '1M', bars: 22 },
          { label: '3M', bars: 66 },
          { label: '6M', bars: 130 },
          { label: '1Y', bars: 252 },
        ].map(({ label, bars }) => (
          <button
            key={label}
            onClick={() => zoomLast(bars)}
            style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 600,
              background: 'rgba(11,15,25,0.6)', color: '#94a3b8',
              border: '1px solid #334155', borderRadius: 6, cursor: 'pointer',
            }}
          >{label}</button>
        ))}
        <button
          onClick={fitAll}
          style={{
            padding: '3px 9px', fontSize: 11, fontWeight: 600,
            background: 'rgba(11,15,25,0.6)', color: '#94a3b8',
            border: '1px solid #334155', borderRadius: 6, cursor: 'pointer',
          }}
        >All</button>
      </div>

      <div ref={containerRef} style={{ height, width: '100%' }} />
    </div>
  )
}
