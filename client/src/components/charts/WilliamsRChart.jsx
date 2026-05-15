import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import useStore from '../../store/useStore'
import { categoryXAxis, getChartPalette, labelsFromBars, rightYAxis, seriesFromIndicator } from './chartHelpers'

export default function WilliamsRChart({ ohlcv, indicators, interval, visibleBars }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const { theme } = useStore()

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !indicators?.willR) return

    const palette = getChartPalette(theme)
    if (chartRef.current) chartRef.current.destroy()
    const start = Math.max(0, ohlcv.length - (visibleBars ?? ohlcv.length))
    const visibleOhlcv = ohlcv.slice(start)
    const visibleWillR = indicators.willR.slice(start)
    const labels = labelsFromBars(visibleOhlcv, interval)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Williams %R',
            data: seriesFromIndicator(visibleWillR),
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            type: 'line',
            label: 'Overbought (-20)',
            data: new Array(visibleWillR.length).fill(-20),
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            type: 'line',
            label: 'Oversold (-80)',
            data: new Array(visibleWillR.length).fill(-80),
            borderColor: 'rgba(34, 197, 94, 0.5)',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
          },
        },
        scales: {
          x: categoryXAxis(6, theme),
          y: rightYAxis({ min: -100, max: 0 }, theme),
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [ohlcv, indicators, interval, theme, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
