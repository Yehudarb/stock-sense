import { fmtPrice, fmtVolume } from '../../lib/formatters'

const TONE = {
  bullish: 'border-green-800 bg-green-950/35 text-green-200',
  bearish: 'border-red-800 bg-red-950/35 text-red-200',
  neutral: 'border-yellow-800 bg-yellow-950/25 text-yellow-200',
}

const TRIANGLE_LABEL = {
  he: {
    ascending: 'משולש עולה',
    descending: 'משולש יורד',
    symmetrical: 'משולש סימטרי',
    expanding: 'מגפון / משולש מתרחב',
  },
  en: {
    ascending: 'Ascending triangle',
    descending: 'Descending triangle',
    symmetrical: 'Symmetrical triangle',
    expanding: 'Megaphone / expanding triangle',
  },
}

const STATUS_LABEL = {
  he: { developing: 'מתפתח', breakout_up: 'פריצה מעלה', breakout_down: 'שבירה מטה' },
  en: { developing: 'Developing', breakout_up: 'Breakout up', breakout_down: 'Breakdown' },
}

const DIRECTION_LABEL = {
  he: { bullish: 'בולישי', bearish: 'דובי', neutral: 'ניטרלי' },
  en: { bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral' },
}

const REGIME_LABEL = {
  he: {
    TRENDING: 'מגמתי',
    RANGING: 'דשדוש',
    TRANSITIONAL: 'מעבר',
    STRONG: 'חזק',
    MEDIUM: 'בינוני',
    NEUTRAL: 'ניטרלי',
    HIGH: 'גבוה',
    LOW: 'נמוך',
  },
  en: {
    TRENDING: 'Trending',
    RANGING: 'Ranging',
    TRANSITIONAL: 'Transitional',
    STRONG: 'Strong',
    MEDIUM: 'Medium',
    NEUTRAL: 'Neutral',
    HIGH: 'High',
    LOW: 'Low',
  },
}

function toneFor(value) {
  if (value === 'bullish') return TONE.bullish
  if (value === 'bearish') return TONE.bearish
  return TONE.neutral
}

function Metric({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-lg bg-slate-900/40 border border-slate-800/50 p-3">
      <div className="text-[11px] font-medium tracking-wide uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-black ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function TriangleCard({ triangle, language }) {
  const target = triangle.direction === 'bearish' ? triangle.targetDown : triangle.targetUp
  return (
    <div className={`rounded-xl border p-4 text-xs glass-panel ${toneFor(triangle.direction)}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-black">{TRIANGLE_LABEL[language]?.[triangle.type] ?? triangle.type}</div>
          <div className="mt-1 opacity-80">
            {DIRECTION_LABEL[language]?.[triangle.direction] ?? triangle.direction} · {STATUS_LABEL[language]?.[triangle.status] ?? triangle.status}
          </div>
        </div>
        <div className="rounded-lg bg-slate-950/70 px-2 py-1 font-bold">{triangle.completionPct}%</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label={language === 'en' ? 'Resistance' : 'התנגדות'} value={fmtPrice(triangle.resistance)} color="text-orange-300" />
        <Metric label={language === 'en' ? 'Support' : 'תמיכה'} value={fmtPrice(triangle.support)} color="text-cyan-300" />
        <Metric label={language === 'en' ? 'Target' : 'יעד'} value={fmtPrice(target)} color={triangle.direction === 'bearish' ? 'text-red-300' : 'text-green-300'} />
        <Metric label={language === 'en' ? 'Apex' : 'קצה'} value={triangle.barsToApex == null ? '-' : `${triangle.barsToApex}`} sub={language === 'en' ? 'bars away' : 'נרות קדימה'} />
      </div>
    </div>
  )
}

export default function AdvancedTrendsPanel({ trends, language = 'he' }) {
  const isEnglish = language === 'en'
  if (!trends) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-slate-500" dir={isEnglish ? 'ltr' : 'rtl'}>
        {isEnglish ? 'Loading advanced trend and triangle analysis...' : 'טוען ניתוח טרנדים ומשולשים...'}
      </div>
    )
  }

  const copy = {
    title: isEnglish ? 'Advanced trends' : 'טרנדים מתקדמים',
    source: isEnglish ? 'From the imported ML trend files' : 'מבוסס על קבצי הטרנדים שיובאו',
    score: isEnglish ? 'Trend score' : 'ציון טרנד',
    triangles: isEnglish ? 'Triangle patterns' : 'תבניות משולשים',
    noTriangles: isEnglish ? 'No pivot-based triangle is active right now.' : 'אין כרגע משולש פעיל לפי pivots.',
    divergence: isEnglish ? 'RSI divergence' : 'דיברג׳נס RSI',
    bullishDiv: isEnglish ? 'Bullish divergence' : 'דיברג׳נס חיובי',
    bearishDiv: isEnglish ? 'Bearish divergence' : 'דיברג׳נס שלילי',
    noDiv: isEnglish ? 'No clear divergence' : 'אין דיברג׳נס ברור',
    regime: isEnglish ? 'Market regime' : 'משטר שוק',
    risk: isEnglish ? 'Risk' : 'סיכון',
    volatility: isEnglish ? 'Volatility' : 'תנודתיות',
    institutional: isEnglish ? 'Institutional activity' : 'פעילות מוסדית',
    detected: isEnglish ? 'Detected' : 'זוהתה',
    notDetected: isEnglish ? 'Not detected' : 'לא זוהתה',
    volumeSpikes: isEnglish ? 'volume spikes' : 'קפיצות נפח',
    volumeProfile: isEnglish ? 'High-volume price zones' : 'אזורי מחיר עם נפח גבוה',
  }

  const divergenceTone = trends.divergence.bullish ? 'text-green-300' : trends.divergence.bearish ? 'text-red-300' : 'text-slate-300'
  const divergenceLabel = trends.divergence.bullish ? copy.bullishDiv : trends.divergence.bearish ? copy.bearishDiv : copy.noDiv
  const regime = trends.regime

  return (
    <div className="glass-panel rounded-xl p-4" dir={isEnglish ? 'ltr' : 'rtl'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{copy.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{copy.source}</p>
        </div>
        <div className="rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">{copy.score}</div>
          <div className={`text-lg font-black ${trends.score >= 0 ? 'text-green-300' : 'text-red-300'}`}>{trends.score > 0 ? '+' : ''}{trends.score}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label={copy.divergence} value={divergenceLabel} color={divergenceTone} sub={trends.divergence.rsi != null ? `RSI ${trends.divergence.rsi}` : null} />
        <Metric label={copy.regime} value={REGIME_LABEL[language]?.[regime.regime] ?? regime.regime} color="text-blue-300" sub={`${copy.risk}: ${REGIME_LABEL[language]?.[regime.riskLevel] ?? regime.riskLevel}`} />
        <Metric label={copy.volatility} value={regime.volatilityPct == null ? '-' : `${regime.volatilityPct}%`} color="text-yellow-300" />
        <Metric
          label={copy.institutional}
          value={trends.institutional.institutionalBuying ? copy.detected : copy.notDetected}
          color={trends.institutional.institutionalBuying ? 'text-green-300' : 'text-slate-300'}
          sub={`${trends.institutional.spikeCount} ${copy.volumeSpikes}`}
        />
      </div>

      <div className="mt-3 border-t border-slate-700 pt-3">
        <div className="mb-2 text-xs font-bold text-slate-400">{copy.triangles}</div>
        {trends.triangles.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {trends.triangles.map(triangle => <TriangleCard key={`${triangle.key}-${triangle.status}`} triangle={triangle} language={language} />)}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-950/60 p-2 text-xs text-slate-500">{copy.noTriangles}</div>
        )}
      </div>

      {trends.volume.highVolumeLevels?.length > 0 && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="mb-2 text-xs font-bold text-slate-400">{copy.volumeProfile}</div>
          <div className="grid grid-cols-1 gap-1.5">
            {trends.volume.highVolumeLevels.slice(0, 3).map(level => (
              <div key={`${level.from}-${level.to}`} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-2 py-1.5 text-xs">
                <span className="font-mono text-slate-200">{fmtPrice(level.from)} - {fmtPrice(level.to)}</span>
                <span className="text-slate-500">{fmtVolume(level.volume)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
