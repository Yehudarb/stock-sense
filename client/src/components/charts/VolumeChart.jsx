import { useRef, useEffect } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { categoryXAxis, labelsFromBars, seriesFromBars } from './chartHelpers'

export default function VolumeChart({ ohlcv, interval, visibleBars }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length) return

    if (chartRef.current) chartRef.current.destroy()
    const start = Math.max(0, ohlcv.length - (visibleBars ?? ohlcv.length))
    const visibleOhlcv = ohlcv.slice(start)
    const labels = labelsFromBars(visibleOhlcv, interval)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Volume',
          data: seriesFromBars(visibleOhlcv, 'v'),
          backgroundColor: visibleOhlcv.map(b => b.c >= b.o ? CHART_COLORS.volBull : CHART_COLORS.volBear),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: categoryXAxis(6),
          y: { position: 'right', ticks: { color: '#94a3b8', callback: v => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v }, grid: { color: '#1e293b' } },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ohlcv, interval, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
