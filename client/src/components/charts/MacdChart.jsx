import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { categoryXAxis, createCrosshairPlugin, formatTooltipDate, getWindowBounds, labelsFromBars, rightYAxis, seriesFromIndicator } from './chartHelpers'

const macdCrosshairPlugin = createCrosshairPlugin('macdCrosshair')

export default function MacdChart({
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
    if (!canvasRef.current || !ohlcv?.length || !indicators?.macd) return

    const { start, end } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const visibleOhlcv = ohlcv.slice(start, end)
    const macd = {
      line: indicators.macd.line.slice(start, end),
      signal: indicators.macd.signal.slice(start, end),
      histogram: indicators.macd.histogram.slice(start, end),
    }

    if (chartRef.current) chartRef.current.destroy()
    const labels = labelsFromBars(visibleOhlcv, interval)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Histogram',
            data: seriesFromIndicator(macd.histogram),
            backgroundColor: macd.histogram.map(value => (
              value == null ? 'transparent' : value >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'
            )),
            borderRadius: 2,
            maxBarThickness: 10,
          },
          {
            type: 'line',
            label: 'MACD',
            data: seriesFromIndicator(macd.line),
            borderColor: CHART_COLORS.macdLine,
            borderWidth: 1.6,
            pointRadius: 0,
            tension: 0.18,
          },
          {
            type: 'line',
            label: 'Signal',
            data: seriesFromIndicator(macd.signal),
            borderColor: CHART_COLORS.macdSig,
            borderWidth: 1.4,
            pointRadius: 0,
            tension: 0.18,
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
              label: context => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}`,
            },
          },
          macdCrosshair: {
            index: hoveredIndex,
          },
        },
        scales: {
          x: categoryXAxis(8),
          y: rightYAxis(),
        },
      },
      plugins: [
        macdCrosshairPlugin,
        {
          id: 'macdZeroLine',
          afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart
            const y = scales.y.getPixelForValue(0)
            ctx.save()
            ctx.beginPath()
            ctx.moveTo(chartArea.left, y)
            ctx.lineTo(chartArea.right, y)
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)'
            ctx.setLineDash([4, 4])
            ctx.stroke()
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
  }, [hoveredIndex, indicators, interval, ohlcv, onHoverIndexChange, viewOffset, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
