import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import useStore from '../../store/useStore'
import { computeFibonacci, createCrosshairPlugin, formatTooltipDate, getChartPalette, getWindowBounds, isTrendlinePattern, labelsFromBars, OVERLAY_COLORS, patternBreakoutLevel, seriesFromBars, seriesFromIndicator } from './chartHelpers'
import { TRADER_COLORS } from '../../lib/traderColors'

const TV_GREEN = TRADER_COLORS.entry
const TV_RED = TRADER_COLORS.bearish
const CHART_FONT = "Heebo, Inter, system-ui, sans-serif"

const PATTERN_COLORS = {
  bullish: { stroke: TRADER_COLORS.bullish, fill: 'rgba(34, 197, 94, 0.08)' },
  bearish: { stroke: TRADER_COLORS.bearish, fill: 'rgba(239, 68, 68, 0.08)' },
  neutral: { stroke: TRADER_COLORS.neutral, fill: 'rgba(245, 158, 11, 0.08)' },
}

const GAP_COLORS = {
  open: { stroke: TRADER_COLORS.resistance, fill: 'rgba(249, 115, 22, 0.13)' },
  partial: { stroke: TRADER_COLORS.warning, fill: 'rgba(234, 179, 8, 0.12)' },
  closed: { stroke: '#64748b', fill: 'rgba(100, 116, 139, 0.08)' },
}


function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pixelForIndex(scale, index) {
  const byValue = scale.getPixelForValue(index)
  if (Number.isFinite(byValue)) return byValue
  const byTick = scale.getPixelForTick?.(index)
  return Number.isFinite(byTick) ? byTick : null
}

function formatOverlayPrice(value) {
  if (value == null || Number.isNaN(value)) return ''
  return value >= 100 ? value.toFixed(2) : value.toFixed(3)
}

