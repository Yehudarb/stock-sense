import { useRef, useEffect } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { categoryXAxis, labelsFromBars, seriesFromIndicator } from './chartHelpers'

export default function RsiChart({ ohlcv, indicators, interval, visibleBars }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !indicators?.rsi14) return

    if (chartRef.current) chartRef.current.destroy()
    const start = Math.max(0, ohlcv.length - (visibleBars ?? ohlcv.length))
    const visibleOhlcv = ohlcv.slice(start)
    const labels = labelsFromBars(visibleOhlcv, interval)
    const rsi = indicators.rsi14.slice(start)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'RSI',
          data: seriesFromIndicator(rsi),
          borderColor: CHART_COLORS.rsi, borderWidth: 1.5, pointRadius: 0, tension: 0.1,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: {
            annotations: {
              over70: { type: 'line', yMin: 70, yMax: 70, borderColor: 'rgba(226,75,74,0.6)', borderWidth: 1, borderDash: [4, 4] },
              under30: { type: 'line', yMin: 30, yMax: 30, borderColor: 'rgba(99,153,34,0.6)', borderWidth: 1, borderDash: [4, 4] },
            },
          },
        },
        scales: {
          x: categoryXAxis(6),
          y: { position: 'right', min: 0, max: 100, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ohlcv, indicators, interval, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
