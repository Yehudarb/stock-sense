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

export function formatTooltipDate(timestamp, interval) {
  const date = new Date(timestamp)

  if (['1m', '5m', '15m', '1h', '4h'].includes(interval)) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function seriesFromBars(ohlcv, key) {
  return ohlcv.map(bar => bar[key])
}

export function seriesFromIndicator(values) {
  return values?.map(value => value ?? null) ?? []
}

export function getWindowBounds(total, visibleBars, viewOffset = 0, minBars = 20) {
  const safeVisible = Math.min(total, Math.max(minBars, visibleBars ?? total))
  const maxOffset = Math.max(0, total - safeVisible)
  const safeOffset = Math.min(maxOffset, Math.max(0, viewOffset))
  const end = total - safeOffset
  const start = Math.max(0, end - safeVisible)

  return {
    start,
    end,
    size: end - start,
    maxOffset,
    offset: safeOffset,
  }
}

export function getChartPalette(theme = 'dark') {
  if (theme === 'light') {
    return {
      tick: 'rgba(51, 65, 85, 0.92)',
      grid: 'rgba(148, 163, 184, 0.18)',
      border: 'rgba(148, 163, 184, 0.32)',
      tooltipBg: 'rgba(255, 255, 255, 0.98)',
      tooltipBorder: 'rgba(148, 163, 184, 0.28)',
      tooltipTitle: '#0f172a',
      tooltipBody: '#334155',
      crosshair: 'rgba(71, 85, 105, 0.35)',
      panelTop: '#f8fbff',
      panelBottom: '#eef4fb',
    }
  }

  return {
    tick: 'rgba(148, 163, 184, 0.92)',
    grid: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.14)',
    tooltipBg: 'rgba(2, 6, 23, 0.96)',
    tooltipBorder: 'rgba(148, 163, 184, 0.16)',
    tooltipTitle: '#f8fafc',
    tooltipBody: '#cbd5e1',
    crosshair: 'rgba(148, 163, 184, 0.35)',
    panelTop: '#07111f',
    panelBottom: '#050c17',
  }
}

export function categoryXAxis(maxTicksLimit = 8, theme = 'dark') {
  const palette = getChartPalette(theme)
  return {
    type: 'category',
    ticks: {
      color: palette.tick,
      maxTicksLimit,
      font: { size: 11 },
      autoSkip: true,
      maxRotation: 0,
    },
    grid: { color: palette.grid, drawTicks: false },
    border: { color: palette.border },
  }
}

export function rightYAxis(extra = {}, theme = 'dark') {
  const palette = getChartPalette(theme)
  return {
    position: 'right',
    ticks: {
      color: palette.tick,
      font: { size: 11 },
      padding: 6,
      ...(extra.ticks ?? {}),
    },
    grid: { color: palette.grid, drawTicks: false },
    border: { color: palette.border },
    ...extra,
  }
}

export function createCrosshairPlugin(id = 'syncedCrosshair') {
  return {
    id,
    afterDraw(chart, _args, options) {
      const index = options?.index
      const palette = getChartPalette(options?.theme)
      if (index == null) return

      const xScale = chart.scales?.x
      const yScale = chart.scales?.y
      const x = xScale?.getPixelForValue(index)
      if (!Number.isFinite(x) || !yScale) return

      const { ctx, chartArea } = chart
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.strokeStyle = palette.crosshair
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    },
  }
}
