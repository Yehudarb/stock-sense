import { SIGNAL_BADGES } from '../../../../shared/constants'
import Badge from '../ui/Badge'
import FactorRow from './FactorRow'
import { fmtPrice } from '../../lib/formatters'

const REGIME_HE = { uptrend: 'מגמה עולה', downtrend: 'מגמה יורדת', sideways: 'שוק צדדי', unknown: 'לא ידוע' }
const REGIME_COLOR = { uptrend: 'text-green-400', downtrend: 'text-red-400', sideways: 'text-yellow-400', unknown: 'text-slate-400' }

function GateRow({ label, passed, detail }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-slate-500">{detail}</span>}
        <span className={passed ? 'text-green-400' : 'text-red-400'}>{passed ? '✓' : '✗'}</span>
      </div>
    </div>
  )
}

function formatPotential(value) {
  if (value == null || Number.isNaN(value)) return null
  return `${value > 0 ? '+' : ''}${value}%`
}

function formatGapStatus(status, fillPct) {
  if (status === 'closed') return 'נסגר'
  if (status === 'partial') return `נסגר חלקית ${fillPct ?? 0}%`
  if (status === 'open') return 'פתוח'
  return '-'
}

function patternTone(pattern) {
  if (pattern.direction === 'neutral' || pattern.weight === 0) {
    return 'bg-yellow-950 text-yellow-300 border-yellow-800'
  }
  return pattern.weight > 0
    ? 'bg-green-950 text-green-300 border-green-800'
    : 'bg-red-950 text-red-300 border-red-800'
}

