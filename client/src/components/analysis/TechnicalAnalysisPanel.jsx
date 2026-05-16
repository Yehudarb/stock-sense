import { useState } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import LoadingState from '../ui/LoadingState'

function ScoreTile({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'text-white',
    positive: 'text-emerald-200',
    danger: 'text-rose-200',
    warning: 'text-amber-100',
  }[tone] ?? 'text-white'

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 backdrop-blur-md">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-black tracking-tight ${toneClass}`}>{value}</div>
    </div>
  )
}

function TableCell({ children, className = '' }) {
  return <td className={`px-3 py-3 text-sm text-slate-300 ${className}`}>{children}</td>
}

function FrameTable({ timeframes }) {
  const rows = [
    ['Daily', timeframes.daily],
    ['Weekly', timeframes.weekly],
    ['Monthly', timeframes.monthly],
    ['4H', timeframes.h4],
  ].filter(([, value]) => value)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <th className="px-3 py-2">Timeframe</th>
            <th className="px-3 py-2">Trend</th>
            <th className="px-3 py-2">Momentum</th>
            <th className="px-3 py-2">Support</th>
            <th className="px-3 py-2">Resistance</th>
            <th className="px-3 py-2">Breakout / Breakdown</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, frame]) => (
            <tr key={label} className="rounded-2xl border border-white/6 bg-slate-950/35">
              <TableCell className="font-semibold text-white">{label}</TableCell>
              <TableCell><Badge sentiment={frame.trend}>{frame.trend}</Badge></TableCell>
              <TableCell><Badge sentiment={frame.momentum}>{frame.momentum}</Badge></TableCell>
              <TableCell>{(frame.support ?? []).join(', ') || '-'}</TableCell>
              <TableCell>{(frame.resistance ?? []).join(', ') || '-'}</TableCell>
              <TableCell>
                {[...(frame.breakoutZones ?? []), ...(frame.breakdownZones ?? [])].join(', ') || '-'}
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PatternCard({ pattern }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white">{pattern.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge sentiment={pattern.direction}>{pattern.direction}</Badge>
            <Badge tone="balanced">{pattern.confidence}% confidence</Badge>
            <Badge tone="default">{pattern.category ?? 'Pattern'}</Badge>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>{pattern.timeframe ?? 'TF'} zone</div>
          <div className="mt-1 text-sm font-semibold text-slate-200">{pattern.priceZone}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{pattern.explanation}</p>
      <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <div>Breakout: {pattern.breakoutLevel ?? '-'}</div>
        <div>Invalidation: {pattern.invalidationLevel ?? pattern.invalidatedBelow ?? pattern.invalidatedAbove ?? '-'}</div>
        <div>Volume: {pattern.volumeConfirmed ? 'Confirmed' : 'Mixed'}</div>
        <div>Status: {pattern.status ?? 'Developing'}</div>
        {pattern.invalidatedBelow != null && <div>Invalidated below {pattern.invalidatedBelow}</div>}
        {pattern.invalidatedAbove != null && <div>Invalidated above {pattern.invalidatedAbove}</div>}
      </div>
    </div>
  )
}

function InterpretationCard({ item }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-white">{item.label}</div>
        <Badge tone={item.tone ?? 'balanced'}>{item.value}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{item.interpretation}</p>
    </div>
  )
}

