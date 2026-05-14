import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { categoryXAxis, createCrosshairPlugin, formatTooltipDate, getWindowBounds, labelsFromBars, rightYAxis, seriesFromBars, seriesFromIndicator } from './chartHelpers'

const volumeCrosshairPlugin = createCrosshairPlugin('volumeCrosshair')

function compactVolume(value) {
  if (value == null) return '-'
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`
  return `${Math.round(value)}`
}

export default function VolumeChart({
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
    if (!canvasRef.current || !ohlcv?.length) return

    if (chartRef.current) chartRef.current.destroy()
    const { start, end } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const visibleOhlcv = ohlcv.slice(start, end)
    const labels = labelsFromBars(visibleOhlcv, interval)
    const avgVol = indicators?.avgVol?.slice(start, end) ?? []

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Volume',
            data: seriesFromBars(visibleOhlcv, 'v'),
            backgroundColor: visibleOhlcv.map(bar => bar.c >= bar.o ? CHART_COLORS.volBull : CHART_COLORS.volBear),
            borderRadius: 2,
            maxBarThickness: 10,
          },
          {
            type: 'line',
            label: 'Avg volume',
            data: seriesFromIndicator(avgVol),
            borderColor: 'rgba(96, 165, 250, 0.95)',
            borderWidth: 1.2,
            pointRadius: 0,
            tension: 0.2,
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
              label: context => `${context.dataset.label}: ${compactVolume(context.parsed.y)}`,
            },
          },
          volumeCrosshair: {
            index: hoveredIndex,
          },
        },
        scales: {
          x: categoryXAxis(8),
          y: rightYAxis({
            ticks: {
              callback: value => compactVolume(Number(value)),
            },
          }),
        },
      },
      plugins: [volumeCrosshairPlugin],
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
