function stateLabel(value, language) {
  const labels = {
    strong_uptrend: ['מגמת עלייה חזקה', 'Strong uptrend'], uptrend: ['מגמת עלייה', 'Uptrend'], early_recovery: ['התאוששות מוקדמת', 'Early recovery'], neutral: ['ניטרלי', 'Neutral'], weak_structure: ['מבנה חלש', 'Weak structure'], downtrend: ['מגמת ירידה', 'Downtrend'], insufficient_history: ['אין מספיק היסטוריה', 'Insufficient history'],
    healthy_pullback_to_sma20: ['Pullback בריא ל-SMA20', 'Healthy pullback to SMA20'], trading_near_sma20: ['קרוב ל-SMA20', 'Near SMA20'], extended_above_sma20: ['מורחב מעל SMA20', 'Extended above SMA20'], reclaiming_sma20: ['מחזיר SMA20', 'Reclaiming SMA20'], lost_sma20_support: ['איבד תמיכת SMA20', 'Lost SMA20 support'], below_falling_sma20: ['מתחת ל-SMA20 יורד', 'Below falling SMA20'],
    avoid: ['להימנע', 'Avoid'], wait: ['להמתין', 'Wait'], watch: ['למעקב', 'Watch'], prepare: ['להתכונן', 'Prepare'], setup_valid: ['Setup תקין טכנית', 'Technically valid setup'], reduce_risk: ['להפחית סיכון', 'Reduce risk'],
  }
  return labels[value]?.[language === 'he' ? 0 : 1] ?? value?.replaceAll?.('_', ' ') ?? value ?? '-'
}

function Check({ pass, label, value }) {
  const tone = pass === true ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : pass === false ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-slate-500/25 bg-slate-500/10 text-slate-200'
  return <div className={`rounded-xl border px-3 py-2 text-xs ${tone}`}><div className="font-bold">{pass === true ? '✓' : pass === false ? '×' : '•'} {label}</div><div className="mt-1 opacity-75" dir="ltr">{value}</div></div>
}

function EvidenceList({ title, items, tone }) {
  return <div className="rounded-xl border border-white/8 bg-slate-950/30 p-3"><strong className={tone}>{title}</strong>{items.length ? items.map(item => <div key={item} className="mt-1.5 text-slate-300">• {item}</div>) : <div className="mt-1.5 text-slate-500">—</div>}</div>
}

