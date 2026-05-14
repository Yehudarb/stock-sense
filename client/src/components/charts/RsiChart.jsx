import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { categoryXAxis, createCrosshairPlugin, formatTooltipDate, getWindowBounds, labelsFromBars, rightYAxis, seriesFromIndicator } from './chartHelpers'

const rsiCrosshairPlugin = createCrosshairPlugin('rsiCrosshair')

export default function RsiChart({
  ohlcv,
  indicators,
  interval,
  visibleBars,
  viewOffset = 0,
  hoveredIndex = null,
  onHoverIndexChange,
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !indicators?.rsi14) return

    if (chartRef.current) chartRef.current.destroy()
    const { start, end } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const visibleOhlcv = ohlcv.slice(start, end)
    const labels = labelsFromBars(visibleOhlcv, interval)
    const rsi = indicators.rsi14.slice(start, end)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'RSI',
            data: seriesFromIndicator(rsi),
            borderColor: CHART_COLORS.rsi,
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.18,
            fill: 'origin',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
          },
        ],
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
            backgroundColor: 'rgba(2, 6, 23, 0.96)',
            borderColor: 'rgba(148, 163, 184, 0.16)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              title: items => {
                const bar = visibleOhlcv[items[0]?.dataIndex]
                return bar ? formatTooltipDate(bar.t, interval) : ''
              },
              label: context => `RSI: ${Number(context.parsed.y).toFixed(1)}`,
            },
          },
          rsiCrosshair: {
            index: hoveredIndex,
          },
        },
        scales: {
          x: categoryXAxis(8),
          y: rightYAxis({
            min: 0,
            max: 100,
          }),
        },
      },
      plugins: [
        rsiCrosshairPlugin,
        {
          id: 'rsiBands',
          beforeDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart
            const overboughtY = scales.y.getPixelForValue(70)
            const oversoldY = scales.y.getPixelForValue(30)

            ctx.save()
            ctx.fillStyle = 'rgba(244, 63, 94, 0.06)'
            ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, overboughtY - chartArea.top)
            ctx.fillStyle = 'rgba(16, 185, 129, 0.05)'
            ctx.fillRect(chartArea.left, oversoldY, chartArea.right - chartArea.left, chartArea.bottom - oversoldY)
            ctx.restore()
          },
          afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart
            ;[
              [70, 'rgba(244, 63, 94, 0.52)'],
              [50, 'rgba(148, 163, 184, 0.22)'],
              [30, 'rgba(16, 185, 129, 0.52)'],
            ].forEach(([value, color]) => {
              const y = scales.y.getPixelForValue(value)
              ctx.save()
              ctx.beginPath()
              ctx.moveTo(chartArea.left, y)
              ctx.lineTo(chartArea.right, y)
              ctx.strokeStyle = color
              ctx.setLineDash(value === 50 ? [2, 6] : [6, 4])
              ctx.stroke()
              ctx.restore()
            })
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
  }, [hoveredIndex, indicators, interval, ohlcv, onHoverIndexChange, viewOffset, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
