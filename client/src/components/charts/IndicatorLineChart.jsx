import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { categoryXAxis, createCrosshairPlugin, formatTooltipDate, getWindowBounds, labelsFromBars, rightYAxis, seriesFromIndicator } from './chartHelpers'

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
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !datasets?.length) return

    if (chartRef.current) chartRef.current.destroy()
    const { start, end } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const visibleOhlcv = ohlcv.slice(start, end)
    const labels = labelsFromBars(visibleOhlcv, interval)

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
          indicatorCrosshair: {
            index: hoveredIndex,
          },
        },
        scales: {
          x: categoryXAxis(8),
          y: rightYAxis({ min: yMin, max: yMax }),
        },
      },
      plugins: [indicatorCrosshairPlugin],
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [datasets, hoveredIndex, interval, ohlcv, onHoverIndexChange, viewOffset, visibleBars, yMax, yMin])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
