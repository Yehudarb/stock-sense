const RISK_MULTIPLIER     = 1.5
const REWARD_MULTIPLIER   = 2.0
const TRAILING_MULTIPLIER = 1.2

export function computeRisk(ohlcv, indicators) {
  if (!ohlcv?.length || !indicators?.atr14) return null

  const last  = ohlcv.length - 1
  const price = ohlcv[last].c
  const atr   = indicators.atr14[last]

  if (!atr || atr <= 0) return null

  const stopLoss   = price - RISK_MULTIPLIER * atr
  const takeProfit = price + REWARD_MULTIPLIER * atr
  const trailingStop = price - TRAILING_MULTIPLIER * atr
  const riskPct    = ((price - stopLoss) / price) * 100
  const rewardPct  = ((takeProfit - price) / price) * 100
  const rrRatio    = rewardPct / riskPct

  return {
    atr:           parseFloat(atr.toFixed(2)),
    stopLoss:      parseFloat(stopLoss.toFixed(2)),
    takeProfit:    parseFloat(takeProfit.toFixed(2)),
    trailingStop:  parseFloat(trailingStop.toFixed(2)),
    riskPct:       parseFloat(riskPct.toFixed(2)),
    rewardPct:     parseFloat(rewardPct.toFixed(2)),
    rrRatio:       parseFloat(rrRatio.toFixed(2)),
  }
}
