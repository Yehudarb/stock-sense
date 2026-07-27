import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries,
  CrosshairMode, LineStyle,
} from 'lightweight-charts'
import useStore from '../../store/useStore'

// TradingView-quality chart. lightweight-charts is the actual library
// TradingView ships (open-sourced, MIT) so we get:
//   • Mouse-wheel zoom on the time axis
//   • Click-and-drag pan
//   • Crosshair with synchronized price / time readouts
//   • Right-side price axis with the current-price marker
//   • Volume histogram below, time-axis synced
//   • Overlays (SMA/EMA/BB) as native line/area series
//
// The old Chart.js-based PriceChart stays intact for now (~1600 lines, still
// used by parts of the app); this component is the modern replacement mounted
// side-by-side under a toggle.

const OVERLAY_COLORS = {
  sma20: '#f59e0b',
  sma50: '#3b82f6',
  sma200: '#a855f7',
  ema20: '#10b981',
  ema50: '#ef4444',
  bbUpper: '#94a3b8',
  bbLower: '#94a3b8',
  bbMid: '#64748b',
}

// Convert our OHLCV format {t, o, h, l, c, v} → the shape lightweight-charts
// expects: { time: unix_seconds, open, high, low, close } for candles and
// { time, value, color } for the volume histogram.
function toChartBars(ohlcv) {
  if (!Array.isArray(ohlcv)) return { candles: [], volume: [] }
  const candles = []
  const volume = []
  for (const bar of ohlcv) {
    if (!Number.isFinite(bar.c) || !Number.isFinite(bar.o)) continue
    const time = Math.floor((bar.t || 0) / 1000)
    if (!Number.isFinite(time) || time <= 0) continue
    candles.push({ time, open: bar.o, high: bar.h, low: bar.l, close: bar.c })
    volume.push({
      time,
      value: bar.v || 0,
      color: bar.c >= bar.o ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    })
  }
  return { candles, volume }
}

// Overlays get one point per bar with the indicator's value at that bar.
function toLineData(ohlcv, values) {
  if (!Array.isArray(ohlcv) || !Array.isArray(values)) return []
  const out = []
  for (let i = 0; i < Math.min(ohlcv.length, values.length); i += 1) {
    const v = values[i]
    if (v == null || !Number.isFinite(v)) continue
    const time = Math.floor((ohlcv[i].t || 0) / 1000)
    if (!Number.isFinite(time) || time <= 0) continue
    out.push({ time, value: v })
  }
  return out
}

// Toggle chip — small on/off pill for choosing which overlays to show.
function OverlayChip({ label, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        border: `1px solid ${active ? color : '#334155'}`,
        background: active ? color + '22' : 'transparent',
        color: active ? color : '#94a3b8',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        transition: 'all 100ms',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </button>
  )
}