/** Explain the method while keeping measurements, interpretation, and risk separate. */
export default function TechnicalMethodPanel({ method, language = 'he' }) {
  if (!method) return null
  const he = language === 'he'
  const trend = method.trend
  const timing = method.timing
  const setup = method.setup
  const support = method.supportResistance.nearestSupport
  const resistance = method.supportResistance.nearestResistance
  const primaryTrendline = method.trendlines?.[0]
  const pattern = method.patternSummary?.best
  const triggerConfirmed = setup.trigger?.confirmed === true
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/45 p-4 sm:p-5" dir={he ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black tracking-[0.16em] text-cyan-200">{he ? 'שיטת קונפלואנס טכנית לטווח ארוך' : 'LONG-TERM TECHNICAL METHOD'}</div>
          <h3 className="mt-1 text-lg font-black text-white">{he ? 'Micha Method' : method.displayName}</h3>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">{he ? 'הציון מודד התאמה בין ראיות טכניות. הוא אינו הסתברות, הוראת קנייה או הבטחת תשואה.' : 'The score measures alignment of technical evidence. It is not a probability, order, or return promise.'}</p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-xl bg-cyan-400/15 px-3 py-2 text-center"><div className="text-[10px] text-cyan-100">{he ? 'ציון התאמה' : 'Alignment score'}</div><strong className="text-2xl text-cyan-100">{method.score ?? '-'}</strong></div>
          <div className="rounded-xl bg-slate-800/80 px-3 py-2 text-center"><div className="text-[10px] text-slate-400">{he ? 'איכות ראיות' : 'Evidence quality'}</div><strong className="text-2xl text-white">{method.evidenceQuality ?? '-'}%</strong></div>
        </div>
      </div>
      {method.conclusion.partialAnalysis && <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">{he ? 'הניתוח חלקי. אין מספיק מידע כדי להציג Setup חיובי.' : 'Analysis is partial. A positive setup is blocked until enough data is available.'}</div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Check pass={trend.priceAboveSma150} label={he ? 'מחיר מעל SMA150' : 'Price above SMA150'} value={trend.sma150 != null ? `$${trend.sma150}` : '-'} />
        <Check pass={trend.priceAboveSma200} label={he ? 'מחיר מעל SMA200' : 'Price above SMA200'} value={trend.sma200 != null ? `$${trend.sma200}` : '-'} />
        <Check pass={trend.sma150AboveSma200} label={he ? 'SMA150 מעל SMA200' : 'SMA150 above SMA200'} value={trend.sma150VsSma200Percent != null ? `${trend.sma150VsSma200Percent}%` : '-'} />
        <Check pass={trend.sma200Rising} label={he ? 'SMA200 עולה' : 'SMA200 rising'} value={trend.sma200Slope50Percent != null ? `${trend.sma200Slope50Percent}% / 50` : '-'} />
        <Check pass={['healthy_pullback_to_sma20', 'trading_near_sma20', 'reclaiming_sma20'].includes(timing.status)} label={he ? 'תזמון SMA20' : 'SMA20 timing'} value={stateLabel(timing.status, language)} />
        <Check pass={Boolean(support)} label={he ? 'תמיכה מאומתת' : 'Validated support'} value={support ? `$${support.lowerBound}-${support.upperBound}` : '-'} />
        <Check pass={primaryTrendline ? primaryTrendline.status !== 'broken' : null} label={he ? 'קו מגמה' : 'Trendline'} value={primaryTrendline ? `${primaryTrendline.status} · ${primaryTrendline.qualityScore}/100` : '-'} />
        <Check pass={triggerConfirmed} label={he ? 'אישור נר סגור' : 'Closed-bar trigger'} value={triggerConfirmed ? setup.trigger.evidence?.confirmationType ?? setup.status : (he ? 'ממתין לאישור' : 'Waiting for confirmation')} />
        <Check pass={pattern ? pattern.confidenceScore >= 58 : null} label={he ? 'תבנית איכותית' : 'Qualified pattern'} value={pattern ? `${pattern.label} · ${pattern.confidenceScore}` : '-'} />
        <Check pass={setup.trigger?.evidence?.volumeConfirmed ?? null} label={he ? 'אישור מחזור' : 'Volume confirmation'} value={setup.trigger?.evidence?.volumeRatio != null ? `${setup.trigger.evidence.volumeRatio}x` : '-'} />
        <Check pass={(method.risk.riskReward ?? 0) >= 1.5} label={he ? 'יחס סיכוי/סיכון' : 'Risk/reward'} value={method.risk.riskReward != null ? `${method.risk.riskReward}:1` : '-'} />
        <Check pass={Boolean(resistance)} label={he ? 'התנגדות / יעד מבני' : 'Resistance / structural target'} value={resistance ? `$${resistance.lowerBound}-${resistance.upperBound}` : '-'} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3 text-sm">
        <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3"><span className="text-xs text-slate-400">{he ? 'מבנה ארוך טווח' : 'Long-term structure'}</span><strong className="mt-1 block text-white">{stateLabel(trend.status, language)}</strong><p className="mt-2 text-xs text-slate-400">SMA20: {stateLabel(timing.status, language)}</p></div>
        <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3"><span className="text-xs text-slate-400">{he ? 'Setup וטריגר' : 'Setup and trigger'}</span><strong className="mt-1 block text-white">{stateLabel(setup.setupType, language)}</strong><p className="mt-2 text-xs text-slate-400">{stateLabel(setup.actionState, language)} · {stateLabel(setup.status, language)}</p><p className="mt-2 text-xs text-cyan-100">{setup.trigger?.description}</p></div>
        <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3"><span className="text-xs text-slate-400">{he ? 'סיכון וביטול' : 'Risk and invalidation'}</span><strong className="mt-1 block text-white">{stateLabel(method.risk.riskLevel, language)}</strong><p className="mt-2 text-xs text-slate-400">{setup.invalidationCondition}</p><p className="mt-2 text-xs text-rose-200">{method.risk.stopReason}</p></div>
      </div>
      <div className="mt-4 grid gap-3 text-xs lg:grid-cols-3">
        <EvidenceList title={he ? 'נתונים שנצפו' : 'Observed data'} items={method.conclusion.observedData ?? []} tone="text-cyan-200" />
        <EvidenceList title={he ? 'פרשנות השיטה' : 'Method interpretation'} items={method.conclusion.interpretation ?? []} tone="text-emerald-200" />
        <EvidenceList title={he ? 'סיכון ומה יבטל' : 'Risk and invalidation'} items={[...(method.conclusion.riskNotes ?? []), ...method.conclusion.invalidationConditions].slice(0, 7)} tone="text-amber-200" />
      </div>
      <p className="mt-4 border-t border-white/8 pt-3 text-[11px] text-slate-500">{he ? 'הניתוח משתמש בנרות סגורים ומיועד למחקר ולחינוך בלבד. אינו ייעוץ השקעות או הבטחת ביצועים.' : 'Closed-bar research and education only. Not investment advice or a performance guarantee.'}</p>
    </section>
  )
}
