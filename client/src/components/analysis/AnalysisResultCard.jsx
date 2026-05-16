import { useState } from 'react'
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

  const [activeTab, setActiveTab] = useState('bull')

  const tabs = [
    { id: 'bull', label: labels.bullCase },
    { id: 'bear', label: labels.bearCase },
    { id: 'risks', label: labels.keyRisks },
    { id: 'news', label: labels.newsSentiment },
  ]

  return (
    <Card className="rounded-3xl p-0 overflow-hidden border-white/10 shadow-2xl">
      {/* Header section with Sentiment & Conclusion */}
      <div className="bg-slate-900/60 p-6 border-b border-white/5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">AI Intelligence Engine</div>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{finalOutlook}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{summary}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[340px]">
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{labels.overallSentiment}</div>
              <Badge sentiment={sentiment}>{sentiment}</Badge>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{labels.confidence}</div>
              <div className="text-xl font-black text-white">{confidenceScore}%</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{labels.risk}</div>
              <Badge tone={riskTone(riskLevel)}>{riskLevel}</Badge>
            </div>
          </div>
        </div>

        {/* Detail Tabs Selector */}
        <div className="mt-8 flex gap-1 p-1 w-fit rounded-xl bg-slate-950/50 border border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
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

      <div className="p-6 bg-slate-950/20">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'bull' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                {labels.bullCase}
              </div>
              <ListBlock items={bullCase} tone="positive" />
            </div>
          )}
          {activeTab === 'bear' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-400" />
                {labels.bearCase}
              </div>
              <ListBlock items={bearCase} tone="danger" />
            </div>
          )}
          {activeTab === 'risks' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                {labels.keyRisks}
              </div>
              <ListBlock items={keyRisks} tone="warning" />
            </div>
          )}
          {activeTab === 'news' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                {labels.newsSentiment}
              </div>
              <p className="text-sm leading-relaxed text-slate-300 bg-slate-900/30 p-4 rounded-xl border border-white/5">
                {newsSentiment}
              </p>
              <div className="mt-4 p-4 rounded-xl border border-white/5 bg-slate-950/50">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{labels.technicalOutlook}</div>
                <p className="text-sm leading-relaxed text-slate-400 italic">{technicalOutlook}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
