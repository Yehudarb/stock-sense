import { useMemo, useState } from 'react'
import { SIGNAL_BADGES } from '../../../../shared/constants'
import Badge from '../ui/Badge'
import FactorRow from './FactorRow'
import { fmtPrice } from '../../lib/formatters'
import { TRADER_TEXT } from '../../lib/traderColors'

const REGIME_LABEL = {
  he: { uptrend: 'מגמה עולה', downtrend: 'מגמה יורדת', sideways: 'שוק צדי', unknown: 'לא ידוע' },
  en: { uptrend: 'Uptrend', downtrend: 'Downtrend', sideways: 'Sideways', unknown: 'Unknown' },
}

const REGIME_COLOR = { uptrend: 'text-green-400', downtrend: 'text-red-400', sideways: 'text-yellow-400', unknown: 'text-slate-400' }

const ACTION_EN = {
  STRONG_BUY: 'Strong buy',
  BUY: 'Buy',
  HOLD: 'Hold',
  SELL: 'Sell',
  STRONG_SELL: 'Strong sell',
}

function formatPotential(value) {
  if (value == null || Number.isNaN(value)) return null
  return `${value > 0 ? '+' : ''}${value}%`
}

function formatGapStatus(status, fillPct, language) {
  if (language === 'en') {
    if (status === 'closed') return 'Closed'
    if (status === 'partial') return `Partially closed ${fillPct ?? 0}%`
    if (status === 'open') return 'Open'
    return '-'
  }
  if (status === 'closed') return 'נסגר'
  if (status === 'partial') return `נסגר חלקית ${fillPct ?? 0}%`
  if (status === 'open') return 'פתוח'
  return '-'
}

function GateRow({ label, passed, detail }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-slate-500">{detail}</span>}
        <span className={passed ? 'text-green-400' : 'text-red-400'}>{passed ? 'Yes' : 'No'}</span>
      </div>
    </div>
  )
}

