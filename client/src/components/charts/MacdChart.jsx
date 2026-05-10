import { useRef, useEffect } from 'react'
import { Chart } from 'chart.js'
import { CHART_COLORS } from '../../../../shared/constants'
import { categoryXAxis, labelsFromBars, seriesFromIndicator } from './chartHelpers'

export default function MacdChart({ ohlcv, indicators, interval, visibleBars }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !ohlcv?.length || !indicators?.macd) return

    const start = Math.max(0, ohlcv.length - (visibleBars ?? ohlcv.length))
    const visibleOhlcv = ohlcv.slice(start)
    const macd = {
      line: indicators.macd.line.slice(start),
      signal: indicators.macd.signal.slice(start),
      histogram: indicators.macd.histogram.slice(start),
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
            backgroundColor: macd.histogram.map(v => v == null ? 'transparent' : v >= 0 ? CHART_COLORS.bullish : CHART_COLORS.bearish),
          },
          {
            type: 'line',
            label: 'MACD',
            data: seriesFromIndicator(macd.line),
            borderColor: CHART_COLORS.macdLine, borderWidth: 1.5, pointRadius: 0, tension: 0.1,
          },
          {
            type: 'line',
            label: 'Signal',
            data: seriesFromIndicator(macd.signal),
            borderColor: CHART_COLORS.macdSig, borderWidth: 1.5, pointRadius: 0, tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: categoryXAxis(6),
          y: { position: 'right', ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ohlcv, indicators, interval, visibleBars])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