function ContextCard({ title, tone = 'balanced', value, subtitle, rows = [] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-white">{title}</div>
        <Badge tone={tone}>{value}</Badge>
      </div>
      {subtitle && <p className="mt-3 text-sm leading-6 text-slate-300">{subtitle}</p>}
      {rows.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {rows.map(row => (
            <div key={row.label} className="rounded-xl border border-white/6 bg-slate-950/60 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{row.label}</div>
              <div className="mt-1 text-sm font-bold text-slate-100">{row.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TechnicalAnalysisPanel({ analysis, isLoading, error }) {
  if (isLoading && !analysis) {
    return (
      <LoadingState
        title="Building the technical engine view"
        subtitle="Scanning multiple timeframes, indicators, patterns, and volume confirmation."
        steps={[
          { label: 'Loading daily, weekly, monthly, and 4H bars', state: 'done' },
          { label: 'Computing technical indicators', state: 'active' },
          { label: 'Detecting patterns and key levels', state: 'queued' },
          { label: 'Scoring trend, momentum, volume, and risk', state: 'queued' },
        ]}
      />
    )
  }

  if (error && !analysis) {
    return (
      <Card tone="danger" className="rounded-3xl p-5">
        <div className="text-sm font-bold text-white">Technical analysis engine unavailable</div>
        <div className="mt-2 text-sm text-slate-300">{error}</div>
      </Card>
    )
  }

  if (!analysis) return null

  const [activeTab, setActiveTab] = useState('summary')

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'indicators', label: 'Indicators' },
    { id: 'structure', label: 'Structure' },
    { id: 'volume', label: 'Volume' },
  ]

  return (
    <Card className="overflow-hidden rounded-3xl border-white/10 p-0 shadow-2xl">
      <div className="border-b border-white/5 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0.52))] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Technical command deck</div>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{analysis.technicalSummary}</h3>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400">{analysis.finalTechnicalOutlook}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge sentiment={analysis.overallTechnicalBias}>{analysis.overallTechnicalBias}</Badge>
            <Badge tone="balanced">{analysis.technicalScore}/100 score</Badge>
            <Badge tone={analysis.riskAssessment.riskLevel === 'Low' ? 'positive' : analysis.riskAssessment.riskLevel === 'High' ? 'danger' : 'warning'}>
              {analysis.riskAssessment.riskLevel} risk
            </Badge>
          </div>
        </div>

        <div className="mt-8 flex w-fit gap-1 rounded-xl border border-white/5 bg-slate-950/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950/20 p-6">
        {activeTab === 'summary' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
              <ScoreTile label="Technical" value={analysis.technicalScore} tone="positive" />
              <ScoreTile label="Trend" value={analysis.trendScore} />
              <ScoreTile label="Momentum" value={analysis.momentumScore} />
              <ScoreTile label="Volatility" value={analysis.volatilityScore ?? '-'} />
              <ScoreTile label="Volume" value={analysis.volumeScore} />
              <ScoreTile label="Pattern" value={analysis.patternScore} />
              <ScoreTile label="Levels" value={analysis.levelsScore ?? '-'} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-5 backdrop-blur-md">
                <div className="text-sm font-bold text-white mb-4">Risk / Reward Profile</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-3">
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Risk Level</div>
                    <div className={`text-lg font-black ${analysis.riskAssessment.riskLevel === 'Low' ? 'text-emerald-400' : analysis.riskAssessment.riskLevel === 'High' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {analysis.riskAssessment.riskLevel}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-3">
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Stop Loss</div>
                    <div className="text-lg font-black text-white">{analysis.riskAssessment.stopLoss ?? '-'}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-3">
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Take Profit</div>
                    <div className="text-lg font-black text-white">{analysis.riskAssessment.takeProfit ?? '-'}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm leading-relaxed text-slate-300 italic border-l-2 border-primary/30 pl-4">
                  {analysis.riskAssessment.mainRisk}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/10 bg-amber-300/5 p-5 backdrop-blur-md">
                <div className="text-sm font-bold text-white mb-2">Technical Disclaimer</div>
                <p className="text-sm leading-relaxed text-amber-50/70">{analysis.disclaimer}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'indicators' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="text-sm font-bold text-white">Market Intelligence Interpretation</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {analysis.indicatorInterpretations.map(item => <InterpretationCard key={item.label} item={item} />)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-5 backdrop-blur-md">
                <div className="text-sm font-bold text-white mb-4">Indicator Snapshot</div>
                <div className="grid grid-cols-2 gap-3">
                  <ScoreTile label="RSI 14" value={analysis.indicators.rsi14 ?? '-'} />
                  <ScoreTile label="Stoch RSI" value={analysis.indicators.stochRsi ?? '-'} />
                  <ScoreTile label="ADX" value={analysis.indicators.adx ?? '-'} />
                  <ScoreTile label="MACD signal" value={analysis.indicators.macdSignal} tone={analysis.indicators.macdSignal === 'Bullish' ? 'positive' : 'danger'} />
                  <ScoreTile label="ATR" value={analysis.indicators.atrPct != null ? `${analysis.indicators.atr} / ${analysis.indicators.atrPct}%` : analysis.indicators.atr ?? '-'} />
                  <ScoreTile label="Price vs SMA200" value={analysis.indicators.priceVsSma200} tone={analysis.indicators.priceVsSma200 === 'Above' ? 'positive' : 'danger'} />
                  <ScoreTile label="VWAP" value={analysis.indicators.vwap ?? '-'} />
                  <ScoreTile label="OBV" value={analysis.indicators.obv ?? '-'} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ContextCard
                title="VWAP Context"
                tone={analysis.vwapContext?.signal === 'Bullish' ? 'positive' : analysis.vwapContext?.signal === 'Bearish' || analysis.vwapContext?.signal === 'Pressure' ? 'danger' : 'balanced'}
                value={analysis.vwapContext?.signal ?? 'Balanced'}
                subtitle={analysis.vwapContext?.comment}
                rows={[
                  { label: 'Position', value: analysis.vwapContext?.position ?? '-' },
                  { label: 'Slope', value: analysis.vwapContext?.slope ?? '-' },
                  { label: 'Distance', value: analysis.vwapContext?.distancePct != null ? `${analysis.vwapContext.distancePct}%` : '-' },
                  { label: 'Trend Agreement', value: analysis.vwapContext?.trendAgreement ?? '-' },
                ]}
              />
              <ContextCard
                title="Gap Context"
                tone={analysis.gapContext?.signal === 'Bullish' ? 'positive' : analysis.gapContext?.signal === 'Bearish' || analysis.gapContext?.signal === 'Caution' ? 'danger' : 'balanced'}
                value={analysis.gapContext?.signal ?? 'Neutral'}
                subtitle={analysis.gapContext?.comment}
                rows={[
                  { label: 'Alignment', value: analysis.gapContext?.alignment ?? '-' },
                  { label: 'Gap Type', value: analysis.gapContext?.nearestOpenGap?.type ?? analysis.gapContext?.latestGap?.type ?? '-' },
                  { label: 'Zone', value: analysis.gapContext?.nearestOpenGap ? `$${analysis.gapContext.nearestOpenGap.zoneLow} - $${analysis.gapContext.nearestOpenGap.zoneHigh}` : analysis.gapContext?.latestGap ? `$${analysis.gapContext.latestGap.zoneLow} - $${analysis.gapContext.latestGap.zoneHigh}` : '-' },
                  { label: 'Fill Status', value: analysis.gapContext?.nearestOpenGap ? `${analysis.gapContext.nearestOpenGap.status} ${analysis.gapContext.nearestOpenGap.fillPct ?? 0}%` : analysis.gapContext?.latestGap ? `${analysis.gapContext.latestGap.status} ${analysis.gapContext.latestGap.fillPct ?? 0}%` : '-' },
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 gap-6">
              <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-5 backdrop-blur-md">
                <div className="text-sm font-bold text-white mb-4">Multi-Timeframe Trend Agreement</div>
                <FrameTable timeframes={analysis.timeframes} />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-5 backdrop-blur-md">
                  <div className="text-sm font-bold text-white mb-4">Key Support & Resistance Levels</div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Support Zones</div>
                      <div className="text-sm leading-relaxed text-emerald-400 font-mono">{analysis.keyLevels.support.join(', ') || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Resistance Zones</div>
                      <div className="text-sm leading-relaxed text-rose-400 font-mono">{analysis.keyLevels.resistance.join(', ') || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Dynamic S/R</div>
                      <div className="text-sm leading-relaxed text-slate-300">{analysis.keyLevels.dynamicSupportResistance.join(', ') || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Breakout Targets</div>
                      <div className="text-sm leading-relaxed text-primary font-bold">{(analysis.keyLevels.breakoutLevels ?? []).join(', ') || '-'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-sm font-bold text-white">Detected Chart Patterns</div>
                  <div className="grid grid-cols-1 gap-4">
                    {analysis.patterns.length
                      ? analysis.patterns.map(pattern => <PatternCard key={`${pattern.name}-${pattern.priceZone}`} pattern={pattern} />)
                      : <div className="text-sm text-slate-500 p-8 border border-dashed border-white/5 rounded-2xl text-center italic">No high-conviction technical patterns detected.</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'volume' && (
          <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-6 backdrop-blur-md">
              <div className="text-sm font-bold text-white mb-6">Volume & Accumulation Analysis</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
                <ScoreTile label="Current Activity" value={analysis.volumeAnalysis.currentVsAverage} />
                <ScoreTile label="Signal Strength" value={analysis.volumeAnalysis.confirmation ? 'Confirmed' : 'Mixed'} tone={analysis.volumeAnalysis.confirmation ? 'positive' : 'warning'} />
                <ScoreTile label="Accumulation" value={analysis.volumeAnalysis.accumulation ? 'High' : 'Low'} tone={analysis.volumeAnalysis.accumulation ? 'positive' : 'default'} />
                <ScoreTile label="Distribution" value={analysis.volumeAnalysis.distribution ? 'High' : 'Low'} tone={analysis.volumeAnalysis.distribution ? 'danger' : 'default'} />
              </div>
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm leading-relaxed text-slate-200">{analysis.volumeAnalysis.comment}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
