import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { categoryXAxis, labelsFromBars, seriesFromIndicator } from './chartHelpers'

export default function WilliamsRChart({ ohlcv, indicators, interval, visibleBars }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !indicators?.willR) return

    if (chartRef.current) chartRef.current.destroy()
    const start = Math.max(0, ohlcv.length - (visibleBars ?? ohlcv.length))
    const visibleOhlcv = ohlcv.slice(start)
    const labels = labelsFromBars(visibleOhlcv, interval)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Williams %R',
          data: seriesFromIndicator(indicators.willR.slice(start)),
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: {
            annotations: {
              overbought: { type: 'line', yMin: -20, yMax: -20, borderColor: 'rgba(226,75,74,0.6)', borderWidth: 1, borderDash: [4, 4] },
              oversold: { type: 'line', yMin: -80, yMax: -80, borderColor: 'rgba(99,153,34,0.6)', borderWidth: 1, borderDash: [4, 4] },
            },
          },
        },
        scales: {
          x: categoryXAxis(6),
          y: { position: 'right', min: -100, max: 0, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [ohlcv, indicators, interval, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
