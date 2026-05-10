export function formatChartLabel(timestamp, interval) {
  const date = new Date(timestamp)
  const datePart = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  const timePart = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (['1m', '5m', '15m', '1h', '4h'].includes(interval)) {
    return `${datePart} ${timePart}`
  }

  if (interval === '1y' || interval === '5y') {
    return date.toLocaleDateString('he-IL', { month: '2-digit', year: '2-digit' })
  }

  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function labelsFromBars(ohlcv, interval) {
  return ohlcv.map(bar => formatChartLabel(bar.t, interval))
}

export function seriesFromBars(ohlcv, key) {
  return ohlcv.map(bar => bar[key])
}

export function seriesFromIndicator(values) {
  return values?.map(value => value ?? null) ?? []
}

export function categoryXAxis(maxTicksLimit = 8) {
  return {
    type: 'category',
    ticks: { color: '#94a3b8', maxTicksLimit },
    grid: { color: '#1e293b' },
  }
}

export function rightYAxis(extra = {}) {
  return {
    position: 'right',
    ticks: { color: '#94a3b8', ...(extra.ticks ?? {}) },
    grid: { color: '#1e293b' },
    ...extra,
  }
}
