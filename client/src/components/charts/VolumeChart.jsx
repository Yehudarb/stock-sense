import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import useStore from '../../store/useStore'
import { categoryXAxis, createCrosshairPlugin, formatTooltipDate, getChartPalette, getWindowBounds, labelsFromBars, rightYAxis, seriesFromBars, seriesFromIndicator } from './chartHelpers'

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
  showVolumeMA = true,
  interval,
  visibleBars,
  viewOffset = 0,
  hoveredIndex = null,
  onHoverIndexChange,
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const { theme } = useStore()

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length) return

    const palette = getChartPalette(theme)
    if (chartRef.current) chartRef.current.destroy()
    const { start, end } = getWindowBounds(ohlcv.length, visibleBars ?? ohlcv.length, viewOffset)
    const visibleOhlcv = ohlcv.slice(start, end)
    const labels = labelsFromBars(visibleOhlcv, interval)
    const avgVol = showVolumeMA ? indicators?.avgVol?.slice(start, end) ?? [] : []

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
          ...(showVolumeMA ? [{
            type: 'line',
            label: 'Avg volume',
            data: seriesFromIndicator(avgVol),
            borderColor: 'rgba(96, 165, 250, 0.95)',
            borderWidth: 1.2,
            pointRadius: 0,
            tension: 0.2,
          }] : []),
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
              label: context => `${context.dataset.label}: ${compactVolume(context.parsed.y)}`,
            },
          },
          volumeCrosshair: {
            index: hoveredIndex,
            theme,
          },
        },
        scales: {
          x: categoryXAxis(8, theme),
          y: rightYAxis({
            ticks: {
              callback: value => compactVolume(Number(value)),
            },
          }, theme),
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
  }, [hoveredIndex, indicators, interval, ohlcv, onHoverIndexChange, showVolumeMA, theme, viewOffset, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