function formatRangeDate(timestamp, interval) {
  const date = new Date(timestamp)
  const dateText = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })

  if (['1m', '5m', '15m', '1h', '4h'].includes(interval)) {
    const timeText = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${dateText} ${timeText}`
  }

  return dateText
}

function maxTicksForInterval(interval, count) {
  if (count <= 35) return Math.min(12, count)
  if (interval === '1y') return 12
  if (interval === '5y') return 10
  if (['1m', '5m', '15m', '1h', '4h'].includes(interval)) return 8
  return 10
}

function candleMetrics(xScale, count, chartArea) {
  const first = pixelForIndex(xScale, 0)
  const second = pixelForIndex(xScale, Math.min(1, Math.max(0, count - 1)))
  const fallbackSpacing = chartArea.width / Math.max(1, count)
  const spacing = Number.isFinite(first) && Number.isFinite(second) && Math.abs(second - first) > 0
    ? Math.abs(second - first)
    : fallbackSpacing

  return {
    spacing,
    width: clamp(spacing * 0.62, 2, 12),
  }
}

function pushRangeValues(values, source) {
  values.push(...(source ?? []).filter(value => value != null))
}

function buildPriceRange(ohlcv, indicators, overlays, targetPatterns, gaps, fibonacci, decision, demoLevels = []) {
  const values = []

  ohlcv?.forEach(bar => {
    if (bar?.h != null) values.push(bar.h)
    if (bar?.l != null) values.push(bar.l)
  })

  if (overlays.showSMA) {
    pushRangeValues(values, indicators?.sma20)
    pushRangeValues(values, indicators?.sma50)
    pushRangeValues(values, indicators?.sma100)
    pushRangeValues(values, indicators?.sma150)
    pushRangeValues(values, indicators?.sma200)
  }
  if (overlays.showEMA) {
    pushRangeValues(values, indicators?.ema9)
    pushRangeValues(values, indicators?.ema10)
    pushRangeValues(values, indicators?.ema20)
    pushRangeValues(values, indicators?.ema50)
    pushRangeValues(values, indicators?.ema200)
  }
  if (overlays.showWMA) {
    pushRangeValues(values, indicators?.wma20)
    pushRangeValues(values, indicators?.wma50)
  }
  if (overlays.showVWAP) pushRangeValues(values, indicators?.vwap)
  if (overlays.showSupertrend) pushRangeValues(values, indicators?.supertrend?.line)
  if (overlays.showBB) {
    pushRangeValues(values, indicators?.bb20?.upper)
    pushRangeValues(values, indicators?.bb20?.lower)
  }
  if (overlays.showKeltner) {
    pushRangeValues(values, indicators?.keltner?.upper)
    pushRangeValues(values, indicators?.keltner?.lower)
  }
  if (overlays.showDonchian) {
    pushRangeValues(values, indicators?.donchian?.upper)
    pushRangeValues(values, indicators?.donchian?.lower)
  }
  if (overlays.showIchimoku) {
    pushRangeValues(values, indicators?.ichimoku?.spanA)
    pushRangeValues(values, indicators?.ichimoku?.spanB)
  }

  const spot = ohlcv?.at(-1)?.c
  targetPatterns?.forEach(pattern => {
    const bullish = (pattern.direction ?? pattern.bias) !== 'bearish'
    const coherentTarget = Number.isFinite(pattern.targetPrice) && Number.isFinite(spot) && (
      bullish ? pattern.targetPrice > spot : pattern.targetPrice < spot
    )
    if (coherentTarget) values.push(pattern.targetPrice)
    const trigger = patternBreakoutLevel(pattern, spot)
    if (trigger != null) values.push(trigger)
    if (pattern.meta?.invalidationLevel != null) values.push(pattern.meta.invalidationLevel)
  })

  gaps?.forEach(gap => {
    if (gap.zoneLow != null) values.push(gap.zoneLow)
    if (gap.zoneHigh != null) values.push(gap.zoneHigh)
  })

  fibonacci?.levels?.forEach(level => values.push(level.price))

  if (overlays.showLevels) {
    ;[
      decision?.entryLow,
      decision?.entryHigh,
      decision?.invalidation,
      decision?.stopLoss,
      decision?.takeProfit,
      decision?.support,
      decision?.resistance,
    ].forEach(value => {
      if (value != null) values.push(value)
    })
  }

  demoLevels.forEach(level => {
    if (level?.price != null) values.push(level.price)
  })

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return {}

  const pad = Math.max((max - min) * 0.08, max * 0.005)
  return { min: min - pad, max: max + pad }
}

// Applies vertical zoom (priceScale) and pan (offsetPct) to the auto-fit
// price range. offsetPct is a normalized -1..1 fraction of how far to shift
// the (possibly zoomed-in) window toward the top/bottom of the full range.
// The shift is capped by how much smaller the zoomed window is than the
// full range, so panning can never move the visible window past the data
// it was computed from — zoomed out (priceScale >= 1) means no room to pan.
function applyPriceScale(range, priceScale = 1, offsetPct = 0) {
  if (range?.min == null || range?.max == null) return range
  if (priceScale === 1 && !offsetPct) return range

  const fullCenter = (range.min + range.max) / 2
  const fullHalf = (range.max - range.min) / 2
  const halfRange = fullHalf * priceScale
  const maxShift = Math.max(0, fullHalf - halfRange)
  const shift = clamp(offsetPct, -1, 1) * maxShift
  const center = fullCenter + shift

  return {
    min: center - halfRange,
    max: center + halfRange,
  }
}

function sliceIndicatorTree(value, startIndex, endIndex) {
  if (Array.isArray(value)) return value.slice(startIndex, endIndex)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, sliceIndicatorTree(child, startIndex, endIndex)]),
  )
}

function patternsForTargets(patternResult) {
  const patterns = patternResult?.patterns ?? []
  const bestKey = patternResult?.best?.key
  return patterns
    .filter(pattern => pattern.key === bestKey || ['near_breakout', 'broken_out'].includes(pattern.meta?.stage))
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))
    .slice(0, 3)
}

function normalizePatternsForView(patternResult, viewStart, viewEnd) {
  const patterns = (patternResult?.patterns ?? [])
    .filter(pattern => pattern.visual?.endIndex >= viewStart && pattern.visual?.startIndex <= viewEnd)
    .map(pattern => {
      const visual = pattern.visual
      const startIndex = clamp(visual.startIndex, viewStart, viewEnd) - viewStart
      const endIndex = clamp(visual.endIndex, viewStart, viewEnd) - viewStart

      return {
        ...pattern,
        visual: {
          ...visual,
          startIndex,
          endIndex,
          points: (visual.points ?? [])
            .filter(point => point.index >= viewStart && point.index <= viewEnd)
            .map(point => ({ ...point, index: point.index - viewStart })),
          lines: (visual.lines ?? [])
            .filter(line =>
              line.from.index >= viewStart &&
              line.from.index <= viewEnd &&
              line.to.index >= viewStart &&
              line.to.index <= viewEnd
            )
            .map(line => ({
              from: { ...line.from, index: line.from.index - viewStart },
              to: { ...line.to, index: line.to.index - viewStart },
            })),
        },
      }
    })

  return {
    patterns,
    score: patternResult?.score ?? 0,
    best: patterns.find(pattern => pattern.key === patternResult?.best?.key) ?? patterns[0] ?? null,
  }
}


function normalizeGapsForView(gapResult, viewStart, viewEnd) {
  return (gapResult?.gaps ?? [])
    .filter(gap => gap.index <= viewEnd && (gap.endIndex ?? viewEnd) >= viewStart)
    .map(gap => {
      const rawEnd = gap.status === 'closed' ? (gap.fillIndex ?? gap.endIndex) : viewEnd

      return {
        ...gap,
        startIndex: clamp(gap.index, viewStart, viewEnd) - viewStart,
        endIndex: clamp(rawEnd, viewStart, viewEnd) - viewStart,
      }
    })
    .sort((a, b) => b.index - a.index)
    .slice(0, 10)
}


function tradingViewXAxis(theme, maxTicksLimit = 10, isMobileViewport = false) {
  const palette = getChartPalette(theme)
  return {
    type: 'category',
    ticks: {
      color: palette.tick,
      maxRotation: isMobileViewport ? 45 : 0,
      minRotation: isMobileViewport ? 45 : 0,
      autoSkip: true,
      maxTicksLimit,
      font: { size: isMobileViewport ? 10 : 12 },
    },
    grid: { color: palette.grid, drawTicks: false },
    border: { color: palette.border },
  }
}

function tradingViewYAxis(theme, range, isMobileViewport = false) {
  const palette = getChartPalette(theme)
  return {
    position: 'right',
    min: range.min,
    max: range.max,
    ticks: {
      color: palette.tick,
      padding: 8,
      callback: value => Number(value).toFixed(Number(value) >= 100 ? 2 : 3),
      font: { size: isMobileViewport ? 10 : 12 },
    },
    grid: { color: palette.grid, drawTicks: false },
    border: { color: palette.border },
  }
}

function drawLabel(ctx, text, x, y, color) {
  ctx.save()
  ctx.font = `800 12px ${CHART_FONT}`
  ctx.textBaseline = 'middle'
  const paddingX = 8
  const width = ctx.measureText(text).width + paddingX * 2
  const height = 22
  const radius = 5

  ctx.shadowColor = 'rgba(2, 6, 23, 0.35)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  ctx.fillStyle = 'rgba(15, 23, 42, 0.96)'
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, x + paddingX, y + height / 2)
  ctx.restore()
}

function drawPriceTag(ctx, text, x, y, color, chartArea) {
  ctx.font = `700 11px ${CHART_FONT}`
  const height = 20
  const width = ctx.measureText(text).width + 10
  const tagY = clamp(y - height / 2, chartArea.top + 2, chartArea.bottom - height - 2)

  ctx.fillStyle = color
  ctx.fillRect(x, tagY, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, x + 5, tagY + 14)
}

function drawMeasurementBubble(ctx, text, x, y, chartArea) {
  ctx.save()
  ctx.font = `800 12px ${CHART_FONT}`
  ctx.textBaseline = 'middle'
  const paddingX = 9
  const width = ctx.measureText(text).width + paddingX * 2
  const height = 24
  const safeX = clamp(x - width / 2, chartArea.left + 4, chartArea.right - width - 4)
  const safeY = clamp(y - height - 12, chartArea.top + 4, chartArea.bottom - height - 4)

  ctx.shadowColor = 'rgba(2, 6, 23, 0.35)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 2
  ctx.fillStyle = 'rgba(15, 23, 42, 0.96)'
  ctx.beginPath()
  ctx.roundRect(safeX, safeY, width, height, 6)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, safeX + paddingX, safeY + height / 2)
  ctx.restore()
}

function drawPatternLine(ctx, xScale, yScale, line, color, chartArea) {
  const x1 = pixelForIndex(xScale, line.from.index)
  const x2 = pixelForIndex(xScale, line.to.index)
  const y1 = yScale.getPixelForValue(line.from.price)
  const y2 = yScale.getPixelForValue(line.to.price)
  if (![x1, x2, y1, y2].every(Number.isFinite)) return

  ctx.beginPath()
  ctx.moveTo(Math.max(chartArea.left, Math.min(chartArea.right, x1)), y1)
  ctx.lineTo(Math.max(chartArea.left, Math.min(chartArea.right, x2)), y2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function createChartBackgroundPlugin(theme) {
  return {
    id: 'chartBackground',
    beforeDraw(chart) {
      const palette = getChartPalette(theme)
      const { ctx, width, height } = chart
      ctx.save()
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, palette.panelTop)
      gradient.addColorStop(1, palette.panelBottom)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    },
  }
}

const volumeOverlayPlugin = {
  id: 'volumeOverlay',
  beforeDatasetsDraw(chart, _args, options) {
    if (!options?.show || !options?.bars?.length) return

    const { ctx, chartArea, scales } = chart
    const bars = options.bars
    const maxVolume = Math.max(...bars.map(bar => bar.v ?? 0))
    if (!maxVolume) return

    const { width } = candleMetrics(scales.x, bars.length, chartArea)
    const volumeHeight = chartArea.height * 0.24
    const volumeBottom = chartArea.bottom

    ctx.save()
    bars.forEach((bar, index) => {
      const x = pixelForIndex(scales.x, index)
      if (!Number.isFinite(x)) return

      const barHeight = Math.max(1, ((bar.v ?? 0) / maxVolume) * volumeHeight)
      const bullish = bar.c >= bar.o
      ctx.fillStyle = bullish ? 'rgba(8, 153, 129, 0.32)' : 'rgba(242, 54, 69, 0.32)'
      ctx.fillRect(x - width / 2, volumeBottom - barHeight, width, barHeight)
    })
    ctx.restore()
  },
}

const gapOverlayPlugin = {
  id: 'gapOverlay',
  afterDatasetsDraw(chart, _args, options) {
    const gaps = options?.gaps ?? []
    if (!gaps.length) return

    const { ctx, chartArea, scales } = chart

    ctx.save()
    gaps.forEach(gap => {
      const colors = GAP_COLORS[gap.status] ?? GAP_COLORS.open
      const x1 = pixelForIndex(scales.x, gap.startIndex)
      const x2 = gap.status === 'closed'
        ? pixelForIndex(scales.x, gap.endIndex)
        : chartArea.right
      const yTop = scales.y.getPixelForValue(gap.zoneHigh)
      const yBottom = scales.y.getPixelForValue(gap.zoneLow)

      if (![x1, x2, yTop, yBottom].every(Number.isFinite)) return

      const left = Math.max(chartArea.left, Math.min(x1, x2))
      const right = Math.min(chartArea.right, Math.max(x1, x2))
      const top = Math.max(chartArea.top, Math.min(yTop, yBottom))
      const bottom = Math.min(chartArea.bottom, Math.max(yTop, yBottom))
      const height = Math.max(2, bottom - top)
      const width = Math.max(4, right - left)
      const statusText = gap.status === 'closed'
        ? 'נסגר'
        : gap.status === 'partial'
          ? `חלקי ${gap.fillPct}%`
          : 'פתוח'
      const directionText = gap.direction === 'up' ? 'גאפ עולה' : 'גאפ יורד'

      ctx.fillStyle = colors.fill
      ctx.strokeStyle = colors.stroke
      ctx.lineWidth = gap.status === 'open' ? 1.6 : 1
      ctx.setLineDash(gap.status === 'open' ? [6, 4] : [])
      ctx.fillRect(left, top, width, height)
      ctx.strokeRect(left, top, width, height)

      ctx.beginPath()
      ctx.moveTo(left, top)
      ctx.lineTo(right, top)
      ctx.moveTo(left, bottom)
      ctx.lineTo(right, bottom)
      ctx.stroke()
      ctx.setLineDash([])

      if (right - left > 54 && bottom - top > 5) {
        drawLabel(ctx, `${directionText} ${statusText}`, Math.min(right - 112, left + 6), Math.max(chartArea.top + 4, top - 20), colors.stroke)
      }
    })
    ctx.restore()
  },
}

const candlestickPlugin = {
  id: 'candlestickOverlay',
  beforeDatasetsDraw(chart, _args, options) {
    if (!options?.show || !options?.bars?.length) return

    const { ctx, chartArea, scales } = chart
    const bars = options.bars
    const { width } = candleMetrics(scales.x, bars.length, chartArea)

    ctx.save()
    ctx.lineWidth = clamp(width * 0.18, 1, 1.6)

    bars.forEach((bar, index) => {
      const x = pixelForIndex(scales.x, index)
      if (!Number.isFinite(x)) return

      const openY = scales.y.getPixelForValue(bar.o)
      const closeY = scales.y.getPixelForValue(bar.c)
      const highY = scales.y.getPixelForValue(bar.h)
      const lowY = scales.y.getPixelForValue(bar.l)
      if (![openY, closeY, highY, lowY].every(Number.isFinite)) return

      const bullish = bar.c >= bar.o
      const color = bullish ? TV_GREEN : TV_RED
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.max(1, Math.abs(closeY - openY))

      ctx.strokeStyle = color
      ctx.fillStyle = color

      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      ctx.fillRect(x - width / 2, bodyTop, width, bodyHeight)
    })

    ctx.restore()
  },
}

const patternOverlayPlugin = {
  id: 'patternOverlay',
  afterDatasetsDraw(chart, _args, options) {
    const allPatterns = (options?.patterns ?? []).filter(pattern => pattern?.visual)
    const patterns = allPatterns
      .filter(pattern => pattern.category !== 'Candlestick')
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 3)
    const candleMarkers = allPatterns
      .filter(pattern => pattern.category === 'Candlestick')
      .sort((a, b) => (b.visual?.endIndex ?? 0) - (a.visual?.endIndex ?? 0))
      .slice(0, 10)
      .sort((a, b) => (a.visual?.endIndex ?? 0) - (b.visual?.endIndex ?? 0))

    if (!patterns.length && !candleMarkers.length) return

    const { ctx, chartArea, scales } = chart
    const xScale = scales.x
    const yScale = scales.y

    patterns.forEach((pattern, index) => {
      const visual = pattern.visual
      const color = PATTERN_COLORS[pattern.direction] ?? PATTERN_COLORS.neutral
      const x1 = pixelForIndex(xScale, visual.startIndex)
      const x2 = pixelForIndex(xScale, visual.endIndex)
      const y1 = yScale.getPixelForValue(visual.high)
      const y2 = yScale.getPixelForValue(visual.low)

      if (![x1, x2, y1, y2].every(Number.isFinite)) return

      const left = Math.max(chartArea.left, Math.min(x1, x2))
      const right = Math.min(chartArea.right, Math.max(x1, x2))
      const top = Math.max(chartArea.top, Math.min(y1, y2))
      const bottom = Math.min(chartArea.bottom, Math.max(y1, y2))
      const width = Math.max(8, right - left)
      const height = Math.max(8, bottom - top)
      const isBest = options?.bestKey === pattern.key

      ctx.save()
      ctx.fillStyle = color.fill
      ctx.strokeStyle = color.stroke
      ctx.lineWidth = isBest ? 2 : 1
      ctx.setLineDash(pattern.status === 'developing' ? [6, 4] : [])
      ctx.fillRect(left, top, width, height)
      ctx.strokeRect(left, top, width, height)
      ctx.setLineDash([])

      visual.lines?.forEach(line => drawPatternLine(ctx, xScale, yScale, line, color.stroke, chartArea))

      visual.points?.forEach(point => {
        const pointX = pixelForIndex(xScale, point.index)
        const pointY = yScale.getPixelForValue(point.price)
        if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return

        ctx.beginPath()
        ctx.arc(pointX, pointY, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = color.stroke
        ctx.fill()
        ctx.strokeStyle = '#020617'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      const labelX = Math.min(chartArea.right - 170, left + 6)
      const labelY = Math.max(chartArea.top + 4, top + 6 + index * 20)
      const statusLabel = pattern.status === 'confirmed' ? 'confirmed' : 'developing'
      drawLabel(ctx, `${pattern.label} · ${statusLabel}`, labelX, labelY, color.stroke)

      if (pattern.targetPrice != null) {
        const targetY = yScale.getPixelForValue(pattern.targetPrice)
        if (Number.isFinite(targetY) && targetY >= chartArea.top && targetY <= chartArea.bottom) {
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.moveTo(Math.max(left, chartArea.left), targetY)
          ctx.lineTo(chartArea.right, targetY)
          ctx.strokeStyle = color.stroke
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.setLineDash([])
          drawLabel(ctx, `יעד ${formatOverlayPrice(pattern.targetPrice)}`, Math.max(left + 8, chartArea.right - 112), targetY - 22, color.stroke)
        }
      }

      ctx.restore()
    })

    candleMarkers.forEach((pattern, index) => {
      const visual = pattern.visual
      const x = pixelForIndex(xScale, visual.endIndex)
      const bullish = pattern.direction === 'bullish'
      const bearish = pattern.direction === 'bearish'
      const color = bullish ? '#10b981' : bearish ? '#ef4444' : '#f59e0b'
      const edgePrice = bullish ? visual.low : visual.high
      const edgeY = yScale.getPixelForValue(edgePrice)
      if (!Number.isFinite(x) || !Number.isFinite(edgeY)) return

      const y = clamp(edgeY + (bullish ? 14 : -14), chartArea.top + 12, chartArea.bottom - 12)
      ctx.save()
      ctx.fillStyle = color
      ctx.strokeStyle = '#020617'
      ctx.lineWidth = 1
      ctx.beginPath()
      if (bullish) {
        ctx.moveTo(x, y - 6)
        ctx.lineTo(x - 5, y + 4)
        ctx.lineTo(x + 5, y + 4)
      } else if (bearish) {
        ctx.moveTo(x, y + 6)
        ctx.lineTo(x - 5, y - 4)
        ctx.lineTo(x + 5, y - 4)
      } else {
        ctx.arc(x, y, 4.5, 0, Math.PI * 2)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Alternate labels around adjacent markers so several signals on nearby
      // candles remain readable instead of painting over one another.
      const labelX = clamp(x - 56, chartArea.left + 4, chartArea.right - 124)
      const labelY = clamp(y + (bullish ? 9 : -29) + (index % 2) * (bullish ? 16 : -16), chartArea.top + 3, chartArea.bottom - 23)
      drawLabel(ctx, pattern.label ?? pattern.key, labelX, labelY, color)
      ctx.restore()
    })
  },
}

const fibonacciPlugin = {
  id: 'fibonacciOverlay',
  afterDatasetsDraw(chart, _args, options) {
    const fibonacci = options?.fibonacci
    if (!fibonacci?.levels?.length) return

    const { ctx, chartArea, scales } = chart
    const anchorAX = pixelForIndex(scales.x, fibonacci.anchorA.index)
    const anchorAY = scales.y.getPixelForValue(fibonacci.anchorA.price)
    const anchorBX = pixelForIndex(scales.x, fibonacci.anchorB.index)
    const anchorBY = scales.y.getPixelForValue(fibonacci.anchorB.price)

    ctx.save()

    if ([anchorAX, anchorAY, anchorBX, anchorBY].every(Number.isFinite)) {
      ctx.beginPath()
      ctx.moveTo(anchorAX, anchorAY)
      ctx.lineTo(anchorBX, anchorBY)
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.65)'
      ctx.lineWidth = 1.4
      ctx.stroke()

      ;[
        { x: anchorAX, y: anchorAY },
        { x: anchorBX, y: anchorBY },
      ].forEach(point => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#2563eb'
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      })
    }

    fibonacci.levels.forEach(level => {
      const y = scales.y.getPixelForValue(level.price)
      if (!Number.isFinite(y) || y < chartArea.top || y > chartArea.bottom) return

      const isMajor = level.ratio === 0 || level.ratio === 0.5 || level.ratio === 0.618 || level.ratio === 1
      ctx.beginPath()
      ctx.moveTo(chartArea.left, y)
      ctx.lineTo(chartArea.right, y)
      ctx.strokeStyle = isMajor ? 'rgba(37, 99, 235, 0.82)' : 'rgba(37, 99, 235, 0.48)'
      ctx.lineWidth = isMajor ? 1.2 : 1
      ctx.setLineDash(isMajor ? [] : [4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      drawLabel(
        ctx,
        `${level.label} ${formatOverlayPrice(level.price)}`,
        chartArea.left + 8,
        clamp(y - 9, chartArea.top + 2, chartArea.bottom - 20),
        '#2563eb',
      )
    })

    drawLabel(
      ctx,
      fibonacci.trend === 'up' ? 'FIB עלייה' : 'FIB ירידה',
      Math.max(chartArea.left + 8, Math.min(anchorAX ?? chartArea.left, anchorBX ?? chartArea.left)),
      chartArea.bottom - 28,
      '#2563eb',
    )

    ctx.restore()
  },
}

const priceLevelsPlugin = {
  id: 'priceLevels',
  afterDatasetsDraw(chart, _args, options) {
    const levels = options?.levels ?? []
    if (!levels.length) return

    const { ctx, chartArea, scales } = chart
    ctx.save()
    levels.forEach(level => {
      if (level?.price == null) return
      const y = scales.y.getPixelForValue(level.price)
      if (!Number.isFinite(y) || y < chartArea.top || y > chartArea.bottom) return

      ctx.beginPath()
      ctx.moveTo(chartArea.left, y)
      ctx.lineTo(chartArea.right, y)
      ctx.strokeStyle = level.color
      ctx.lineWidth = level.width ?? 1.2
      ctx.setLineDash(level.dash ?? [])
      ctx.stroke()
      ctx.setLineDash([])
      const label = level.label ? `${level.label} ${formatOverlayPrice(level.price)}` : formatOverlayPrice(level.price)
      drawPriceTag(ctx, label, chartArea.right + 4, y, level.color, chartArea)
    })
    ctx.restore()
  },
}

const demoTradingPlugin = {
  id: 'demoTrading',
  afterDatasetsDraw(chart, _args, options) {
    const levels = options?.levels ?? []
    if (!levels.length) return

    const { ctx, chartArea, scales } = chart
    ctx.save()
    levels.forEach((level, index) => {
      if (level?.price == null) return
      const y = scales.y.getPixelForValue(level.price)
      if (!Number.isFinite(y) || y < chartArea.top || y > chartArea.bottom) return

      ctx.beginPath()
      ctx.moveTo(chartArea.left, y)
      ctx.lineTo(chartArea.right, y)
      ctx.strokeStyle = level.color
      ctx.lineWidth = level.width ?? 1.4
      ctx.setLineDash(level.dash ?? [4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      const labelY = clamp(y - 10 - (index % 2) * 24, chartArea.top + 4, chartArea.bottom - 24)
      drawLabel(ctx, level.label, chartArea.left + 12, labelY, level.color)
    })
    ctx.restore()
  },
}

const zoneOverlayPlugin = {
  id: 'zoneOverlay',
  beforeDatasetsDraw(chart, _args, options) {
    const zones = options?.zones ?? []
    if (!zones.length) return

    const { ctx, chartArea, scales } = chart
    ctx.save()
    zones.forEach(zone => {
      if (zone?.low == null || zone?.high == null) return
      const yTop = scales.y.getPixelForValue(zone.high)
      const yBottom = scales.y.getPixelForValue(zone.low)
      if (![yTop, yBottom].every(Number.isFinite)) return

      const top = Math.max(chartArea.top, Math.min(yTop, yBottom))
      const bottom = Math.min(chartArea.bottom, Math.max(yTop, yBottom))
      const height = Math.max(2, bottom - top)

      ctx.fillStyle = zone.fill
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, height)

      ctx.beginPath()
      ctx.moveTo(chartArea.left, top)
      ctx.lineTo(chartArea.right, top)
      ctx.moveTo(chartArea.left, bottom)
      ctx.lineTo(chartArea.right, bottom)
      ctx.strokeStyle = zone.stroke
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])

      drawLabel(ctx, zone.label, chartArea.left + 10, clamp(top + 6, chartArea.top + 4, chartArea.bottom - 24), zone.stroke)
    })
    ctx.restore()
  },
}

const currentPricePlugin = {
  id: 'currentPriceLine',
  afterDraw(chart, _args, options) {
    if (options?.price == null) return

    const { ctx, chartArea, scales } = chart
    const y = scales.y.getPixelForValue(options.price)
    if (!Number.isFinite(y)) return

    const color = options.price >= (options.open ?? options.price) ? TV_GREEN : TV_RED
    const label = `${options.ticker ?? ''} ${formatOverlayPrice(options.price)}`.trim()

    ctx.save()
    ctx.setLineDash([1, 3])
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y)
    ctx.lineTo(chartArea.right, y)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
    drawPriceTag(ctx, label, chartArea.right + 4, y, color, chartArea)
    ctx.restore()
  },
}

const dateRangePlugin = {
  id: 'dateRangeLabel',
  afterDraw(chart, _args, options) {
    if (!options?.text) return

    const { ctx, chartArea } = chart
    ctx.save()
    ctx.font = `800 12px ${CHART_FONT}`
    const paddingX = 8
    const width = ctx.measureText(options.text).width + paddingX * 2
    const height = 22
    const x = chartArea.left + 8
    const y = chartArea.top + 8

    ctx.shadowColor = 'rgba(2, 6, 23, 0.25)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 5)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(options.text, x + paddingX, y + height / 2)
    ctx.restore()
  },
}

const measurementPlugin = {
  id: 'measurementOverlay',
  afterDraw(chart, _args, options) {
    if (!options?.enabled) return
    const measurement = options.stateRef?.current
    if (!measurement?.start || !measurement?.end) return

    const { ctx, chartArea, scales } = chart
    const start = measurement.start
    const end = measurement.end
    const startPrice = scales.y.getValueForPixel(start.y)
    const endPrice = scales.y.getValueForPixel(end.y)
    const pct = startPrice ? ((endPrice - startPrice) / startPrice) * 100 : 0
    const priceDiff = endPrice - startPrice
    const bars = Math.round(scales.x.getValueForPixel(end.x) - scales.x.getValueForPixel(start.x))
    const color = pct >= 0 ? '#22c55e' : '#ef4444'

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ;[start, end].forEach(point => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    const label = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% | ${priceDiff >= 0 ? '+' : ''}${formatOverlayPrice(priceDiff)} | ${Math.abs(bars)} bars`
    drawMeasurementBubble(ctx, label, end.x, end.y, chartArea)
    ctx.restore()
  },
}

