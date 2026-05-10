function last(values, index) {
  return values?.[index] ?? null
}

function mean(values) {
  const clean = values.filter(value => value != null && Number.isFinite(value))
  if (!clean.length) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

function std(values) {
  const avg = mean(values)
  if (avg == null) return null
  return Math.sqrt(mean(values.map(value => (value - avg) ** 2)))
}

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function findLocalLevels(ohlcv, key, comparator, window = 6) {
  const levels = []
  for (let i = window; i < ohlcv.length - window; i++) {
    const value = ohlcv[i][key]
    const slice = ohlcv.slice(i - window, i + window + 1).map(bar => bar[key])
    if (slice.every(other => comparator(value, other))) {
      levels.push({ price: value, index: i })
    }
  }
  return levels
}

function clusterLevels(levels, tolerancePct = 0.012) {
  const clusters = []
  for (const level of levels) {
    const cluster = clusters.find(item => Math.abs(level.price - item.price) / item.price <= tolerancePct)
    if (cluster) {
      cluster.price = (cluster.price * cluster.count + level.price) / (cluster.count + 1)
      cluster.count += 1
      cluster.lastIndex = Math.max(cluster.lastIndex, level.index)
    } else {
      clusters.push({ price: level.price, count: 1, lastIndex: level.index })
    }
  }

  return clusters
    .sort((a, b) => (b.count - a.count) || (b.lastIndex - a.lastIndex))
    .slice(0, 5)
    .map(level => round(level.price))
}

function supportResistance(ohlcv) {
  if (!ohlcv?.length) return null
  const price = ohlcv[ohlcv.length - 1].c
  const support = clusterLevels(findLocalLevels(ohlcv, 'l', (value, other) => value <= other))
    .filter(level => level <= price)
    .sort((a, b) => b - a)
  const resistance = clusterLevels(findLocalLevels(ohlcv, 'h', (value, other) => value >= other))
    .filter(level => level >= price)
    .sort((a, b) => a - b)
  const recent = ohlcv.slice(-20)
  const recentHigh = Math.max(...recent.map(bar => bar.h))
  const recentLow = Math.min(...recent.map(bar => bar.l))

  return {
    support,
    resistance,
    nearestSupport: support[0] ?? round(recentLow),
    nearestResistance: resistance[0] ?? round(recentHigh),
    breakoutUp: price > recentHigh * 1.002,
    breakoutDown: price < recentLow * 0.998,
    nearSupport: support.some(level => Math.abs(price - level) / price < 0.02),
    nearResistance: resistance.some(level => Math.abs(price - level) / price < 0.02),
    recentHigh: round(recentHigh),
    recentLow: round(recentLow),
  }
}

function divergences(ohlcv, indicators) {
  const lastIndex = ohlcv.length - 1
  const rsi = indicators.rsi14
  if (!rsi || ohlcv.length < 30) return { bullish: false, bearish: false, factors: [] }

  const recentBars = ohlcv.slice(-8)
  const recentRsi = rsi.slice(-8).filter(value => value != null)
  const priceNow = ohlcv[lastIndex].c
  const priceAvg = mean(recentBars.map(bar => bar.c))
  const rsiNow = rsi[lastIndex]
  const rsiAvg = mean(recentRsi)
  const factors = []

  const bullish = priceAvg != null && rsiAvg != null && priceNow < priceAvg * 0.985 && rsiNow > rsiAvg
  const bearish = priceAvg != null && rsiAvg != null && priceNow > priceAvg * 1.015 && rsiNow < rsiAvg

  if (bullish) factors.push('Bullish divergence: המחיר חלש אבל RSI מתחזק')
  if (bearish) factors.push('Bearish divergence: המחיר עולה אבל RSI נחלש')

  return { bullish, bearish, factors }
}

function volumeProfile(ohlcv, bins = 10, lookback = 100) {
  const recent = ohlcv.slice(-lookback)
  if (recent.length < 10) return { highVolumeLevels: [], conviction: false }

  const prices = recent.map(bar => bar.c)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const width = (max - min) / bins
  if (!width) return { highVolumeLevels: [], conviction: false }

  const buckets = Array.from({ length: bins }, (_, index) => ({
    start: min + index * width,
    end: min + (index + 1) * width,
    volume: 0,
  }))

  for (const bar of recent) {
    const bucketIndex = Math.min(bins - 1, Math.max(0, Math.floor((bar.c - min) / width)))
    buckets[bucketIndex].volume += bar.v ?? 0
  }

  const maxVolume = Math.max(...buckets.map(bucket => bucket.volume))
  const highVolumeLevels = buckets
    .filter(bucket => bucket.volume >= maxVolume * 0.7)
    .map(bucket => `${round(bucket.start)}-${round(bucket.end)}`)

  return { highVolumeLevels, conviction: highVolumeLevels.length > 0 }
}

function institutionalActivity(ohlcv) {
  const recent = ohlcv.slice(-20)
  const volumeAvg = mean(ohlcv.slice(-100).map(bar => bar.v)) ?? mean(recent.map(bar => bar.v)) ?? 0
  let spikeCount = 0

  for (let i = 1; i < recent.length; i++) {
    if ((recent[i].v ?? 0) > volumeAvg * 2 && recent[i].c > recent[i - 1].c) {
      spikeCount += 1
    }
  }

  const closes = recent.slice(-10).map(bar => bar.c)
  const volatility = (std(closes) ?? 0) / (mean(closes) ?? 1)
  const consolidation = volatility < 0.01 && (mean(recent.slice(-10).map(bar => bar.v)) ?? 0) > volumeAvg

  return {
    institutionalBuying: spikeCount >= 2 || consolidation,
    spikeCount,
    consolidation,
    avgVolume: round(volumeAvg, 0),
    currentVolume: recent[recent.length - 1]?.v ?? 0,
  }
}

function marketRegime(ohlcv, indicators) {
  const index = ohlcv.length - 1
  const rsi = last(indicators.rsi14, index)
  const atr = last(indicators.atr14, index)
  const price = ohlcv[index]?.c
  const volatilityPct = price && atr ? (atr / price) * 100 : null
  let regime = 'TRANSITIONAL'
  let strength = 'MEDIUM'

  if (rsi < 30 || rsi > 70) {
    regime = 'TRENDING'
    strength = 'STRONG'
  } else if (rsi > 40 && rsi < 60) {
    regime = 'RANGING'
    strength = 'NEUTRAL'
  }

  const riskLevel = regime === 'TRENDING' && volatilityPct > 2
    ? 'HIGH'
    : regime === 'RANGING' && volatilityPct < 0.5 ? 'LOW' : 'MEDIUM'

  return { regime, strength, riskLevel, volatilityPct: round(volatilityPct), rsi: round(rsi) }
}

function gapAnalysis(ohlcv) {
  if (!ohlcv || ohlcv.length < 2) {
    return { gaps: [], openGaps: [], closedGaps: [], nearestOpen: null, recentlyClosed: null, openCount: 0, factors: [] }
  }

  const currentPrice = ohlcv[ohlcv.length - 1].c
  const minGapPct = 0.25
  const detected = []

  for (let index = 1; index < ohlcv.length; index++) {
    const prev = ohlcv[index - 1]
    const bar = ohlcv[index]
    let direction = null
    let zoneLow = null
    let zoneHigh = null

    if (bar.l > prev.h) {
      direction = 'up'
      zoneLow = prev.h
      zoneHigh = bar.l
    } else if (bar.h < prev.l) {
      direction = 'down'
      zoneLow = bar.h
      zoneHigh = prev.l
    } else {
      continue
    }

    const size = zoneHigh - zoneLow
    const sizePct = prev.c ? (size / prev.c) * 100 : 0
    if (sizePct < minGapPct) continue

    let fillIndex = null
    let fillPct = 0
    let bestFill = direction === 'up' ? zoneHigh : zoneLow

    for (let cursor = index + 1; cursor < ohlcv.length; cursor++) {
      const future = ohlcv[cursor]

      if (direction === 'up') {
        bestFill = Math.min(bestFill, future.l)
        fillPct = Math.max(fillPct, ((zoneHigh - bestFill) / size) * 100)
        if (future.l <= zoneLow) {
          fillIndex = cursor
          fillPct = 100
          break
        }
      } else {
        bestFill = Math.max(bestFill, future.h)
        fillPct = Math.max(fillPct, ((bestFill - zoneLow) / size) * 100)
        if (future.h >= zoneHigh) {
          fillIndex = cursor
          fillPct = 100
          break
        }
      }
    }

    const status = fillIndex != null ? 'closed' : fillPct > 0 ? 'partial' : 'open'
    const position = currentPrice > zoneHigh ? 'below' : currentPrice < zoneLow ? 'above' : 'inside'
    const distancePct = position === 'inside'
      ? 0
      : position === 'below'
        ? ((currentPrice - zoneHigh) / currentPrice) * 100
        : ((zoneLow - currentPrice) / currentPrice) * 100

    detected.push({
      id: `${direction}-${index}-${round(zoneLow, 3)}-${round(zoneHigh, 3)}`,
      direction,
      label: direction === 'up' ? 'Gap Up' : 'Gap Down',
      index,
      fillIndex,
      endIndex: fillIndex ?? ohlcv.length - 1,
      zoneLow: round(zoneLow, zoneLow >= 100 ? 2 : 3),
      zoneHigh: round(zoneHigh, zoneHigh >= 100 ? 2 : 3),
      sizePct: round(sizePct),
      fillPct: round(Math.min(100, fillPct)),
      status,
      position,
      distancePct: round(Math.abs(distancePct)),
      ageBars: (fillIndex ?? ohlcv.length - 1) - index,
      closeAgeBars: fillIndex == null ? null : (ohlcv.length - 1) - fillIndex,
    })
  }

  const gaps = detected.slice(-24)
  const openGaps = gaps.filter(gap => gap.status !== 'closed')
  const closedGaps = gaps.filter(gap => gap.status === 'closed')
  const nearestOpen = [...openGaps].sort((a, b) => a.distancePct - b.distancePct)[0] ?? null
  const recentlyClosed = [...closedGaps].sort((a, b) => b.fillIndex - a.fillIndex)[0] ?? null
  const factors = []

  if (nearestOpen) {
    const zone = `$${nearestOpen.zoneLow}-${nearestOpen.zoneHigh}`
    const status = nearestOpen.status === 'partial' ? `נסגר חלקית (${nearestOpen.fillPct}%)` : 'עדיין פתוח'
    factors.push(`גאפ ${nearestOpen.direction === 'up' ? 'עולה' : 'יורד'} ${status} באזור ${zone}`)
  }

  if (recentlyClosed && recentlyClosed.fillIndex >= ohlcv.length - 15) {
    factors.push(`גאפ נסגר לאחרונה באזור $${recentlyClosed.zoneLow}-${recentlyClosed.zoneHigh}`)
  }

  return {
    gaps,
    openGaps: openGaps.slice(-8),
    closedGaps: closedGaps.slice(-8),
    nearestOpen,
    recentlyClosed,
    openCount: openGaps.length,
    closedCount: closedGaps.length,
    factors,
  }
}

function professionalScore(signal, features) {
  let score = signal.score / 100
  const factors = []

  if (features.supportResistance.nearSupport) {
    score += 1
    factors.push('קרוב לתמיכה משמעותית')
  }
  if (features.supportResistance.nearResistance) {
    score -= 1
    factors.push('קרוב להתנגדות משמעותית')
  }
  if (features.supportResistance.breakoutUp) {
    score += 1
    factors.push('פריצה מעל טווח אחרון')
  }
  if (features.supportResistance.breakoutDown) {
    score -= 1
    factors.push('שבירה מתחת לטווח אחרון')
  }
  if (features.divergences.bullish) score += 1.5
  if (features.divergences.bearish) score -= 1.5
  if (features.institutional.institutionalBuying) {
    score += 1.2
    factors.push(`פעילות מוסדית אפשרית (${features.institutional.spikeCount} קפיצות נפח)`)
  }
  if (features.volumeProfile.conviction) {
    score += 0.4
    factors.push('אזורי נפח גבוה מחזקים את הרמה')
  }
  if (features.marketRegime.regime === 'TRENDING') score += signal.score >= 0 ? 0.6 : -0.6
  if (features.gaps.nearestOpen) {
    const gap = features.gaps.nearestOpen
    const near = gap.distancePct <= 3

    if (gap.direction === 'up' && gap.position === 'below') {
      score -= near ? 0.45 : 0.15
      factors.push(`גאפ פתוח מתחת למחיר באזור $${gap.zoneLow}-${gap.zoneHigh}${near ? ' - סיכון למשיכה לסגירה' : ''}`)
    }
    if (gap.direction === 'down' && gap.position === 'above') {
      score += near ? 0.35 : 0.1
      factors.push(`גאפ פתוח מעל המחיר באזור $${gap.zoneLow}-${gap.zoneHigh}${near ? ' - יעד אפשרי לסגירה' : ''}`)
    }
    if (gap.position === 'inside') {
      factors.push(`המחיר נמצא בתוך אזור גאפ $${gap.zoneLow}-${gap.zoneHigh}`)
    }
  }
  if (features.gaps.recentlyClosed?.closeAgeBars != null && features.gaps.recentlyClosed.closeAgeBars <= 20) {
    const gap = features.gaps.recentlyClosed
    factors.push(`גאפ שנסגר לאחרונה: $${gap.zoneLow}-${gap.zoneHigh}`)
  }

  const methodSignals = [
    Math.sign(signal.score),
    features.supportResistance.breakoutUp || features.supportResistance.nearSupport ? 1 : features.supportResistance.breakoutDown || features.supportResistance.nearResistance ? -1 : 0,
    features.divergences.bullish ? 1 : features.divergences.bearish ? -1 : 0,
    features.institutional.institutionalBuying ? 1 : 0,
    features.marketRegime.regime === 'TRENDING' ? Math.sign(signal.score) : 0,
  ]
  const directional = methodSignals.filter(Boolean)
  const positive = directional.filter(value => value > 0).length
  const negative = directional.filter(value => value < 0).length
  const agreement = Math.max(positive, negative)
  const confluencePct = directional.length ? Math.round((agreement / directional.length) * 100) : 0

  return {
    score: round(score, 2),
    confluencePct,
    confidenceLevel: confluencePct >= 80 ? 'MAXIMUM' : confluencePct >= 65 ? 'HIGH' : confluencePct >= 45 ? 'MEDIUM' : 'LOW',
    factors: [...features.divergences.factors, ...factors].slice(0, 8),
  }
}

export function computeProfessionalFeatures(ohlcv, indicators, signal) {
  if (!ohlcv?.length || !indicators || !signal) return null
  const features = {
    supportResistance: supportResistance(ohlcv),
    divergences: divergences(ohlcv, indicators),
    volumeProfile: volumeProfile(ohlcv),
    institutional: institutionalActivity(ohlcv),
    marketRegime: marketRegime(ohlcv, indicators),
    gaps: gapAnalysis(ohlcv),
  }

  return {
    ...features,
    professional: professionalScore(signal, features),
  }
}