function PatternBadge({ pattern }) {
  const directionLabel = {
    bullish: 'שורית',
    bearish: 'דובית',
    neutral: 'ניטרלית',
  }[pattern.direction] ?? 'לא ידוע'

  const statusLabel = {
    confirmed: 'מאושרת',
    developing: 'מתפתחת',
  }[pattern.status] ?? pattern.status

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${patternTone(pattern)}`}>
      <div className="font-bold">{pattern.label}</div>
      <div className="mt-1 text-[11px] opacity-80">
        {directionLabel} · {statusLabel} · ניקוד {pattern.weight > 0 ? '+' : ''}{pattern.weight}
      </div>
      {pattern.targetPrice != null && (
        <div className="mt-1 text-[11px] opacity-90">
          יעד: {fmtPrice(pattern.targetPrice)}
          {pattern.potentialPct != null ? ` (${formatPotential(pattern.potentialPct)})` : ''}
        </div>
      )}
    </div>
  )
}

function DecisionMetric({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-lg bg-slate-900 p-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function AnalystDecisionCard({ decision }) {
  if (!decision) return null

  const toneClass = {
    bullish: 'border-green-700 bg-green-950/40',
    bearish: 'border-red-700 bg-red-950/40',
    neutral: 'border-yellow-700 bg-yellow-950/30',
  }[decision.tone] ?? 'border-slate-700 bg-slate-900'

  const toneText = {
    bullish: 'text-green-300',
    bearish: 'text-red-300',
    neutral: 'text-yellow-300',
  }[decision.tone] ?? 'text-white'

  const entryText = decision.entryLow != null && decision.entryHigh != null
    ? `${fmtPrice(decision.entryLow)} - ${fmtPrice(decision.entryHigh)}`
    : 'לא כניסה חדשה'

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-400">מסקנת אנליסט</div>
          <div className={`mt-1 text-lg font-black ${toneText}`}>{decision.primaryAction}</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{decision.headline}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">ביטחון</div>
          <div className={`text-lg font-black ${toneText}`}>{decision.confidence}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <DecisionMetric label="מחיר נוכחי" value={fmtPrice(decision.currentPrice)} />
        <DecisionMetric label="אזור קנייה" value={entryText} color="text-green-300" />
        <DecisionMetric label="להחזיק עד" value={fmtPrice(decision.holdUntil)} color="text-green-300" sub={decision.upsidePct != null ? `${decision.upsidePct}% פוטנציאל` : null} />
        <DecisionMetric label="למכור מתחת" value={fmtPrice(decision.invalidation)} color="text-red-300" sub={decision.downsidePct != null ? `${Math.abs(decision.downsidePct)}% סיכון` : null} />
        <DecisionMetric label="Take Profit" value={fmtPrice(decision.takeProfit)} color="text-green-400" />
        <DecisionMetric label="Trailing Stop" value={fmtPrice(decision.trailingStop)} color="text-yellow-300" />
        <DecisionMetric label="Support" value={fmtPrice(decision.support)} color="text-cyan-300" />
        <DecisionMetric label="Resistance" value={fmtPrice(decision.resistance)} color="text-orange-300" />
        <DecisionMetric label="Pro Confluence" value={decision.proConfluence != null ? `${decision.proConfluence}%` : '-'} color="text-blue-300" />
        <DecisionMetric label="Regime" value={decision.regime?.regime ?? '-'} color="text-slate-200" sub={decision.regime?.volatilityPct != null ? `Volatility ${decision.regime.volatilityPct}%` : null} />
        <DecisionMetric label="יעד לפי תבנית" value={fmtPrice(decision.patternTarget)} color="text-purple-300" sub={decision.patternLabel ?? null} />
        <DecisionMetric
          label="פוטנציאל תבנית"
          value={decision.patternPotentialPct != null ? formatPotential(decision.patternPotentialPct) : '-'}
          color={decision.patternPotentialPct == null ? 'text-slate-300' : decision.patternPotentialPct >= 0 ? 'text-green-300' : 'text-red-300'}
        />
        <DecisionMetric
          label="גאפ קרוב"
          value={decision.gapZone ?? '-'}
          color={decision.gapDirection === 'up' ? 'text-green-300' : decision.gapDirection === 'down' ? 'text-red-300' : 'text-slate-300'}
          sub={formatGapStatus(decision.gapStatus, decision.gapFillPct)}
        />
      </div>

      {decision.reasons?.length > 0 && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">למה</div>
          <ul className="space-y-1">
            {decision.reasons.map((reason, index) => (
              <li key={index} className="text-xs leading-relaxed text-slate-300">{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-slate-950 p-2 text-xs leading-relaxed text-slate-400">
        {decision.shortConclusion}
      </div>
    </div>
  )
}

function ProFeaturesCard({ pro }) {
  if (!pro) return null
  const sr = pro.supportResistance
  const inst = pro.institutional
  const prof = pro.professional
  const gap = pro.gaps?.nearestOpen

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-400">Professional Layer</h4>
        <span className="text-xs font-bold text-blue-300">{prof.confluencePct}% {prof.confidenceLevel}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-slate-500">תמיכה קרובה</div>
          <div className="font-bold text-cyan-300">{fmtPrice(sr.nearestSupport)}</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-slate-500">התנגדות קרובה</div>
          <div className="font-bold text-orange-300">{fmtPrice(sr.nearestResistance)}</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-slate-500">Market Regime</div>
          <div className="font-bold text-slate-200">{pro.marketRegime.regime}</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-slate-500">פעילות מוסדית</div>
          <div className={inst.institutionalBuying ? 'font-bold text-green-300' : 'font-bold text-slate-400'}>
            {inst.institutionalBuying ? `${inst.spikeCount} קפיצות נפח` : 'לא זוהתה'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-slate-500">גאפים פתוחים</div>
          <div className={pro.gaps?.openCount ? 'font-bold text-yellow-300' : 'font-bold text-slate-400'}>
            {pro.gaps?.openCount ? `${pro.gaps.openCount} פתוחים` : 'אין'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-slate-500">גאפ קרוב</div>
          <div className={gap ? 'font-bold text-orange-300' : 'font-bold text-slate-400'}>
            {gap ? `$${gap.zoneLow}-${gap.zoneHigh}` : 'אין'}
          </div>
          {gap && <div className="mt-0.5 text-[11px] text-slate-500">{formatGapStatus(gap.status, gap.fillPct)}</div>}
        </div>
      </div>
      {prof.factors?.length > 0 && (
        <div className="mt-3 border-t border-slate-700 pt-2">
          {prof.factors.map((factor, index) => (
            <div key={index} className="py-0.5 text-xs text-slate-300">{factor}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function EnsembleCard({ ensemble }) {
  if (!ensemble) return null

  const tone = {
    bullish: {
      label: 'בוליש',
      color: 'text-green-300',
      bg: 'bg-green-950/35 border-green-800',
      bar: '#22c55e',
    },
    bearish: {
      label: 'בריש',
      color: 'text-red-300',
      bg: 'bg-red-950/35 border-red-800',
      bar: '#ef4444',
    },
    neutral: {
      label: 'מעורב',
      color: 'text-yellow-300',
      bg: 'bg-yellow-950/35 border-yellow-800',
      bar: '#eab308',
    },
  }[ensemble.bias] ?? {
    label: 'מעורב',
    color: 'text-yellow-300',
    bg: 'bg-yellow-950/35 border-yellow-800',
    bar: '#eab308',
  }

  return (
    <div className={`rounded-xl border p-4 ${tone.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-400">Ensemble v3</h4>
          <div className={`mt-1 text-lg font-black ${tone.color}`}>{tone.label}</div>
          <div className="mt-1 text-xs text-slate-400">
            {ensemble.buyVotes}/{ensemble.totalModels} מודלים מצביעים קנייה · הסכמה {ensemble.agreementPct}% · {ensemble.confidence}
          </div>
        </div>
        <div className="rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">Probability</div>
          <div className={`text-lg font-black ${tone.color}`}>{ensemble.probabilityPct}%</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${ensemble.probabilityPct}%`, backgroundColor: tone.bar }}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        {ensemble.models.map(model => (
          <div key={model.key} className="rounded-lg bg-slate-950/70 p-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-200">{model.label}</span>
              <span className={model.vote === 'BUY' ? 'text-green-300' : 'text-red-300'}>
                {model.vote === 'BUY' ? 'קנייה' : 'מכירה'} · {Math.round(model.probability * 100)}%
              </span>
            </div>
            {model.factors?.length > 0 && (
              <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {model.factors.join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-slate-950/70 p-2 text-[11px] leading-relaxed text-slate-500">
        שכבת Ensemble זו מחקה את רעיון v3 מהקבצים: כמה מודלים אנליטיים מצביעים יחד. זה אינו מודל Python מאומן, אלא קונצנזוס טכני חי בזמן אמת.
      </div>
    </div>
  )
}

export default function SignalPanel({ signal, language = 'he' }) {
  const isHebrew = language === 'he'
  const copy = {
    loading: isHebrew ? 'טוען ניתוח...' : 'Loading analysis...',
    signalTitle: isHebrew ? 'אות מסחר' : 'Trading signal',
    confidence: isHebrew ? 'ביטחון' : 'Confidence',
    buyProbability: isHebrew ? 'הסתברות קנייה' : 'Buy probability',
    sellProbability: isHebrew ? 'הסתברות מכירה' : 'Sell probability',
    pipeline: isHebrew ? 'שערי Pipeline' : 'Pipeline gates',
    marketTrend: isHebrew ? 'מגמת שוק' : 'Market trend',
    trendGate: isHebrew ? 'שער מגמה' : 'Trend gate',
    passed: isHebrew ? 'עבר' : 'Passed',
    blocked: isHebrew ? 'חסום' : 'Blocked',
    buyConfluence: isHebrew ? 'Confluence קנייה' : 'Buy confluence',
    bullishReversal: isHebrew ? 'אישור היפוך בולישי' : 'Bullish reversal',
    indicators: isHebrew ? 'אינדיקטורים' : 'Indicators',
    patterns: isHebrew ? 'תבניות גרפיות' : 'Chart patterns',
    patternLead: isHebrew ? 'תבנית מובילה' : 'Leading pattern',
    patternScore: isHebrew ? 'ניקוד תבניות' : 'Pattern score',
    risk: isHebrew ? 'ניהול סיכונים' : 'Risk management',
    analysis: isHebrew ? 'ניתוח' : 'Analysis',
  }
  if (!signal) return (
    <div className="bg-slate-800 rounded-xl p-4 text-slate-500 text-center text-sm">
      {copy.loading}
    </div>
  )

  const { gates, patterns, risk, decision, pro, ensemble } = signal

  return (
    <div className="flex flex-col gap-3" dir={isHebrew ? 'rtl' : 'ltr'}>
      <AnalystDecisionCard decision={decision} />
      <EnsembleCard ensemble={ensemble} />
      <ProFeaturesCard pro={pro} />

      {/* ── Main Signal Card ── */}
      <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{copy.signalTitle}</h3>
          <Badge action={signal.action} label={SIGNAL_BADGES[signal.action]} />
        </div>

        {/* Confidence bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{copy.confidence}</span>
            <span>{signal.confidence}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${signal.confidence}%`,
                backgroundColor: signal.score >= 0 ? '#22c55e' : '#ef4444',
              }} />
          </div>
        </div>

        {/* Buy / Sell probability */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-950 rounded-lg p-2 text-center">
            <div className="text-xs text-green-400 mb-0.5">{copy.buyProbability}</div>
            <div className="text-lg font-bold text-green-300">{signal.buyProbability}%</div>
          </div>
          <div className="bg-red-950 rounded-lg p-2 text-center">
            <div className="text-xs text-red-400 mb-0.5">{copy.sellProbability}</div>
            <div className="text-lg font-bold text-red-300">{signal.sellProbability}%</div>
          </div>
        </div>
      </div>

      {/* ── Pipeline Gates ── */}
      {gates && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-400 mb-2">{copy.pipeline}</h4>
          <div className="border-b border-slate-700 pb-2 mb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{copy.marketTrend}</span>
              <span className={REGIME_COLOR[gates.trend?.regime] ?? 'text-slate-400'}>
                {REGIME_HE[gates.trend?.regime] ?? '—'} ({gates.trend?.strength ?? 0}%)
              </span>
            </div>
          </div>
          <GateRow label={copy.trendGate} passed={gates.trend?.passed}
            detail={gates.trend?.passed ? copy.passed : copy.blocked} />
          <GateRow label={copy.buyConfluence}
            passed={gates.confluence?.passed}
            detail={`${gates.confluence?.active ?? 0}/${gates.confluence?.total ?? 0} מיושרים`} />
          <GateRow label={copy.bullishReversal}
            passed={gates.reversal?.passed}
            detail={gates.reversal?.trigger === 'both' ? 'נר + נפח' : gates.reversal?.trigger === 'bullish_candle' ? 'נר בולישי' : 'לא אושר'} />
        </div>
      )}

      {/* ── Indicator Factors ── */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-400 mb-2">{copy.indicators}</h4>
        {signal.factors.map((f, i) => (
          <FactorRow key={i} label={f.label} signal={f.signal} value={f.value} />
        ))}
      </div>

      {/* ── Detected Patterns ── */}
      {patterns?.patterns?.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-400 mb-2">{copy.patterns} ({patterns.patterns.length})</h4>
          {patterns.best && (
            <div className="mb-3 rounded-lg border border-blue-900 bg-blue-950/40 p-2 text-xs text-blue-200">
              {copy.patternLead}: <span className="font-bold">{patterns.best.label}</span>
              {patterns.best.targetPrice != null && (
                <span> · יעד משוער {fmtPrice(patterns.best.targetPrice)} · {formatPotential(patterns.best.potentialPct)}</span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            {patterns.patterns.map((p, i) => (
              <PatternBadge key={i} pattern={p} />
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {copy.patternScore}: <span className={patterns.score >= 0 ? 'text-green-400' : 'text-red-400'}>
              {patterns.score > 0 ? '+' : ''}{patterns.score}
            </span>
          </div>
        </div>
      )}

      {/* ── Risk Management ── */}
      {risk && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-400 mb-2">{copy.risk} (ATR={risk.atr})</h4>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Stop Loss</span>
              <span className="text-red-400 font-mono">${risk.stopLoss} <span className="text-slate-500">(-{risk.riskPct}%)</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Take Profit</span>
              <span className="text-green-400 font-mono">${risk.takeProfit} <span className="text-slate-500">(+{risk.rewardPct}%)</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Trailing Stop</span>
              <span className="text-yellow-400 font-mono">${risk.trailingStop}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
              <span className="text-slate-400">יחס סיכון/תשואה</span>
              <span className={risk.rrRatio >= 1.5 ? 'text-green-400' : 'text-yellow-400'} >1:{risk.rrRatio}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hebrew Analysis ── */}
      {signal.analysis && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-400 mb-2">{copy.analysis}</h4>
          <p className="text-sm text-slate-300 leading-relaxed">{signal.analysis}</p>
        </div>
      )}
    </div>
  )
}
