import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import useStore from '../../store/useStore'
import { categoryXAxis, createCrosshairPlugin, formatTooltipDate, getChartPalette, getWindowBounds, labelsFromBars, rightYAxis, seriesFromIndicator } from './chartHelpers'

const indicatorCrosshairPlugin = createCrosshairPlugin('indicatorCrosshair')

export default function IndicatorLineChart({
  ohlcv,
  interval,
  visibleBars,
  viewOffset = 0,
  hoveredIndex = null,
  onHoverIndexChange,
  datasets,
  yMin,
  yMax,
  referenceLines = [],
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const { theme } = useStore()

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !datasets?.length) return

    const palette = getChartPalette(theme)
    if (chartRef.current) chartRef.current.destroy()
    const { start, end } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const visibleOhlcv = ohlcv.slice(start, end)
    const labels = labelsFromBars(visibleOhlcv, interval)
    const referenceValues = referenceLines.map(line => line.value).filter(Number.isFinite)
    const suggestedMin = referenceValues.length ? Math.min(...referenceValues) : undefined
    const suggestedMax = referenceValues.length ? Math.max(...referenceValues) : undefined

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map(dataset => ({
          type: dataset.type ?? 'line',
          label: dataset.label,
          data: seriesFromIndicator(dataset.values?.slice(start, end)),
          borderColor: dataset.color,
          backgroundColor: dataset.backgroundColor ?? dataset.color,
          borderWidth: dataset.borderWidth ?? 1.5,
          pointRadius: 0,
          tension: dataset.tension ?? 0.16,
          fill: dataset.fill ?? false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 6, right: 10, left: 6, bottom: 2 } },
        interaction: { mode: 'index', intersect: false },
        onHover: (event, _elements, activeChart) => {
          if (!onHoverIndexChange) return
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
            padding: 12,
            callbacks: {
              title: items => {
                const bar = visibleOhlcv[items[0]?.dataIndex]
                return bar ? formatTooltipDate(bar.t, interval) : ''
              },
              label: context => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}`,
            },
          },
          indicatorCrosshair: {
            index: hoveredIndex,
            theme,
          },
        },
        scales: {
          x: categoryXAxis(8, theme),
          y: rightYAxis({
            min: yMin,
            max: yMax,
            ...(yMin == null && suggestedMin != null ? { suggestedMin } : {}),
            ...(yMax == null && suggestedMax != null ? { suggestedMax } : {}),
          }, theme),
        },
      },
      plugins: [
        indicatorCrosshairPlugin,
        {
          id: 'indicatorReferenceLines',
          afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart
            ctx.save()
            referenceLines.forEach(line => {
              const y = scales.y.getPixelForValue(line.value)
              if (!Number.isFinite(y) || y < chartArea.top || y > chartArea.bottom) return
              ctx.beginPath()
              ctx.moveTo(chartArea.left, y)
              ctx.lineTo(chartArea.right, y)
              ctx.strokeStyle = line.color ?? 'rgba(148, 163, 184, 0.35)'
              ctx.lineWidth = 1
              ctx.setLineDash(line.dash ?? [5, 4])
              ctx.stroke()
              ctx.setLineDash([])
              if (line.label) {
                ctx.fillStyle = line.color ?? 'rgba(148, 163, 184, 0.72)'
                ctx.font = '10px sans-serif'
                ctx.fillText(line.label, chartArea.left + 5, Math.max(chartArea.top + 10, y - 4))
              }
            })
            ctx.restore()
          },
        },
      ],
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [datasets, hoveredIndex, interval, ohlcv, onHoverIndexChange, referenceLines, theme, viewOffset, visibleBars, yMax, yMin])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
