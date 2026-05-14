function fmt(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return `$${Number(value).toFixed(2)}`
}

function sentimentLabel(bias) {
  return {
    bullish: 'Bullish',
    neutral: 'Neutral',
    bearish: 'Bearish',
  }[bias] ?? 'Neutral'
}

function riskLevel({ forecast, signal, earnings, marketContext }) {
  let score = 0

  if (forecast?.confidence >= 75) score -= 1
  if (signal?.risk?.rrRatio < 1.5) score += 1
  if (marketContext?.shouldBlockBuy) score += 1
  if (['BEAR', 'PANIC'].includes(marketContext?.condition)) score += 1
  if (earnings?.nextReport?.daysUntil != null && earnings.nextReport.daysUntil >= 0 && earnings.nextReport.daysUntil <= 14) score += 1

  if (score >= 3) return 'High'
  if (score <= 0) return 'Low'
  return 'Medium'
}

function buildNewsSentiment({ marketContext, earnings }) {
  const marketText = marketContext?.label
    ? `Broad market tone is ${String(marketContext.label).toLowerCase()}.`
    : 'Broad market tone is still being estimated.'

  const earningsText = earnings?.nextReport?.daysUntil == null
    ? 'No confirmed earnings catalyst is in the near-term event window.'
    : earnings.nextReport.daysUntil >= 0 && earnings.nextReport.daysUntil <= 14
      ? `An earnings event is ${earnings.nextReport.daysUntil} day(s) away, so event risk is elevated.`
      : 'No immediate earnings catalyst is pressuring the setup.'

  return `${marketText} ${earningsText} This demo currently infers event tone from market context and earnings timing rather than a dedicated news feed.`
}

function buildTechnicalOutlook({ signal, forecast }) {
  const decision = signal?.decision
  const bestPattern = signal?.patterns?.best
  const regime = decision?.regime?.regime ?? signal?.gates?.trend?.regime ?? 'unknown'
  const support = decision?.support != null ? fmt(decision.support) : '-'
  const resistance = decision?.resistance != null ? fmt(decision.resistance) : '-'
  const target = forecast?.targetPrice != null ? fmt(forecast.targetPrice) : '-'
  const patternText = bestPattern?.label ? ` Leading pattern: ${bestPattern.label}.` : ''

  return `Trend regime is ${regime}. Support sits near ${support}, resistance near ${resistance}, and the working target is ${target}.${patternText}`
}

export function buildAnalysisResult({ forecast, signal, marketContext, earnings }) {
  if (!forecast || !signal) return null

  const sentiment = sentimentLabel(forecast.bias)
  const finalOutlook = forecast.suggestedAction
  const bullCase = (forecast.drivers ?? []).slice(0, 4)
  const bearCase = (forecast.risks ?? []).slice(0, 4)
  const keyRisks = [
    signal?.risk?.riskPct != null ? `Risk to stop is about ${signal.risk.riskPct}% from the current setup.` : null,
    signal?.risk?.rrRatio != null ? `Risk/reward is currently 1:${signal.risk.rrRatio}.` : null,
    earnings?.nextReport?.daysUntil != null && earnings.nextReport.daysUntil >= 0 && earnings.nextReport.daysUntil <= 14
      ? `Earnings are due in ${earnings.nextReport.daysUntil} day(s), which can distort technical setups.`
      : null,
    marketContext?.shouldBlockBuy ? 'The broader market is not fully supportive of aggressive new long exposure.' : null,
  ].filter(Boolean)

  return {
    summary: forecast.summary,
    overallSentiment: sentiment,
    confidenceScore: forecast.confidence,
    riskLevel: riskLevel({ forecast, signal, earnings, marketContext }),
    bullCase,
    bearCase,
    keyRisks,
    newsSentiment: buildNewsSentiment({ marketContext, earnings }),
    technicalOutlook: buildTechnicalOutlook({ signal, forecast }),
    finalOutlook,
  }
}