function Metric({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-black ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function decisionCopy(action, language) {
  if (language === 'en') {
    return {
      STRONG_BUY: ['Strong buy', 'A staged entry can be considered, with a clear stop and target.'],
      BUY: ['Buy', 'The direction is positive; prefer staged entries rather than chasing price.'],
      HOLD: ['Hold / wait', 'There is no clear edge for a new entry yet; existing positions should use a defined stop.'],
      SELL: ['Sell / reduce exposure', 'Technical risk is currently higher than reward; reducing exposure is preferable.'],
      STRONG_SELL: ['Strong sell', 'Negative pressure is significant; capital protection comes first.'],
    }[action] ?? ['Wait', 'There is no clear conclusion right now.']
  }
  return null
}

function englishReasons(decision) {
  return [
    decision.regime?.regime ? `Market regime: ${decision.regime.regime}.` : null,
    decision.proConfluence != null ? `Professional confluence is ${decision.proConfluence}%.` : null,
    decision.support != null ? `Nearest support is around ${fmtPrice(decision.support)}.` : null,
    decision.resistance != null ? `Nearest resistance is around ${fmtPrice(decision.resistance)}.` : null,
    decision.patternLabel ? `Leading pattern: ${decision.patternLabel}.` : null,
    decision.gapZone ? `Nearest open gap: ${decision.gapZone}.` : null,
  ].filter(Boolean).slice(0, 4)
}

function AnalystDecisionCard({ decision, language }) {
  if (!decision) return null
  const isEnglish = language === 'en'
  const toneClass = {
    bullish: 'glass-panel border-green-500/20',
    bearish: 'glass-panel border-red-500/20',
    neutral: 'glass-panel border-yellow-500/20',
  }[decision.tone] ?? 'glass-panel border-slate-500/20'
  const toneText = {
    bullish: TRADER_TEXT.bullish,
    bearish: TRADER_TEXT.bearish,
    neutral: TRADER_TEXT.neutral,
  }[decision.tone] ?? 'text-white'
  const en = decisionCopy(decision.action, language)
  const primaryAction = isEnglish ? en[0] : decision.primaryAction
  const headline = isEnglish ? en[1] : decision.headline
  const reasons = isEnglish ? englishReasons(decision) : decision.reasons
  const entryText = decision.entryLow != null && decision.entryHigh != null
    ? `${fmtPrice(decision.entryLow)} - ${fmtPrice(decision.entryHigh)}`
    : isEnglish ? 'No new entry' : 'ללא כניסה חדשה'
  const labels = {
    title: isEnglish ? 'Analyst conclusion' : 'מסקנת אנליסט',
    confidence: isEnglish ? 'Confidence' : 'ביטחון',
    currentPrice: isEnglish ? 'Current price' : 'מחיר נוכחי',
    entryZone: isEnglish ? 'Entry zone' : 'אזור כניסה',
    holdUntil: isEnglish ? 'Hold until' : 'יעד עבודה',
    sellBelow: isEnglish ? 'Sell below' : 'ביטול מתחת',
    patternTarget: isEnglish ? 'Pattern target' : 'יעד תבנית',
    patternPotential: isEnglish ? 'Pattern potential' : 'פוטנציאל תבנית',
    nearestGap: isEnglish ? 'Nearest gap' : 'גאפ קרוב',
    why: isEnglish ? 'Why' : 'למה',
    upside: isEnglish ? 'upside' : 'פוטנציאל',
    risk: isEnglish ? 'risk' : 'סיכון',
  }

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-400">{labels.title}</div>
          <div className={`mt-1 text-lg font-black ${toneText}`}>{primaryAction}</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{headline}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">{labels.confidence}</div>
          <div className={`text-lg font-black ${toneText}`}>{decision.confidence}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label={labels.currentPrice} value={fmtPrice(decision.currentPrice)} />
        <Metric label={labels.entryZone} value={entryText} color={TRADER_TEXT.entry} />
        <Metric label={labels.holdUntil} value={fmtPrice(decision.holdUntil)} color={TRADER_TEXT.takeProfit} sub={decision.upsidePct != null ? `${decision.upsidePct}% ${labels.upside}` : null} />
        <Metric label={labels.sellBelow} value={fmtPrice(decision.invalidation)} color={TRADER_TEXT.stopLoss} sub={decision.downsidePct != null ? `${Math.abs(decision.downsidePct)}% ${labels.risk}` : null} />
        <Metric label="Take Profit" value={fmtPrice(decision.takeProfit)} color={TRADER_TEXT.takeProfit} />
        <Metric label="Trailing Stop" value={fmtPrice(decision.trailingStop)} color={TRADER_TEXT.neutral} />
        <Metric label="Support" value={fmtPrice(decision.support)} color={TRADER_TEXT.support} />
        <Metric label="Resistance" value={fmtPrice(decision.resistance)} color={TRADER_TEXT.resistance} />
        <Metric label="Pro Confluence" value={decision.proConfluence != null ? `${decision.proConfluence}%` : '-'} color="text-blue-300" />
        <Metric label="Regime" value={decision.regime?.regime ?? '-'} color="text-slate-200" sub={decision.regime?.volatilityPct != null ? `Volatility ${decision.regime.volatilityPct}%` : null} />
        <Metric label={labels.patternTarget} value={fmtPrice(decision.patternTarget)} color="text-purple-300" sub={decision.patternLabel ?? null} />
        <Metric label={labels.patternPotential} value={decision.patternPotentialPct != null ? formatPotential(decision.patternPotentialPct) : '-'} color={decision.patternPotentialPct == null ? 'text-slate-300' : decision.patternPotentialPct >= 0 ? TRADER_TEXT.takeProfit : TRADER_TEXT.stopLoss} />
        <Metric label={labels.nearestGap} value={decision.gapZone ?? '-'} color={decision.gapDirection === 'up' ? TRADER_TEXT.takeProfit : decision.gapDirection === 'down' ? TRADER_TEXT.stopLoss : 'text-slate-300'} sub={formatGapStatus(decision.gapStatus, decision.gapFillPct, language)} />
      </div>

      {reasons?.length > 0 && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">{labels.why}</div>
          <ul className="space-y-1">
            {reasons.map((reason, index) => <li key={index} className="text-xs leading-relaxed text-slate-300">{reason}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-slate-950 p-2 text-xs leading-relaxed text-slate-400">
        {isEnglish
          ? `${primaryAction}. Working target: ${fmtPrice(decision.holdUntil)}, protection: ${fmtPrice(decision.invalidation)}.`
          : decision.shortConclusion}
      </div>
    </div>
  )
}

function ProFeaturesCard({ pro, language }) {
  const isEnglish = language === 'en'
  if (!pro) return null
  const sr = pro.supportResistance
  const inst = pro.institutional
  const prof = pro.professional
  const gap = pro.gaps?.nearestOpen
  const labels = {
    title: isEnglish ? 'Professional layer' : 'שכבה מקצועית',
    support: isEnglish ? 'Nearest support' : 'תמיכה קרובה',
    resistance: isEnglish ? 'Nearest resistance' : 'התנגדות קרובה',
    regime: 'Market Regime',
    institution: isEnglish ? 'Institutional activity' : 'פעילות מוסדית',
    volumeSpikes: isEnglish ? 'volume spikes' : 'קפיצות נפח',
    notDetected: isEnglish ? 'Not detected' : 'לא זוהתה',
    openGaps: isEnglish ? 'Open gaps' : 'גאפים פתוחים',
    nearestGap: isEnglish ? 'Nearest gap' : 'גאפ קרוב',
    none: isEnglish ? 'None' : 'אין',
    open: isEnglish ? 'open' : 'פתוחים',
  }

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-400">{labels.title}</h4>
        <span className="text-xs font-bold text-blue-300">{prof.confluencePct}% {prof.confidenceLevel}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label={labels.support} value={fmtPrice(sr.nearestSupport)} color={TRADER_TEXT.support} />
        <Metric label={labels.resistance} value={fmtPrice(sr.nearestResistance)} color={TRADER_TEXT.resistance} />
        <Metric label={labels.regime} value={pro.marketRegime.regime} color="text-slate-200" />
        <Metric label={labels.institution} value={inst.institutionalBuying ? `${inst.spikeCount} ${labels.volumeSpikes}` : labels.notDetected} color={inst.institutionalBuying ? TRADER_TEXT.takeProfit : 'text-slate-400'} />
        <Metric label={labels.openGaps} value={pro.gaps?.openCount ? `${pro.gaps.openCount} ${labels.open}` : labels.none} color={pro.gaps?.openCount ? TRADER_TEXT.neutral : 'text-slate-400'} />
        <Metric label={labels.nearestGap} value={gap ? `$${gap.zoneLow}-${gap.zoneHigh}` : labels.none} color={gap ? TRADER_TEXT.resistance : 'text-slate-400'} sub={gap ? formatGapStatus(gap.status, gap.fillPct, language) : null} />
      </div>
      {prof.factors?.length > 0 && !isEnglish && (
        <div className="mt-3 border-t border-slate-700 pt-2">
          {prof.factors.map((factor, index) => <div key={index} className="py-0.5 text-xs text-slate-300">{factor}</div>)}
        </div>
      )}
    </div>
  )
}

function EnsembleCard({ ensemble, language }) {
  if (!ensemble) return null
  const isEnglish = language === 'en'
  const tone = {
    bullish: { label: isEnglish ? 'Bullish' : 'שורי', color: TRADER_TEXT.bullish, bg: 'glass-panel border-green-500/20', bar: '#22c55e' },
    bearish: { label: isEnglish ? 'Bearish' : 'דובי', color: TRADER_TEXT.bearish, bg: 'glass-panel border-red-500/20', bar: '#ef4444' },
    neutral: { label: isEnglish ? 'Mixed' : 'מעורב', color: TRADER_TEXT.neutral, bg: 'glass-panel border-yellow-500/20', bar: '#eab308' },
  }[ensemble.bias] ?? { label: isEnglish ? 'Mixed' : 'מעורב', color: TRADER_TEXT.neutral, bg: 'glass-panel border-yellow-500/20', bar: '#eab308' }

  return (
    <div className={`rounded-xl border p-4 ${tone.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-400">Ensemble v3</h4>
          <div className={`mt-1 text-lg font-black ${tone.color}`}>{tone.label}</div>
          <div className="mt-1 text-xs text-slate-400">
            {isEnglish
              ? `${ensemble.buyVotes}/${ensemble.totalModels} models vote buy · agreement ${ensemble.agreementPct}% · ${ensemble.confidence}`
              : `${ensemble.buyVotes}/${ensemble.totalModels} מודלים תומכים בקנייה · הסכמה ${ensemble.agreementPct}% · ${ensemble.confidence}`}
          </div>
        </div>
        <div className="rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">Probability</div>
          <div className={`text-lg font-black ${tone.color}`}>{ensemble.probabilityPct}%</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ensemble.probabilityPct}%`, backgroundColor: tone.bar }} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {ensemble.models.map(model => (
          <div key={model.key} className="rounded-lg bg-slate-950/70 p-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-200">{model.label}</span>
              <span className={model.vote === 'BUY' ? TRADER_TEXT.bullish : TRADER_TEXT.bearish}>
                {isEnglish ? (model.vote === 'BUY' ? 'Buy' : 'Sell') : (model.vote === 'BUY' ? 'קנייה' : 'מכירה')} · {Math.round(model.probability * 100)}%
              </span>
            </div>
            {!isEnglish && model.factors?.length > 0 && <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{model.factors.join(' · ')}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function PatternBadge({ pattern, language }) {
  const isEnglish = language === 'en'
  const directionLabel = {
    bullish: isEnglish ? 'Bullish' : 'שורית',
    bearish: isEnglish ? 'Bearish' : 'דובית',
    neutral: isEnglish ? 'Neutral' : 'ניטרלית',
  }[pattern.direction] ?? (isEnglish ? 'Unknown' : 'לא ידוע')
  const statusLabel = {
    confirmed: isEnglish ? 'Confirmed' : 'מאושרת',
    developing: isEnglish ? 'Developing' : 'מתפתחת',
  }[pattern.status] ?? pattern.status
  const tone = pattern.direction === 'neutral' || pattern.weight === 0
    ? 'glass-panel border-yellow-500/20 text-yellow-300'
    : pattern.weight > 0 ? 'glass-panel border-green-500/20 text-green-300' : 'glass-panel border-red-500/20 text-red-300'

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${tone}`}>
      <div className="font-bold">{pattern.label}</div>
      <div className="mt-1 text-[11px] opacity-80">
        {directionLabel} · {statusLabel} · {isEnglish ? 'Score' : 'ניקוד'} {pattern.weight > 0 ? '+' : ''}{pattern.weight}
      </div>
      {pattern.targetPrice != null && (
        <div className="mt-1 text-[11px] opacity-90">
          {isEnglish ? 'Target' : 'יעד'}: {fmtPrice(pattern.targetPrice)}
          {pattern.potentialPct != null ? ` (${formatPotential(pattern.potentialPct)})` : ''}
        </div>
      )}
    </div>
  )
}

function DetailTab({ signal, gates, patterns, risk, copy, isEnglish, language }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{copy.signalTitle}</h3>
          <Badge action={signal.action} label={isEnglish ? ACTION_EN[signal.action] ?? signal.action : SIGNAL_BADGES[signal.action]} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>{copy.confidence}</span>
            <span>{signal.confidence}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-700 sm:h-2 md:h-3">
            <div className="h-1 rounded-full transition-all duration-500 sm:h-2 md:h-3" style={{ width: `${signal.confidence}%`, backgroundColor: signal.score >= 0 ? '#22c55e' : '#ef4444' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-green-950 p-2 text-center">
            <div className="mb-0.5 text-xs text-green-400">{copy.buyProbability}</div>
            <div className="text-lg font-bold text-green-300">{signal.buyProbability}%</div>
          </div>
          <div className="rounded-lg bg-red-950 p-2 text-center">
            <div className="mb-0.5 text-xs text-red-400">{copy.sellProbability}</div>
            <div className="text-lg font-bold text-red-300">{signal.sellProbability}%</div>
          </div>
        </div>
      </div>

      {gates && (
        <div className="glass-panel rounded-xl p-4">
          <h4 className="mb-2 text-xs font-bold text-slate-400">{copy.pipeline}</h4>
          <div className="mb-2 border-b border-slate-700 pb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{copy.marketTrend}</span>
              <span className={REGIME_COLOR[gates.trend?.regime] ?? 'text-slate-400'}>
                {REGIME_LABEL[language]?.[gates.trend?.regime] ?? '-'} ({gates.trend?.strength ?? 0}%)
              </span>
            </div>
          </div>
          <GateRow label={copy.trendGate} passed={gates.trend?.passed} detail={gates.trend?.passed ? copy.passed : copy.blocked} />
          <GateRow label={copy.buyConfluence} passed={gates.confluence?.passed} detail={`${gates.confluence?.active ?? 0}/${gates.confluence?.total ?? 0} ${copy.aligned}`} />
          <GateRow
            label={copy.bullishReversal}
            passed={gates.reversal?.passed}
            detail={gates.reversal?.trigger === 'both' ? copy.candleVolume : gates.reversal?.trigger === 'bullish_candle' ? copy.bullishCandle : copy.notConfirmed}
          />
        </div>
      )}

      <div className="glass-panel rounded-xl p-4">
        <h4 className="mb-2 text-xs font-bold text-slate-400">{copy.indicators}</h4>
        {signal.factors.map((f, i) => <FactorRow key={i} label={f.label} signal={f.signal} value={f.value} language={language} />)}
      </div>

      {patterns?.patterns?.length > 0 && (
        <div className="glass-panel rounded-xl p-4">
          <h4 className="mb-2 text-xs font-bold text-slate-400">{copy.patterns} ({patterns.patterns.length})</h4>
          {patterns.best && (
            <div className="mb-3 rounded-lg border border-blue-900 bg-blue-950/40 p-2 text-xs text-blue-200">
              {copy.leadingPattern}: <span className="font-bold">{patterns.best.label}</span>
              {patterns.best.targetPrice != null && <span> · {isEnglish ? 'Estimated target' : 'יעד משוער'} {fmtPrice(patterns.best.targetPrice)} · {formatPotential(patterns.best.potentialPct)}</span>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            {patterns.patterns.map((p, i) => <PatternBadge key={i} pattern={p} language={language} />)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {copy.patternScore}: <span className={patterns.score >= 0 ? 'text-green-400' : 'text-red-400'}>{patterns.score > 0 ? '+' : ''}{patterns.score}</span>
          </div>
        </div>
      )}

      {risk && (
        <div className="glass-panel rounded-xl p-4">
          <h4 className="mb-2 text-xs font-bold text-slate-400">{copy.risk} (ATR={risk.atr})</h4>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Stop Loss</span><span className="font-mono text-red-400">${risk.stopLoss} <span className="text-slate-500">(-{risk.riskPct}%)</span></span></div>
            <div className="flex justify-between"><span className="text-slate-400">Take Profit</span><span className="font-mono text-green-400">${risk.takeProfit} <span className="text-slate-500">(+{risk.rewardPct}%)</span></span></div>
            <div className="flex justify-between"><span className="text-slate-400">Trailing Stop</span><span className="font-mono text-yellow-400">${risk.trailingStop}</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-700 pt-1"><span className="text-slate-400">{copy.riskReward}</span><span className={risk.rrRatio >= 1.5 ? 'text-green-400' : 'text-yellow-400'}>1:{risk.rrRatio}</span></div>
          </div>
        </div>
      )}

      {signal.analysis && (
        <div className="glass-panel rounded-xl p-4">
          <h4 className="mb-2 text-xs font-bold text-slate-400">{copy.analysis}</h4>
          <p className="text-sm leading-relaxed text-slate-300">{signal.analysis}</p>
        </div>
      )}
    </div>
  )
}

export default function SignalPanel({ signal, language = 'he' }) {
  const [activeTab, setActiveTab] = useState('Decision')
  const isEnglish = language === 'en'

  const copy = {
    loading: isEnglish ? 'Loading analysis...' : 'טוען ניתוח...',
    signalTitle: isEnglish ? 'Trading signal' : 'אות מסחר',
    confidence: isEnglish ? 'Confidence' : 'ביטחון',
    buyProbability: isEnglish ? 'Buy probability' : 'הסתברות קנייה',
    sellProbability: isEnglish ? 'Sell probability' : 'הסתברות מכירה',
    pipeline: isEnglish ? 'Pipeline gates' : 'שערי Pipeline',
    marketTrend: isEnglish ? 'Market trend' : 'מגמת שוק',
    trendGate: isEnglish ? 'Trend gate' : 'שער מגמה',
    passed: isEnglish ? 'Passed' : 'עבר',
    blocked: isEnglish ? 'Blocked' : 'חסום',
    buyConfluence: isEnglish ? 'Buy confluence' : 'Confluence קנייה',
    bullishReversal: isEnglish ? 'Bullish reversal' : 'אישור היפוך שורי',
    aligned: isEnglish ? 'aligned' : 'מיושרים',
    candleVolume: isEnglish ? 'Candle + volume' : 'נר + נפח',
    bullishCandle: isEnglish ? 'Bullish candle' : 'נר שורי',
    notConfirmed: isEnglish ? 'Not confirmed' : 'לא אושר',
    indicators: isEnglish ? 'Indicators' : 'אינדיקטורים',
    patterns: isEnglish ? 'Chart patterns' : 'תבניות גרפיות',
    leadingPattern: isEnglish ? 'Leading pattern' : 'תבנית מובילה',
    patternScore: isEnglish ? 'Pattern score' : 'ניקוד תבניות',
    risk: isEnglish ? 'Risk management' : 'ניהול סיכונים',
    riskReward: isEnglish ? 'Risk/reward ratio' : 'יחס סיכוי/סיכון',
    analysis: isEnglish ? 'Analysis' : 'ניתוח',
  }

  const tabs = useMemo(() => ([
    { key: 'Decision', label: isEnglish ? 'Decision' : 'החלטה' },
    { key: 'Ensemble', label: 'Ensemble' },
    { key: 'Professional', label: isEnglish ? 'Professional' : 'מקצועי' },
    { key: 'Details', label: isEnglish ? 'Details' : 'פרטים' },
  ]), [isEnglish])

  if (!signal) {
    return <div className="glass-panel rounded-xl p-4 text-center text-sm text-slate-500">{copy.loading}</div>
  }

  const { gates, patterns, risk, decision, pro, ensemble } = signal

  return (
    <div className="glass-panel rounded-2xl p-4" dir={isEnglish ? 'ltr' : 'rtl'}>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-primary/15 text-white ring-1 ring-primary/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'Decision' && <AnalystDecisionCard decision={decision} language={language} />}
      {activeTab === 'Ensemble' && <EnsembleCard ensemble={ensemble} language={language} />}
      {activeTab === 'Professional' && <ProFeaturesCard pro={pro} language={language} />}
      {activeTab === 'Details' && (
        <DetailTab
          signal={signal}
          gates={gates}
          patterns={patterns}
          risk={risk}
          copy={copy}
          isEnglish={isEnglish}
          language={language}
        />
      )}
    </div>
  )
}