const priceCrosshairPlugin = createCrosshairPlugin('priceCrosshair')

export default function PriceChart({
  ohlcv,
  indicators,
  showSMA,
  showEMA,
  showWMA = false,
  showBB,
  showVWAP,
  showSupertrend = false,
  showIchimoku = false,
  showKeltner = false,
  showDonchian = false,
  showPivotPoints = false,
  showPrevHighLow = false,
  showHighLow52 = false,
  chartType = 'line',
  patterns,
  gaps,
  showFibonacci = false,
  showFibExtension = false,
  showGaps = true,
  showPatterns = true,
  showTriangles = true,
  showTargets = true,
  showLevels = true,
  ticker,
  decision,
  demoAccount,
  language = 'en',
  technicalAnalysis,
  interval,
  visibleBars,
  viewOffset = 0,
  priceScale = 1,
  priceOffsetPct = 0,
  measurementEnabled = false,
  hoveredIndex = null,
  onHoverIndexChange,
  onPanBars,
  onPanPrice,
  resetToken = 0,
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const measurementRef = useRef({ active: false, start: null, end: null })
  const panRef = useRef({ active: false, startX: 0, startY: 0 })
  const { theme } = useStore()
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length) return
    if (!measurementEnabled) measurementRef.current = { active: false, start: null, end: null }
    const palette = getChartPalette(theme)

    const { start: viewStart, end: viewSliceEnd } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const viewEnd = viewSliceEnd - 1
    const visibleOhlcv = ohlcv.slice(viewStart, viewSliceEnd)
    const visibleIndicators = sliceIndicatorTree(indicators, viewStart, viewSliceEnd)
    const patternCandidates = [
      ...(patterns?.patterns ?? []),
      ...(showPatterns ? patterns?.markers ?? [] : []),
    ]
    const patternSource = [...new Map(patternCandidates
      .filter(pattern => (
        (showPatterns && !isTrendlinePattern(pattern)) || (showTriangles && isTrendlinePattern(pattern))
      ))
      .map(pattern => [`${pattern.key}:${pattern.visual?.endIndex}`, pattern])).values()]
    const filteredPatternResult = { ...patterns, patterns: patternSource }
    const visiblePatterns = patternSource.length ? normalizePatternsForView(filteredPatternResult, viewStart, viewEnd) : { patterns: [], score: 0, best: null }
    const targetPatterns = showTargets ? patternsForTargets(patterns) : []
    const visibleGaps = showGaps ? normalizeGapsForView(gaps, viewStart, viewEnd) : []
    const fibonacci = showFibonacci || showFibExtension ? computeFibonacci(visibleOhlcv, showFibExtension) : null
    const labels = labelsFromBars(visibleOhlcv, interval)
    const dateRangeText = visibleOhlcv.length
      ? `${formatRangeDate(visibleOhlcv[0].t, interval)} - ${formatRangeDate(visibleOhlcv[visibleOhlcv.length - 1].t, interval)}`
      : ''
    const datasets = []
    const isCandlestick = chartType === 'candlestick'
    const isArea = chartType === 'area'
    const lastBar = visibleOhlcv[visibleOhlcv.length - 1]
    const demoOverlayLevels = [
      ...((demoAccount?.pendingOrders ?? [])
        .filter(order => order.ticker === ticker)
        .map(order => ({
          price: order.entryPrice,
          color: order.side === 'short' ? 'rgba(248, 113, 113, 0.96)' : 'rgba(56, 189, 248, 0.96)',
          label: language === 'he'
            ? `${order.side === 'short' ? 'שורט' : 'לונג'} ${order.orderType === 'limit' ? 'לימיט' : 'סטופ'} ${formatOverlayPrice(order.entryPrice)}`
            : `${order.side === 'short' ? 'Short' : 'Long'} ${order.orderType === 'limit' ? 'limit' : 'stop'} ${formatOverlayPrice(order.entryPrice)}`,
          dash: order.orderType === 'limit' ? [3, 4] : [8, 4],
        }))),
      ...((demoAccount?.openPositions ?? [])
        .filter(position => position.ticker === ticker)
        .flatMap(position => ([
          {
            price: position.entryPrice,
            color: position.side === 'short' ? 'rgba(251, 146, 60, 0.96)' : 'rgba(16, 185, 129, 0.96)',
            label: language === 'he'
              ? `${position.side === 'short' ? 'שורט' : 'לונג'} כניסה ${formatOverlayPrice(position.entryPrice)}`
              : `${position.side === 'short' ? 'Short' : 'Long'} entry ${formatOverlayPrice(position.entryPrice)}`,
            dash: [],
            width: 1.8,
          },
          position.stopLoss != null
            ? {
                price: position.stopLoss,
                color: 'rgba(244, 63, 94, 0.96)',
                label: language === 'he' ? `סטופ ${formatOverlayPrice(position.stopLoss)}` : `Stop ${formatOverlayPrice(position.stopLoss)}`,
                dash: [6, 4],
              }
            : null,
          position.takeProfit != null
            ? {
                price: position.takeProfit,
                color: 'rgba(34, 197, 94, 0.96)',
                label: language === 'he' ? `יעד ${formatOverlayPrice(position.takeProfit)}` : `Target ${formatOverlayPrice(position.takeProfit)}`,
                dash: [6, 4],
              }
            : null,
        ].filter(Boolean)))),
      ...((demoAccount?.closedTrades ?? [])
        .filter(trade => trade.ticker === ticker)
        .slice(0, 3)
        .map(trade => ({
          price: trade.exitPrice,
          color: trade.realizedPnl >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(244, 63, 94, 0.75)',
          label: language === 'he'
            ? `סגירה ${formatOverlayPrice(trade.exitPrice)}`
            : `Close ${formatOverlayPrice(trade.exitPrice)}`,
          dash: [2, 6],
          width: 1,
        }))),
    ]

    const priceRange = applyPriceScale(buildPriceRange(visibleOhlcv, visibleIndicators, {
      showSMA,
      showEMA,
      showWMA,
      showBB,
      showSupertrend,
      showIchimoku,
      showKeltner,
      showDonchian,
      showVWAP,
      showLevels,
    }, targetPatterns, visibleGaps, fibonacci, decision, demoOverlayLevels), priceScale, priceOffsetPct)
    const breakoutLevel = technicalAnalysis?.keyLevels?.breakoutLevels?.[0] ?? null
    const invalidationLevel = technicalAnalysis?.riskAssessment?.stopLoss ?? technicalAnalysis?.keyLevels?.stopLossDangerZones?.[0] ?? null
    const zoneCandidates = [
      decision?.entryLow != null && decision?.entryHigh != null
        ? {
            low: decision.entryLow,
            high: decision.entryHigh,
            fill: 'rgba(16, 185, 129, 0.12)',
            stroke: 'rgba(16, 185, 129, 0.72)',
            label: language === 'he' ? 'אזור כניסה' : 'Entry zone',
          }
        : null,
      breakoutLevel != null
        ? {
            low: breakoutLevel * 0.997,
            high: breakoutLevel * 1.003,
            fill: 'rgba(56, 189, 248, 0.08)',
            stroke: 'rgba(56, 189, 248, 0.9)',
            label: 'Breakout zone',
          }
        : null,
      invalidationLevel != null
        ? {
            low: invalidationLevel * 0.994,
            high: invalidationLevel * 1.006,
            fill: 'rgba(244, 63, 94, 0.08)',
            stroke: 'rgba(244, 63, 94, 0.88)',
            label: 'Invalidation',
          }
        : null,
    ].filter(Boolean)
    const levelCandidates = (showLevels || showPivotPoints || showPrevHighLow || showHighLow52 || showTargets)
      ? [
          ...(showLevels ? [
            { price: decision?.support, color: TRADER_COLORS.support },
            { price: decision?.resistance, color: TRADER_COLORS.resistance },
            { price: decision?.invalidation ?? decision?.stopLoss, color: TRADER_COLORS.stopLoss, label: 'SL', dash: [5, 5], width: 1.8 },
            { price: decision?.takeProfit, color: TRADER_COLORS.takeProfit, label: 'TP', dash: [5, 5], width: 1.8 },
            ...((technicalAnalysis?.keyLevels?.support ?? []).slice(0, 2).map(price => ({ price, color: 'rgba(6, 182, 212, 0.9)' }))),
            ...((technicalAnalysis?.keyLevels?.resistance ?? []).slice(0, 2).map(price => ({ price, color: 'rgba(249, 115, 22, 0.9)' }))),
            ...((technicalAnalysis?.keyLevels?.breakoutLevels ?? []).slice(0, 1).map(price => ({ price, color: 'rgba(56, 189, 248, 0.9)' }))),
          ] : []),
          // Keep the complete P/R1-R3/S1-S3 ladder identical in both engines.
          ...(showPivotPoints && indicators?.pivotPoints ? [
            { price: indicators.pivotPoints.pivot, color: 'rgba(250, 204, 21, 0.9)' },
            { price: indicators.pivotPoints.r1, color: 'rgba(249, 115, 22, 0.82)' },
            { price: indicators.pivotPoints.r2, color: 'rgba(249, 115, 22, 0.62)' },
            { price: indicators.pivotPoints.r3, color: 'rgba(249, 115, 22, 0.44)' },
            { price: indicators.pivotPoints.s1, color: 'rgba(6, 182, 212, 0.82)' },
            { price: indicators.pivotPoints.s2, color: 'rgba(6, 182, 212, 0.62)' },
            { price: indicators.pivotPoints.s3, color: 'rgba(6, 182, 212, 0.44)' },
          ] : []),
          ...(showPrevHighLow && indicators?.priceLevels ? [
            { price: indicators.priceLevels.previousHigh, color: 'rgba(249, 115, 22, 0.82)' },
            { price: indicators.priceLevels.previousLow, color: 'rgba(6, 182, 212, 0.82)' },
          ] : []),
          ...(showHighLow52 && indicators?.priceLevels ? [
            { price: technicalAnalysis?.keyLevels?.high52Week ?? indicators.priceLevels.high52Week, color: 'rgba(244, 114, 182, 0.88)', label: '52W H' },
            { price: technicalAnalysis?.keyLevels?.low52Week ?? indicators.priceLevels.low52Week, color: 'rgba(129, 140, 248, 0.88)', label: '52W L' },
          ] : []),
          ...(showTargets ? targetPatterns.flatMap(pattern => {
            const spot = visibleOhlcv.at(-1)?.c
            const bullish = (pattern.direction ?? pattern.bias) !== 'bearish'
            const coherentTarget = Number.isFinite(pattern.targetPrice) && Number.isFinite(spot) && (
              bullish ? pattern.targetPrice > spot : pattern.targetPrice < spot
            )
            return [
              { price: patternBreakoutLevel(pattern, spot), color: '#38bdf8', label: 'Trigger', width: 1.5 },
              { price: coherentTarget ? pattern.targetPrice : null, color: bullish ? TRADER_COLORS.takeProfit : TRADER_COLORS.bearish, label: 'Target', dash: [6, 4], width: 1.7 },
              { price: pattern.meta?.invalidationLevel, color: TRADER_COLORS.stopLoss, label: 'SL', dash: [3, 4], width: 1.4 },
            ]
          }) : []),
        ].filter((level, index, levels) => level.price != null && levels.findIndex(item => item.price === level.price && item.color === level.color) === index)
      : []

    if (isCandlestick) {
      datasets.push({
        type: 'line',
        label: 'OHLC',
        data: seriesFromBars(visibleOhlcv, 'c'),
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0,
        yAxisID: 'y',
      })
    } else {
      datasets.push({
        type: 'line',
        label: 'Price',
        data: seriesFromBars(visibleOhlcv, 'c'),
        borderColor: isArea ? 'rgba(96, 165, 250, 0.95)' : '#60a5fa',
        backgroundColor: isArea ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
        fill: isArea,
        borderWidth: isArea ? 2.2 : 2,
        pointRadius: 0,
        tension: isArea ? 0.22 : 0.1,
        yAxisID: 'y',
      })
    }

    if (showSMA && visibleIndicators?.sma20) {
      ;[
        ['SMA 20', visibleIndicators.sma20, OVERLAY_COLORS.sma20, 1.6],
        ['SMA 50', visibleIndicators.sma50, OVERLAY_COLORS.sma50, 1.4],
        ['SMA 100', visibleIndicators.sma100, OVERLAY_COLORS.sma100, 1.1],
        ['SMA 150', visibleIndicators.sma150, OVERLAY_COLORS.sma150, 1.5],
        ['SMA 200', visibleIndicators.sma200, OVERLAY_COLORS.sma200, 1.4],
      ].forEach(([label, values, color, width]) => datasets.push({
        type: 'line',
        label,
        data: seriesFromIndicator(values),
        borderColor: color,
        borderWidth: width,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      }))
    }

    if (showEMA && visibleIndicators?.ema50) {
      if (visibleIndicators?.ema9) {
        datasets.push({
          type: 'line', label: 'EMA 9', data: seriesFromIndicator(visibleIndicators.ema9),
          borderColor: OVERLAY_COLORS.ema9, borderWidth: 1, pointRadius: 0, tension: 0.1, yAxisID: 'y',
        })
      }
      if (visibleIndicators?.ema10) {
        datasets.push({
          type: 'line', label: 'EMA 10', data: seriesFromIndicator(visibleIndicators.ema10),
          borderColor: OVERLAY_COLORS.ema10, borderWidth: 1, pointRadius: 0, tension: 0.1, yAxisID: 'y',
        })
      }
      if (visibleIndicators?.ema20) {
        datasets.push({
          type: 'line',
          label: 'EMA 20',
          data: seriesFromIndicator(visibleIndicators.ema20),
          borderColor: OVERLAY_COLORS.ema20,
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y',
        })
      }
      datasets.push({
        type: 'line',
        label: 'EMA 50',
        data: seriesFromIndicator(visibleIndicators.ema50),
        borderColor: OVERLAY_COLORS.ema50,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
      if (visibleIndicators?.ema200) {
        datasets.push({
          type: 'line',
          label: 'EMA 200',
          data: seriesFromIndicator(visibleIndicators.ema200),
          borderColor: OVERLAY_COLORS.ema200,
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y',
        })
      }
    }

    if (showWMA && visibleIndicators?.wma20) {
      datasets.push({
        type: 'line',
        label: 'WMA 20',
        data: seriesFromIndicator(visibleIndicators.wma20),
        borderColor: OVERLAY_COLORS.wma20,
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0.12,
        yAxisID: 'y',
      })
      if (visibleIndicators?.wma50) {
        datasets.push({
          type: 'line',
          label: 'WMA 50',
          data: seriesFromIndicator(visibleIndicators.wma50),
          borderColor: OVERLAY_COLORS.wma50,
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.12,
          yAxisID: 'y',
        })
      }
    }

    if (showBB && visibleIndicators?.bb20) {
      datasets.push({
        type: 'line',
        label: 'BB Upper',
        data: seriesFromIndicator(visibleIndicators.bb20.upper),
        borderColor: OVERLAY_COLORS.bbUpper,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
        fill: '+2',
        backgroundColor: CHART_COLORS.bbFill,
      })
      datasets.push({
        type: 'line',
        label: 'BB Middle',
        data: seriesFromIndicator(visibleIndicators.bb20.middle),
        borderColor: OVERLAY_COLORS.bbMiddle,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'BB Lower',
        data: seriesFromIndicator(visibleIndicators.bb20.lower),
        borderColor: OVERLAY_COLORS.bbLower,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
    }

    if (showKeltner && visibleIndicators?.keltner) {
      datasets.push({
        type: 'line',
        label: 'Keltner Upper',
        data: seriesFromIndicator(visibleIndicators.keltner.upper),
        borderColor: OVERLAY_COLORS.keltnerUpper,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Keltner Middle',
        data: seriesFromIndicator(visibleIndicators.keltner.middle),
        borderColor: OVERLAY_COLORS.keltnerMiddle,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Keltner Lower',
        data: seriesFromIndicator(visibleIndicators.keltner.lower),
        borderColor: OVERLAY_COLORS.keltnerLower,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
    }

    if (showDonchian && visibleIndicators?.donchian) {
      datasets.push({
        type: 'line',
        label: 'Donchian High',
        data: seriesFromIndicator(visibleIndicators.donchian.upper),
        borderColor: OVERLAY_COLORS.donchianUpper,
        borderDash: [7, 5],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Donchian Middle',
        data: seriesFromIndicator(visibleIndicators.donchian.middle),
        borderColor: OVERLAY_COLORS.donchianMiddle,
        borderDash: [3, 4],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Donchian Low',
        data: seriesFromIndicator(visibleIndicators.donchian.lower),
        borderColor: OVERLAY_COLORS.donchianLower,
        borderDash: [7, 5],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y',
      })
    }

    if (showIchimoku && visibleIndicators?.ichimoku) {
      datasets.push({
        type: 'line',
        label: 'Ichimoku Span A',
        data: seriesFromIndicator(visibleIndicators.ichimoku.spanA),
        borderColor: OVERLAY_COLORS.ichimokuSpanA,
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.08,
        fill: '+1',
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Ichimoku Span B',
        data: seriesFromIndicator(visibleIndicators.ichimoku.spanB),
        borderColor: OVERLAY_COLORS.ichimokuSpanB,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.08,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Tenkan',
        data: seriesFromIndicator(visibleIndicators.ichimoku.conversion),
        borderColor: OVERLAY_COLORS.ichimokuTenkan,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.08,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Kijun',
        data: seriesFromIndicator(visibleIndicators.ichimoku.base),
        borderColor: OVERLAY_COLORS.ichimokuKijun,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.08,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Chikou',
        data: seriesFromIndicator(visibleIndicators.ichimoku.laggingSpan),
        borderColor: OVERLAY_COLORS.ichimokuChikou,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.08,
        yAxisID: 'y',
      })
    }

    if (showVWAP && visibleIndicators?.vwap) {
      datasets.push({
        type: 'line',
        label: 'VWAP',
        data: seriesFromIndicator(visibleIndicators.vwap),
        borderColor: OVERLAY_COLORS.vwap,
        borderWidth: 1.3,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
    }

    if (showSupertrend && visibleIndicators?.supertrend?.line) {
      const bullishValues = visibleIndicators.supertrend.line.map((value, index) => (
        visibleIndicators.supertrend.direction?.[index] === 'bullish' ? value : null
      ))
      const bearishValues = visibleIndicators.supertrend.line.map((value, index) => (
        visibleIndicators.supertrend.direction?.[index] === 'bearish' ? value : null
      ))
      datasets.push({
        type: 'line',
        label: 'Supertrend bullish',
        data: seriesFromIndicator(bullishValues),
        borderColor: OVERLAY_COLORS.supertrendUp,
        borderWidth: 1.6,
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y',
      })
      datasets.push({
        type: 'line',
        label: 'Supertrend bearish',
        data: seriesFromIndicator(bearishValues),
        borderColor: OVERLAY_COLORS.supertrendDown,
        borderWidth: 1.6,
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y',
      })
    }

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            right: isMobileViewport ? 5 : 15,
            left: isMobileViewport ? 5 : 10,
            bottom: 10,
          },
        },
        interaction: { mode: 'index', intersect: false },
        onHover: (event, _elements, activeChart) => {
          if (!onHoverIndexChange || measurementEnabled) return
          const elements = activeChart.getElementsAtEventForMode(event, 'index', { intersect: false }, false)
          onHoverIndexChange(elements[0]?.index ?? null)
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            backgroundColor: palette.tooltipBg,
            borderColor: palette.tooltipBorder,
            borderWidth: 1,
            titleColor: palette.tooltipTitle,
            bodyColor: palette.tooltipBody,
            displayColors: true,
            padding: 12,
            callbacks: {
              title: items => {
                const bar = visibleOhlcv[items[0]?.dataIndex]
                return bar ? formatTooltipDate(bar.t, interval) : ''
              },
              label: context => {
                const bar = visibleOhlcv[context.dataIndex]
                if (isCandlestick && context.dataset.label === 'OHLC' && bar) {
                  const changePct = bar.o ? ((bar.c - bar.o) / bar.o) * 100 : 0
                  return [
                    `Open ${formatOverlayPrice(bar.o)}`,
                    `High ${formatOverlayPrice(bar.h)}`,
                    `Low ${formatOverlayPrice(bar.l)}`,
                    `Close ${formatOverlayPrice(bar.c)}`,
                    `Volume ${(bar.v ?? 0).toLocaleString('en-US')}`,
                    `Change ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
                  ]
                }
                return `${context.dataset.label}: ${formatOverlayPrice(context.parsed.y)}`
              },
            },
          },
          volumeOverlay: {
            show: false,
            bars: visibleOhlcv,
          },
          gapOverlay: {
            gaps: visibleGaps,
          },
          candlestickOverlay: {
            show: isCandlestick,
            bars: visibleOhlcv,
          },
          patternOverlay: {
            patterns: visiblePatterns.patterns,
            bestKey: visiblePatterns.best?.key ?? null,
          },
          fibonacciOverlay: {
            fibonacci,
          },
          priceLevels: {
            levels: levelCandidates,
          },
          demoTrading: {
            levels: demoOverlayLevels,
          },
          zoneOverlay: {
            zones: showLevels ? zoneCandidates : [],
          },
          currentPriceLine: {
            price: lastBar?.c,
            open: lastBar?.o,
            ticker,
          },
          dateRangeLabel: {
            text: dateRangeText,
          },
          priceCrosshair: {
            index: hoveredIndex,
            theme,
          },
          measurementOverlay: {
            enabled: measurementEnabled,
            stateRef: measurementRef,
          },
        },
        scales: {
          x: tradingViewXAxis(theme, maxTicksForInterval(interval, visibleOhlcv.length), isMobileViewport),
          y: tradingViewYAxis(theme, priceRange, isMobileViewport),
        },
      },
      plugins: [
        createChartBackgroundPlugin(theme),
        gapOverlayPlugin,
        volumeOverlayPlugin,
        candlestickPlugin,
        patternOverlayPlugin,
        fibonacciPlugin,
        zoneOverlayPlugin,
        priceLevelsPlugin,
        demoTradingPlugin,
        currentPricePlugin,
        dateRangePlugin,
        priceCrosshairPlugin,
        measurementPlugin,
      ],
    })

    const canvas = canvasRef.current
    const chart = chartRef.current
    const pointFromEvent = event => {
      const rect = canvas.getBoundingClientRect()
      const chartArea = chart.chartArea
      return {
        x: clamp(event.clientX - rect.left, chartArea.left, chartArea.right),
        y: clamp(event.clientY - rect.top, chartArea.top, chartArea.bottom),
      }
    }

    // Dragging is split by where it starts, TradingView-style, so a single
    // gesture never moves both axes at once (which felt erratic): the
    // price-axis label strip on the right pans price vertically, the rest
    // of the chart pans time horizontally.
    const isOverPriceAxis = event => {
      const rect = canvas.getBoundingClientRect()
      const localX = event.clientX - rect.left
      return localX > (chart.chartArea?.right ?? Infinity)
    }

    const handlePointerDown = event => {
      if (measurementEnabled) {
        event.preventDefault()
        const point = pointFromEvent(event)
        measurementRef.current = { active: true, start: point, end: point }
        canvas.setPointerCapture?.(event.pointerId)
        chart.draw()
        return
      }

      if (event.button !== 0) return
      const axisMode = Boolean(onPanPrice) && isOverPriceAxis(event)
      if (axisMode) {
        event.preventDefault()
        panRef.current = { active: true, mode: 'price', startX: event.clientX, startY: event.clientY }
        canvas.setPointerCapture?.(event.pointerId)
        canvas.style.cursor = 'ns-resize'
        return
      }

      if (!onPanBars) return
      event.preventDefault()
      panRef.current = { active: true, mode: 'time', startX: event.clientX, startY: event.clientY }
      canvas.setPointerCapture?.(event.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const handlePointerMove = event => {
      if (measurementEnabled && measurementRef.current.active) {
        event.preventDefault()
        measurementRef.current.end = pointFromEvent(event)
        chart.draw()
        return
      }

      if (!panRef.current.active) {
        // Hover feedback so the price-axis drag target is discoverable
        // even though it has no visible border.
        if (!measurementEnabled && onPanPrice) {
          canvas.style.cursor = isOverPriceAxis(event) ? 'ns-resize' : (onPanBars ? 'grab' : '')
        }
        return
      }

      if (panRef.current.mode === 'price') {
        if (!onPanPrice) return
        const deltaY = event.clientY - panRef.current.startY
        const chartHeight = Math.max(chart.chartArea?.height ?? 1, 1)
        const priceDeltaPct = deltaY / chartHeight
        if (Math.abs(priceDeltaPct) > 0.002) {
          event.preventDefault()
          // Dragging down moves the view down (reveals lower prices), so
          // subtract: positive deltaY (drag down) -> negative offset shift.
          onPanPrice(-priceDeltaPct)
          panRef.current.startY = event.clientY
        }
        return
      }

      if (!onPanBars) return
      const deltaX = event.clientX - panRef.current.startX
      const chartWidth = Math.max(chart.chartArea?.width ?? 1, 1)
      const barsDelta = Math.round((deltaX / chartWidth) * visibleOhlcv.length)
      if (barsDelta !== 0) {
        event.preventDefault()
        onPanBars(barsDelta)
        panRef.current.startX = event.clientX
      }
    }

    const stopInteraction = event => {
      if (measurementEnabled && measurementRef.current.active) {
        measurementRef.current.active = false
        if (event?.clientX != null) measurementRef.current.end = pointFromEvent(event)
        canvas.releasePointerCapture?.(event.pointerId)
        chart.draw()
      }

      if (panRef.current.active) {
        panRef.current.active = false
        canvas.releasePointerCapture?.(event?.pointerId)
        canvas.style.cursor = measurementEnabled ? 'crosshair' : onPanBars ? 'grab' : ''
      }
    }

    if (measurementEnabled || onPanBars || onPanPrice) {
      canvas.style.cursor = measurementEnabled ? 'crosshair' : 'grab'
      canvas.addEventListener('pointerdown', handlePointerDown)
      canvas.addEventListener('pointermove', handlePointerMove)
      canvas.addEventListener('pointerup', stopInteraction)
      canvas.addEventListener('pointerleave', stopInteraction)
    } else {
      canvas.style.cursor = ''
    }

    return () => {
      canvas.style.cursor = ''
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', stopInteraction)
      canvas.removeEventListener('pointerleave', stopInteraction)
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [ohlcv, indicators, showSMA, showEMA, showWMA, showBB, showVWAP, showSupertrend, showIchimoku, showKeltner, showDonchian, showPivotPoints, showPrevHighLow, showHighLow52, chartType, patterns, gaps, showFibonacci, showFibExtension, showGaps, showPatterns, showTriangles, showTargets, showLevels, ticker, decision, demoAccount, language, technicalAnalysis, interval, visibleBars, viewOffset, priceScale, priceOffsetPct, measurementEnabled, hoveredIndex, onHoverIndexChange, onPanBars, onPanPrice, resetToken, theme, isMobileViewport])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
