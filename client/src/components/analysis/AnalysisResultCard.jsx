import Card from '../ui/Card'
import Badge from '../ui/Badge'

function SectionBlock({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function ListBlock({ items, tone = 'default' }) {
  const toneClass = {
    default: 'text-slate-300',
    positive: 'text-emerald-200',
    danger: 'text-rose-200',
    warning: 'text-amber-100',
  }[tone] ?? 'text-slate-300'

  if (!items?.length) {
    return <div className="text-sm text-slate-500">No material signals yet.</div>
  }

  return (
    <ul className={`space-y-2 text-sm leading-6 ${toneClass}`}>
      {items.map(item => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-current opacity-70" /><span>{item}</span></li>)}
    </ul>
  )
}

function riskTone(level) {
  if (level === 'Low') return 'positive'
  if (level === 'High') return 'danger'
  return 'warning'
}

export default function AnalysisResultCard({
  language = 'en',
  summary,
  sentiment,
  confidenceScore,
  riskLevel,
  bullCase,
  bearCase,
  keyRisks,
  newsSentiment,
  technicalOutlook,
  finalOutlook,
}) {
  const isHebrew = language === 'he'
  const labels = {
    title: isHebrew ? 'פלט AI מובנה' : 'Structured AI outlook',
    tldr: isHebrew ? 'TL;DR' : 'TL;DR',
    overallSentiment: isHebrew ? 'סנטימנט כללי' : 'Overall sentiment',
    confidence: isHebrew ? 'רמת ביטחון' : 'Confidence score',
    risk: isHebrew ? 'רמת סיכון' : 'Risk level',
    bullCase: isHebrew ? 'התרחיש השורי' : 'Bull case',
    bearCase: isHebrew ? 'התרחיש הדובי' : 'Bear case',
    keyRisks: isHebrew ? 'סיכונים מרכזיים' : 'Key risks',
    newsSentiment: isHebrew ? 'סנטימנט חדשות/אירועים' : 'Recent news sentiment',
    technicalOutlook: isHebrew ? 'מבט טכני' : 'Technical outlook',
    finalOutlook: isHebrew ? 'מסקנת AI' : 'Final AI outlook',
  }

  return (
    <Card className="rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">{labels.title}</div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{finalOutlook}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{summary}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
            <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{labels.overallSentiment}</div>
              <div className="mt-2"><Badge sentiment={sentiment}>{sentiment}</Badge></div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{labels.confidence}</div>
              <div className="mt-2 text-xl font-black text-white">{confidenceScore}%</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{labels.risk}</div>
              <div className="mt-2"><Badge tone={riskTone(riskLevel)}>{riskLevel}</Badge></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionBlock title={labels.tldr}>
            <p className="text-sm leading-6 text-slate-300">{summary}</p>
          </SectionBlock>
          <SectionBlock title={labels.newsSentiment}>
            <p className="text-sm leading-6 text-slate-300">{newsSentiment}</p>
          </SectionBlock>
          <SectionBlock title={labels.bullCase}>
            <ListBlock items={bullCase} tone="positive" />
          </SectionBlock>
          <SectionBlock title={labels.bearCase}>
            <ListBlock items={bearCase} tone="danger" />
          </SectionBlock>
          <SectionBlock title={labels.keyRisks}>
            <ListBlock items={keyRisks} tone="warning" />
          </SectionBlock>
          <SectionBlock title={labels.technicalOutlook}>
            <p className="text-sm leading-6 text-slate-300">{technicalOutlook}</p>
          </SectionBlock>
        </div>
      </div>
    </Card>
  )
}
