import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { labelsFromBars, seriesFromBars, seriesFromIndicator } from './chartHelpers'

const TV_GREEN = '#089981'
const TV_RED = '#f23645'
const TV_GRID = 'rgba(15, 23, 42, 0.08)'
const TV_TEXT = '#0f172a'

const PATTERN_COLORS = {
  bullish: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.08)' },
  bearish: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.08)' },
  neutral: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.08)' },
}

const GAP_COLORS = {
  open: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.13)' },
  partial: { stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.12)' },
  closed: { stroke: '#64748b', fill: 'rgba(100, 116, 139, 0.08)' },
}

const FIB_LEVELS = [
  { ratio: 0, label: '0%' },
  { ratio: 0.236, label: '23.6%' },
  { ratio: 0.382, label: '38.2%' },
  { ratio: 0.5, label: '50%' },
  { ratio: 0.618, label: '61.8%' },
  { ratio: 0.786, label: '78.6%' },
  { ratio: 1, label: '100%' },
]

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

function buildPriceRange(ohlcv, indicators, showSMA, showEMA, showBB, patterns, gaps, fibonacci) {
  const values = []

  ohlcv?.forEach(bar => {
    if (bar?.h != null) values.push(bar.h)
    if (bar?.l != null) values.push(bar.l)
  })

  if (showSMA) values.push(...(indicators?.sma20 ?? []).filter(value => value != null))
  if (showEMA) values.push(...(indicators?.ema50 ?? []).filter(value => value != null))
  if (showBB) {
    values.push(...(indicators?.bb20?.upper ?? []).filter(value => value != null))
    values.push(...(indicators?.bb20?.lower ?? []).filter(value => value != null))
  }

  patterns?.patterns?.forEach(pattern => {
    if (pattern.targetPrice != null) values.push(pattern.targetPrice)
  })

  gaps?.forEach(gap => {
    if (gap.zoneLow != null) values.push(gap.zoneLow)
    if (gap.zoneHigh != null) values.push(gap.zoneHigh)
  })

  fibonacci?.levels?.forEach(level => values.push(level.price))

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return {}

  const pad = Math.max((max - min) * 0.08, max * 0.005)
  return { min: min - pad, max: max + pad }
}

function sliceIndicatorTree(value, startIndex) {
  if (Array.isArray(value)) return value.slice(startIndex)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, sliceIndicatorTree(child, startIndex)]),
  )
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

function isTrianglePattern(pattern) {
  return pattern?.key?.includes('TRIANGLE') || pattern?.meta?.type
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

function computeFibonacci(ohlcv) {
  if (!ohlcv?.length || ohlcv.length < 5) return null

  const highPoint = ohlcv.reduce((best, bar, index) => (
    bar.h > best.price ? { index, price: bar.h } : best
  ), { index: 0, price: ohlcv[0].h })
  const lowPoint = ohlcv.reduce((best, bar, index) => (
    bar.l < best.price ? { index, price: bar.l } : best
  ), { index: 0, price: ohlcv[0].l })
  const range = highPoint.price - lowPoint.price

  if (!Number.isFinite(range) || range <= 0) return null

  const trend = lowPoint.index < highPoint.index ? 'up' : 'down'
  const levels = FIB_LEVELS.map(level => {
    const price = trend === 'up'
      ? highPoint.price - range * level.ratio
      : lowPoint.price + range * level.ratio

    return {
      ...level,
      price,
    }
  })

  return {
    trend,
    anchorA: trend === 'up' ? lowPoint : highPoint,
    anchorB: trend === 'up' ? highPoint : lowPoint,
    levels,
  }
}

function tradingViewXAxis(maxTicksLimit = 10) {
  return {
    type: 'category',
    ticks: {
      color: TV_TEXT,
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit,
      font: { size: 11 },
    },
    grid: { color: TV_GRID, drawTicks: false },
    border: { color: 'rgba(15, 23, 42, 0.12)' },
  }
}

function tradingViewYAxis(range) {
  return {
    position: 'right',
    min: range.min,
    max: range.max,
    ticks: {
      color: TV_TEXT,
      padding: 8,
      callback: value => Number(value).toFixed(Number(value) >= 100 ? 2 : 3),
      font: { size: 11 },
    },
    grid: { color: TV_GRID, drawTicks: false },
    border: { color: 'rgba(15, 23, 42, 0.12)' },
  }
}

function drawLabel(ctx, text, x, y, color) {
  ctx.font = '600 11px Arial'
  const paddingX = 6
  const paddingY = 4
  const width = ctx.measureText(text).width + paddingX * 2
  const height = 18

  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, height)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText(text, x + paddingX, y + height - paddingY)
}

function drawPriceTag(ctx, text, x, y, color, chartArea) {
  ctx.font = '700 11px Arial'
  const height = 20
  const width = ctx.measureText(text).width + 10
  const tagY = clamp(y - height / 2, chartArea.top + 2, chartArea.bottom - height - 2)

  ctx.fillStyle = color
  ctx.fillRect(x, tagY, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, x + 5, tagY + 14)
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

const chartBackgroundPlugin = {
  id: 'chartBackground',
  beforeDraw(chart) {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
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
  beforeDatasetsDraw(chart, _args, options) {
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
    const patterns = (options?.patterns ?? [])
      .filter(pattern => pattern?.visual)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 3)

    if (!patterns.length) return

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

      const labelX = Math.min(chartArea.right - 140, left + 6)
      const labelY = Math.max(chartArea.top + 4, top + 6 + index * 20)
      drawLabel(ctx, pattern.label, labelX, labelY, color.stroke)

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
      ctx.lineWidth = 1.2
      ctx.stroke()
      drawPriceTag(ctx, formatOverlayPrice(level.price), chartArea.right + 4, y, level.color, chartArea)
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
    ctx.font = '600 11px Arial'
    const paddingX = 8
    const width = ctx.measureText(options.text).width + paddingX * 2
    const height = 20
    const x = chartArea.left + 8
    const y = chartArea.top + 8

    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.10)'
    ctx.strokeRect(x, y, width, height)
    ctx.fillStyle = '#334155'
    ctx.fillText(options.text, x + paddingX, y + 14)
    ctx.restore()
  },
}

