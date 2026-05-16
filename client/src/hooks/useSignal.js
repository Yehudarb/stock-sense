import { useMemo } from 'react'
import { computeSignal } from '../lib/signals'
import { generateAnalysis } from '../lib/hebrewAnalysis'
import { detectPatterns } from '../lib/patterns'
import { computeRisk } from '../lib/riskManagement'
import { computeAnalystDecision } from '../lib/analystDecision'
import { computeProfessionalFeatures } from '../lib/professionalFeatures'
import { computeEnsembleConsensus } from '../lib/ensembleConsensus'
import { analyzeAdvancedTrends } from '../lib/advancedTrends'

export default function useSignal(ohlcv, indicators, language = 'he') {
  return useMemo(() => {
    if (!ohlcv?.length || !indicators) return null
    const patternResult = detectPatterns(ohlcv)
    const signal        = computeSignal(ohlcv, indicators, patternResult.score)
    if (!signal) return null
    const analysis = generateAnalysis(ohlcv, indicators, signal, patternResult, language)
    const pro      = computeProfessionalFeatures(ohlcv, indicators, signal)
    const risk     = computeRisk(ohlcv, indicators, {
      nearestSupport: pro?.supportResistance?.nearestSupport ?? null,
      nearestResistance: pro?.supportResistance?.nearestResistance ?? null,
      patternInvalidation: patternResult?.best?.invalidationLevel ?? null,
    })
    const ensemble = computeEnsembleConsensus(ohlcv, indicators, { ...signal, pro, patterns: patternResult })
    const decision = computeAnalystDecision(ohlcv, indicators, { ...signal, pro, patterns: patternResult, ensemble }, risk, language)
    const trends   = analyzeAdvancedTrends(ohlcv, indicators)
    return { ...signal, analysis, patterns: patternResult, risk, decision, pro, ensemble, trends }
  }, [ohlcv, indicators, language])
}
