const INTRADAY_DURATION_MS = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  // The server stamps a 4H aggregate with the opening time of its last 1H bar.
  '4h': 60 * 60_000,
}

const DAILY_BAR_INTERVALS = new Set(['1d', '1mo', '1y'])

function easternParts(timestamp) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(timestamp))
  const get = type => parts.find(part => part.type === type)?.value
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

function dateKey(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`
}

function weekKey(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - weekday + 1)
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
}

export function isLastBarClosed(lastBar, interval, now = Date.now()) {
  if (!lastBar || !Number.isFinite(Number(lastBar.t))) return true
  const barTime = Number(lastBar.t)

  if (INTRADAY_DURATION_MS[interval]) {
    return now >= barTime + INTRADAY_DURATION_MS[interval]
  }

  const current = easternParts(now)
  const bar = easternParts(barTime)

  if (DAILY_BAR_INTERVALS.has(interval)) {
    if (dateKey(current) !== dateKey(bar)) return true
    if (current.weekday === 'Sat' || current.weekday === 'Sun') return true
    return current.minutes >= 16 * 60
  }

  if (interval === '5y') {
    if (weekKey(current) !== weekKey(bar)) return true
    if (current.weekday === 'Sat' || current.weekday === 'Sun') return true
    return current.weekday === 'Fri' && current.minutes >= 16 * 60
  }

  return true
}

export function getClosedAnalysisBars(bars, interval, now = Date.now()) {
  if (!Array.isArray(bars) || !bars.length) {
    return { bars: [], excludedLiveBar: false, lastClosedAt: null }
  }

  const excludedLiveBar = !isLastBarClosed(bars[bars.length - 1], interval, now)
  const closedBars = excludedLiveBar ? bars.slice(0, -1) : bars
  return {
    bars: closedBars,
    excludedLiveBar,
    lastClosedAt: closedBars.at(-1)?.t ?? null,
  }
}