export default function PriceChart({
  ohlcv,
  indicators,
  showSMA,
  showEMA,
  showBB,
  chartType = 'line',
  patterns,
  gaps,
  showFibonacci = false,
  showGaps = true,
  showPatterns = true,
  showTriangles = true,
  showLevels = true,
  ticker,
  decision,
  interval,
  visibleBars,
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length) return

    const viewSize = Math.min(ohlcv.length, Math.max(20, visibleBars ?? ohlcv.length))
    const viewStart = Math.max(0, ohlcv.length - viewSize)
    const viewEnd = ohlcv.length - 1
    const visibleOhlcv = ohlcv.slice(viewStart)
    const visibleIndicators = sliceIndicatorTree(indicators, viewStart)
    const patternSource = patterns?.patterns?.filter(pattern => (
      (showPatterns && !isTrianglePattern(pattern)) || (showTriangles && isTrianglePattern(pattern))
    )) ?? []
    const filteredPatternResult = { ...patterns, patterns: patternSource }
    const visiblePatterns = patternSource.length ? normalizePatternsForView(filteredPatternResult, viewStart, viewEnd) : { patterns: [], score: 0, best: null }
    const visibleGaps = showGaps ? normalizeGapsForView(gaps, viewStart, viewEnd) : []
    const fibonacci = showFibonacci ? computeFibonacci(visibleOhlcv) : null
    const labels = labelsFromBars(visibleOhlcv, interval)
    const dateRangeText = visibleOhlcv.length
      ? `${formatRangeDate(visibleOhlcv[0].t, interval)} - ${formatRangeDate(visibleOhlcv[visibleOhlcv.length - 1].t, interval)}`
      : ''
    const datasets = []
    const isCandlestick = chartType === 'candlestick'
    const lastBar = visibleOhlcv[visibleOhlcv.length - 1]
    const priceRange = buildPriceRange(visibleOhlcv, visibleIndicators, showSMA, showEMA, showBB, visiblePatterns, visibleGaps, fibonacci)
    const levelCandidates = showLevels
      ? [
          { price: decision?.support, color: '#f23645' },
          { price: decision?.resistance, color: '#f23645' },
        ].filter(level => level.price != null)
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
        borderColor: CHART_COLORS.price,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
    }

    if (showSMA && visibleIndicators?.sma20) {
      datasets.push({
        type: 'line',
        label: 'SMA 20',
        data: seriesFromIndicator(visibleIndicators.sma20),
        borderColor: CHART_COLORS.sma20,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
    }

    if (showEMA && visibleIndicators?.ema50) {
      datasets.push({
        type: 'line',
        label: 'EMA 50',
        data: seriesFromIndicator(visibleIndicators.ema50),
        borderColor: CHART_COLORS.ema50,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      })
    }

    if (showBB && visibleIndicators?.bb20) {
      datasets.push({
        type: 'line',
        label: 'BB Upper',
        data: seriesFromIndicator(visibleIndicators.bb20.upper),
        borderColor: CHART_COLORS.bbUpper,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
        fill: '+1',
        backgroundColor: CHART_COLORS.bbFill,
      })
      datasets.push({
        type: 'line',
        label: 'BB Lower',
        data: seriesFromIndicator(visibleIndicators.bb20.lower),
        borderColor: CHART_COLORS.bbLower,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
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
        layout: { padding: { top: 8, right: 72, bottom: 2, left: 4 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            callbacks: {
              label: context => {
                const bar = visibleOhlcv[context.dataIndex]
                if (isCandlestick && context.dataset.label === 'OHLC' && bar) {
                  return [
                    `Open ${formatOverlayPrice(bar.o)}`,
                    `High ${formatOverlayPrice(bar.h)}`,
                    `Low ${formatOverlayPrice(bar.l)}`,
                    `Close ${formatOverlayPrice(bar.c)}`,
                  ]
                }
                return `${context.dataset.label}: ${formatOverlayPrice(context.parsed.y)}`
              },
            },
          },
          volumeOverlay: {
            show: isCandlestick,
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
          currentPriceLine: {
            price: lastBar?.c,
            open: lastBar?.o,
            ticker,
          },
          dateRangeLabel: {
            text: dateRangeText,
          },
        },
        scales: {
          x: tradingViewXAxis(maxTicksForInterval(interval, visibleOhlcv.length)),
          y: tradingViewYAxis(priceRange),
        },
      },
      plugins: [
        chartBackgroundPlugin,
        gapOverlayPlugin,
        volumeOverlayPlugin,
        candlestickPlugin,
        patternOverlayPlugin,
        fibonacciPlugin,
        priceLevelsPlugin,
        currentPricePlugin,
        dateRangePlugin,
      ],
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [ohlcv, indicators, showSMA, showEMA, showBB, chartType, patterns, gaps, showFibonacci, showGaps, showPatterns, showTriangles, showLevels, ticker, decision, interval, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