export default function TradingViewChart({ ohlcv, indicators, height = 460 }) {
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const seriesRef     = useRef({}) // { candles, volume, sma20, sma50, sma200, ema50, bbUpper, bbLower, bbFill }
  const theme         = useStore(s => s.theme) || 'dark'
  const currentTicker = useStore(s => s.currentTicker)

  const [overlays, setOverlays] = useState({
    sma20: true,
    sma50: true,
    sma200: false,
    ema50: false,
    bb: false,
  })
  const [hovered, setHovered] = useState(null) // { open, high, low, close, time }

  const { candles, volume } = useMemo(() => toChartBars(ohlcv), [ohlcv])

  // Palette adapts to the dashboard theme so the chart matches the app.
  const palette = useMemo(() => (theme === 'light' ? {
    bg: '#ffffff', text: '#111827', grid: '#e5e7eb',
    axis: '#94a3b8', up: '#10b981', down: '#ef4444',
    wickUp: '#10b981', wickDown: '#ef4444',
  } : {
    bg: '#0b0f19', text: '#e5e7eb', grid: '#1f2937',
    axis: '#4b5563', up: '#10b981', down: '#ef4444',
    wickUp: '#34d399', wickDown: '#f87171',
  }), [theme])

  // Build the chart once; ResizeObserver keeps it fluid with the container.
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
      timeScale: {
        borderColor: palette.axis,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
      },
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.wickUp,
      wickDownColor: palette.wickDown,
      priceLineVisible: true,
      lastValueVisible: true,
    })
    seriesRef.current.candles = candleSeries

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#94a3b8',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    seriesRef.current.volume = volumeSeries

    // Crosshair-driven tooltip — shows the OHLC of the bar under the cursor.
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData?.size) { setHovered(null); return }
      const candleData = param.seriesData.get(candleSeries)
      if (!candleData) { setHovered(null); return }
      setHovered({
        time: param.time,
        open: candleData.open, high: candleData.high,
        low: candleData.low,   close: candleData.close,
      })
    })

    return () => { chart.remove(); chartRef.current = null; seriesRef.current = {} }
  // Rebuild on theme swap so palette applies cleanly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.bg])

  // Push candles + volume whenever the data changes.
  useEffect(() => {
    const { candles: c, volume: v } = seriesRef.current
    if (!c || !v) return
    c.setData(candles)
    v.setData(volume)
    // Fit content on first data load so the user sees the whole series.
    if (candles.length && !chartRef.current._fittedOnce) {
      chartRef.current.timeScale().fitContent()
      chartRef.current._fittedOnce = true
    }
  }, [candles, volume])

  // Reset the "fitted" flag when ticker changes so a fresh symbol re-fits.
  useEffect(() => {
    if (chartRef.current) chartRef.current._fittedOnce = false
  }, [currentTicker])

  // Overlay series — created lazily when their toggle is turned on, torn down
  // when off. Avoids paying for series that aren't being viewed.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ohlcv?.length) return

    const ensure = (key, factory) => {
      if (!seriesRef.current[key]) seriesRef.current[key] = factory()
      return seriesRef.current[key]
    }
    const remove = (key) => {
      if (seriesRef.current[key]) {
        try { chart.removeSeries(seriesRef.current[key]) } catch {}
        delete seriesRef.current[key]
      }
    }

    const applyLine = (key, values, color) => {
      if (!values) return
      const data = toLineData(ohlcv, values)
      if (!data.length) return
      const s = ensure(key, () => chart.addSeries(LineSeries, {
        color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
      }))
      s.setData(data)
    }

    if (overlays.sma20  && indicators?.sma20)  applyLine('sma20',  indicators.sma20,  OVERLAY_COLORS.sma20);   else remove('sma20')
    if (overlays.sma50  && indicators?.sma50)  applyLine('sma50',  indicators.sma50,  OVERLAY_COLORS.sma50);   else remove('sma50')
    if (overlays.sma200 && indicators?.sma200) applyLine('sma200', indicators.sma200, OVERLAY_COLORS.sma200);  else remove('sma200')
    if (overlays.ema50  && indicators?.ema50)  applyLine('ema50',  indicators.ema50,  OVERLAY_COLORS.ema50);   else remove('ema50')

    // Bollinger bands: two lines. Kept simple — no fill (cleaner readability).
    if (overlays.bb && indicators?.bb20) {
      applyLine('bbUpper', indicators.bb20.upper, OVERLAY_COLORS.bbUpper)
      applyLine('bbLower', indicators.bb20.lower, OVERLAY_COLORS.bbLower)
      applyLine('bbMid',   indicators.bb20.middle, OVERLAY_COLORS.bbMid)
    } else {
      remove('bbUpper'); remove('bbLower'); remove('bbMid')
    }
  }, [overlays, indicators, ohlcv])

  const toggleOverlay = (key) => setOverlays(o => ({ ...o, [key]: !o[key] }))

  // Time-scale presets — jump to N recent bars.
  const zoomLast = (barCount) => {
    if (!chartRef.current || !candles.length) return
    const to = candles[candles.length - 1].time
    const fromIndex = Math.max(0, candles.length - barCount)
    const from = candles[fromIndex].time
    chartRef.current.timeScale().setVisibleRange({ from, to })
  }
  const fitAll = () => chartRef.current?.timeScale().fitContent()

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Overlay + zoom controls */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        padding: '6px 0',
      }}>
        <OverlayChip label="SMA20"  color={OVERLAY_COLORS.sma20}  active={overlays.sma20}  onClick={() => toggleOverlay('sma20')} />
        <OverlayChip label="SMA50"  color={OVERLAY_COLORS.sma50}  active={overlays.sma50}  onClick={() => toggleOverlay('sma50')} />
        <OverlayChip label="SMA200" color={OVERLAY_COLORS.sma200} active={overlays.sma200} onClick={() => toggleOverlay('sma200')} />
        <OverlayChip label="EMA50"  color={OVERLAY_COLORS.ema50}  active={overlays.ema50}  onClick={() => toggleOverlay('ema50')} />
        <OverlayChip label="BB(20)" color={OVERLAY_COLORS.bbMid}  active={overlays.bb}     onClick={() => toggleOverlay('bb')} />

        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
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
                background: 'transparent', color: '#94a3b8',
                border: '1px solid #334155', borderRadius: 6, cursor: 'pointer',
              }}
            >{label}</button>
          ))}
          <button
            onClick={fitAll}
            style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 600,
              background: 'transparent', color: '#94a3b8',
              border: '1px solid #334155', borderRadius: 6, cursor: 'pointer',
            }}
          >All</button>
        </div>
      </div>

      {/* Floating OHLC readout — appears on crosshair hover */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 44, insetInlineStart: 8, zIndex: 5,
          background: 'rgba(11,15,25,0.85)', border: '1px solid #1f2937',
          borderRadius: 6, padding: '6px 10px', fontSize: 11,
          color: '#e5e7eb', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums',
          direction: 'ltr',
        }}>
          O <b>{hovered.open?.toFixed(2)}</b>{'  '}
          H <b style={{ color: '#10b981' }}>{hovered.high?.toFixed(2)}</b>{'  '}
          L <b style={{ color: '#ef4444' }}>{hovered.low?.toFixed(2)}</b>{'  '}
          C <b>{hovered.close?.toFixed(2)}</b>
        </div>
      )}

      <div ref={containerRef} style={{ height, width: '100%' }} />
    </div>
  )
}
