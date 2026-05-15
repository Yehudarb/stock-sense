import { useRef, useEffect } from 'react'
import { Chart } from 'chart.js'
import useStore from '../../store/useStore'
import { categoryXAxis, getChartPalette, labelsFromBars, rightYAxis, seriesFromIndicator } from './chartHelpers'

export default function StochChart({ ohlcv, indicators, interval, visibleBars }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const { theme } = useStore()

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !indicators?.stoch) return

    const palette = getChartPalette(theme)
    const start = Math.max(0, ohlcv.length - (visibleBars ?? ohlcv.length))
    const visibleOhlcv = ohlcv.slice(start)
    const { k, d } = indicators.stoch
    const visibleK = k.slice(start)
    const visibleD = d.slice(start)

    if (chartRef.current) chartRef.current.destroy()
    const labels = labelsFromBars(visibleOhlcv, interval)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '%K',
            data: seriesFromIndicator(visibleK),
            borderColor: '#378add', borderWidth: 1.5, pointRadius: 0, tension: 0.1,
          },
          {
            label: '%D',
            data: seriesFromIndicator(visibleD),
            borderColor: '#E24B4A', borderWidth: 1, pointRadius: 0, tension: 0.1,
          },
          {
            type: 'line',
            label: 'Overbought (80)',
            data: new Array(visibleK.length).fill(80),
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            type: 'line',
            label: 'Oversold (20)',
            data: new Array(visibleK.length).fill(20),
            borderColor: 'rgba(34, 197, 94, 0.5)',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
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
          y: rightYAxis({ min: 0, max: 100 }, theme),
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ohlcv, indicators, interval, theme, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
