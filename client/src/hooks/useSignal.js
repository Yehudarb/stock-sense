import { useMemo } from 'react'
import { computeSignal } from '../lib/signals'
import { generateAnalysis } from '../lib/hebrewAnalysis'
import { detectPatterns } from '../lib/patterns'
import { computeRisk } from '../lib/riskManagement'
import { computeAnalystDecision } from '../lib/analystDecision'
import { computeProfessionalFeatures } from '../lib/professionalFeatures'
import { computeEnsembleConsensus } from '../lib/ensembleConsensus'
import { analyzeAdvancedTrends } from '../lib/advancedTrends'
import { computeAll } from '../lib/indicators'
import { getClosedAnalysisBars } from '../lib/analysisBars'

export default function useSignal(ohlcv, indicators, language = 'he', multiTimeframe = null, interval = '1d') {
  return useMemo(() => {
    if (!ohlcv?.length || !indicators) return null
    const barContext = getClosedAnalysisBars(ohlcv, interval)
    if (barContext.bars.length < 30) return null
    const analysisBars = barContext.bars
    const analysisIndicators = barContext.excludedLiveBar ? computeAll(analysisBars, interval) : indicators
    if (!analysisIndicators) return null
    const patternResult = detectPatterns(analysisBars)
    // Pass the full result — computeSignal now needs the pattern LIST (not just
    // the aggregate score) to apply setup-override logic that keeps a valid
    // bullish base from being SOLD out of because its handle looks weak.
    // Multi-timeframe context, when available, lets the pipeline enforce
    // higher-timeframe alignment: don't buy the intraday breakout against a
    // weekly downtrend, and don't short the daily bounce against a weekly rally.
    const signal        = computeSignal(analysisBars, analysisIndicators, patternResult, multiTimeframe)
    if (!signal) return null
    const analysis = generateAnalysis(analysisBars, analysisIndicators, signal, patternResult, language)
    const pro      = computeProfessionalFeatures(analysisBars, analysisIndicators, signal)
    const risk     = computeRisk(analysisBars, analysisIndicators, {
      nearestSupport: pro?.supportResistance?.nearestSupport ?? null,
      nearestResistance: pro?.supportResistance?.nearestResistance ?? null,
      patternInvalidation: patternResult?.best?.invalidationLevel ?? null,
    })
    const ensemble = computeEnsembleConsensus(analysisBars, analysisIndicators, { ...signal, pro, patterns: patternResult })
    const decision = computeAnalystDecision(analysisBars, analysisIndicators, { ...signal, pro, patterns: patternResult, ensemble }, risk, language)
    const trends   = analyzeAdvancedTrends(analysisBars, analysisIndicators)
    return { ...signal, analysis, patterns: patternResult, risk, decision, pro, ensemble, trends, barContext }
  }, [ohlcv, indicators, language, multiTimeframe, interval])
}
