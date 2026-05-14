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
    <div className="rounded-2xl border border-white/6 bg-slate-950/40 p-4">
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
    <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white">{pattern.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge sentiment={pattern.direction}>{pattern.direction}</Badge>
            <Badge tone="balanced">{pattern.confidence}% confidence</Badge>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Zone</div>
          <div className="mt-1 text-sm font-semibold text-slate-200">{pattern.priceZone}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{pattern.explanation}</p>
      <div className="mt-3 text-xs text-slate-500">
        {pattern.invalidatedBelow != null && <div>Invalidated below {pattern.invalidatedBelow}</div>}
        {pattern.invalidatedAbove != null && <div>Invalidated above {pattern.invalidatedAbove}</div>}
      </div>
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

  return (
    <Card className="rounded-3xl p-5 sm:p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">Technical Analysis Engine</div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{analysis.technicalSummary}</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{analysis.finalTechnicalOutlook}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge sentiment={analysis.overallTechnicalBias}>{analysis.overallTechnicalBias}</Badge>
            <Badge tone="balanced">{analysis.technicalScore}/100 technical score</Badge>
            <Badge tone={analysis.riskAssessment.riskLevel === 'Low' ? 'positive' : analysis.riskAssessment.riskLevel === 'High' ? 'danger' : 'warning'}>
              {analysis.riskAssessment.riskLevel} risk
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <ScoreTile label="Technical score" value={analysis.technicalScore} tone="positive" />
          <ScoreTile label="Trend score" value={analysis.trendScore} />
          <ScoreTile label="Momentum score" value={analysis.momentumScore} />
          <ScoreTile label="Volume score" value={analysis.volumeScore} />
          <ScoreTile label="Pattern score" value={analysis.patternScore} />
          <ScoreTile label="Risk / reward score" value={analysis.riskRewardScore} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
            <div className="text-sm font-bold text-white">Multi-timeframe map</div>
            <div className="mt-4">
              <FrameTable timeframes={analysis.timeframes} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
            <div className="text-sm font-bold text-white">Indicator snapshot</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ScoreTile label="RSI 14" value={analysis.indicators.rsi14 ?? '-'} />
              <ScoreTile label="MACD signal" value={analysis.indicators.macdSignal} tone={analysis.indicators.macdSignal === 'Bullish' ? 'positive' : 'danger'} />
              <ScoreTile label="ATR" value={analysis.indicators.atr ?? '-'} />
              <ScoreTile label="Price vs SMA200" value={analysis.indicators.priceVsSma200} tone={analysis.indicators.priceVsSma200 === 'Above' ? 'positive' : 'danger'} />
              <ScoreTile label="VWAP" value={analysis.indicators.vwap ?? '-'} />
              <ScoreTile label="OBV" value={analysis.indicators.obv ?? '-'} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
            <div className="text-sm font-bold text-white">Support / resistance map</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Support</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{analysis.keyLevels.support.join(', ') || '-'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Resistance</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{analysis.keyLevels.resistance.join(', ') || '-'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Dynamic levels</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{analysis.keyLevels.dynamicSupportResistance.join(', ') || '-'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Breakout / stop zones</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Breakout: {(analysis.keyLevels.breakoutLevels ?? []).join(', ') || '-'}<br />
                  Stop-loss danger: {(analysis.keyLevels.stopLossDangerZones ?? []).join(', ') || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
            <div className="text-sm font-bold text-white">Volume confirmation</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ScoreTile label="Current vs average" value={analysis.volumeAnalysis.currentVsAverage} />
              <ScoreTile label="Confirmation" value={analysis.volumeAnalysis.confirmation ? 'Confirmed' : 'Mixed'} tone={analysis.volumeAnalysis.confirmation ? 'positive' : 'warning'} />
              <ScoreTile label="Accumulation" value={analysis.volumeAnalysis.accumulation ? 'Yes' : 'No'} tone={analysis.volumeAnalysis.accumulation ? 'positive' : 'default'} />
              <ScoreTile label="Distribution" value={analysis.volumeAnalysis.distribution ? 'Yes' : 'No'} tone={analysis.volumeAnalysis.distribution ? 'danger' : 'default'} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{analysis.volumeAnalysis.comment}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm font-bold text-white">Detected patterns</div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {analysis.patterns.length
              ? analysis.patterns.map(pattern => <PatternCard key={`${pattern.name}-${pattern.priceZone}`} pattern={pattern} />)
              : <div className="text-sm text-slate-500">No high-conviction technical patterns were detected yet.</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
            <div className="text-sm font-bold text-white">Risk / reward</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <ScoreTile label="Risk level" value={analysis.riskAssessment.riskLevel} tone={analysis.riskAssessment.riskLevel === 'Low' ? 'positive' : analysis.riskAssessment.riskLevel === 'High' ? 'danger' : 'warning'} />
              <ScoreTile label="Stop loss" value={analysis.riskAssessment.stopLoss ?? '-'} />
              <ScoreTile label="Take profit" value={analysis.riskAssessment.takeProfit ?? '-'} />
            </div>
            <div className="mt-4 text-sm leading-6 text-slate-300">{analysis.riskAssessment.mainRisk}</div>
          </div>

          <div className="rounded-2xl border border-amber-300/10 bg-amber-300/5 p-4">
            <div className="text-sm font-bold text-white">Important disclaimer</div>
            <p className="mt-3 text-sm leading-6 text-amber-50/90">{analysis.disclaimer}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
