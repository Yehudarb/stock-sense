import { fmtPrice } from '../../lib/formatters'

function pctText(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value > 0 ? '+' : ''}${value}%`
}

function scoreText(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return value > 0 ? `+${value}` : String(value)
}

const TONE = {
  bullish: { card: 'glass-panel border-green-500/20', badge: 'bg-green-500/20 text-green-300 border border-green-500/30', text: 'text-green-300', bar: 'bg-green-400' },
  bearish: { card: 'glass-panel border-red-500/20', badge: 'bg-red-500/20 text-red-300 border border-red-500/30', text: 'text-red-300', bar: 'bg-red-400' },
  neutral: { card: 'glass-panel border-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30', text: 'text-yellow-300', bar: 'bg-yellow-400' },
}

const BIAS_DOT = { bullish: 'bg-green-400', bearish: 'bg-red-400', neutral: 'bg-yellow-300' }

function Metric({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-lg bg-slate-900/40 border border-slate-800/50 p-3">
      <div className="text-[11px] font-medium tracking-wide uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-black ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function TimeframeRow({ item, language }) {
  const color = { bullish: 'text-green-300', bearish: 'text-red-300', neutral: 'text-yellow-300' }[item.bias] ?? 'text-slate-300'
  const label = language === 'en'
    ? ({ '5y': '5Y', '1y': '1Y', '1mo': '1M', '1d': '1D', '1h': '1H', '5m': '5m' }[item.interval] ?? item.label)
    : item.label
  const trend = language === 'en'
    ? ({ bullish: 'Bullish', bearish: 'Bearish', neutral: 'Mixed' }[item.bias] ?? item.trend)
    : item.trend

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/50 bg-slate-950/50 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${BIAS_DOT[item.bias] ?? 'bg-slate-500'}`} />
        <span className="font-bold text-slate-200">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={color}>{trend}</span>
        <span className="font-mono text-slate-500">{scoreText(item.score)}</span>
      </div>
    </div>
  )
}

export default function ForecastOpinionPanel({ forecast, isLoading, language = 'he' }) {
  const isHebrew = language === 'he'
  const copy = {
    loadingBuild: isHebrew ? 'בונה דעה לפי כמה טווחי זמן...' : 'Building multi-timeframe outlook...',
    loadingForecast: isHebrew ? 'טוען צפי אנליסט...' : 'Loading forecast...',
    title: isHebrew ? 'דעה וצפי אוטומטי' : 'Automated outlook',
    confidence: isHebrew ? 'ביטחון' : 'Confidence',
    bullishScore: isHebrew ? 'Score בוליש' : 'Bullish score',
    bearishScore: isHebrew ? 'Score בריש' : 'Bearish score',
    currentPrice: isHebrew ? 'מחיר נוכחי' : 'Current price',
    target: isHebrew ? 'יעד צפוי' : 'Target',
    downsideTarget: isHebrew ? 'יעד ירידה' : 'Downside target',
    holdAbove: isHebrew ? 'להחזיק מעל' : 'Hold above',
    buyAbove: isHebrew ? 'קנייה מעל' : 'Buy above',
    cutBelow: isHebrew ? 'לצאת/להקטין מתחת' : 'Cut below',
    action: isHebrew ? 'פעולה מועדפת' : 'Suggested action',
    alignment: isHebrew ? 'הסכמה בין טווחים' : 'Timeframe alignment',
    support: isHebrew ? 'מה תומך בצפי' : 'What supports the view',
    risks: isHebrew ? 'מה יכול לשנות את התמונה' : 'What could change the picture',
    disclaimer: isHebrew
      ? 'לא המלצה פיננסית. זו דעה טכנית אוטומטית לפי מחיר, נפח, תבניות, גאפים, דוחות וטווחי זמן.'
      : 'Not financial advice. This is an automated technical view based on price, volume, patterns, gaps, earnings, and multiple timeframes.',
  }

  if (isLoading && !forecast) {
    return <div className="glass-panel rounded-xl p-4 text-center text-sm text-slate-500" dir={isHebrew ? 'rtl' : 'ltr'}>{copy.loadingBuild}</div>
  }
  if (!forecast) {
    return <div className="glass-panel rounded-xl p-4 text-center text-sm text-slate-500" dir={isHebrew ? 'rtl' : 'ltr'}>{copy.loadingForecast}</div>
  }

  const tone = TONE[forecast.tone] ?? TONE.neutral
  const positiveTarget = forecast.targetPct != null && forecast.targetPct >= 0
  const timeframeRecommendation = isHebrew
    ? forecast.multiTimeframe?.recommendation
    : ({
      bullish: 'Most timeframes support the upside direction',
      bearish: 'Most timeframes warn of downside pressure',
      neutral: 'Timeframes are mixed; wait for confirmation',
    }[forecast.multiTimeframe?.bias] ?? forecast.multiTimeframe?.recommendation)

  return (
    <div className={`rounded-xl border p-4 ${tone.card}`} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-400">{copy.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-lg px-3 py-1 text-sm font-black ${tone.badge}`}>{forecast.label}</span>
            <span className={`text-sm font-bold ${tone.text}`}>{forecast.expectation}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{forecast.horizon}</div>
        </div>
        <div className="shrink-0 rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">{copy.confidence}</div>
          <div className={`text-lg font-black ${tone.text}`}>{forecast.confidence}%</div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-200">{forecast.summary}</p>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>{copy.bullishScore} {scoreText(forecast.bullishScore)}</span>
          <span>{copy.bearishScore} {scoreText(forecast.bearishScore)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-900/80">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(12, forecast.confidence))}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label={copy.currentPrice} value={fmtPrice(forecast.currentPrice)} />
        <Metric label={forecast.tone === 'bearish' ? copy.downsideTarget : copy.target} value={fmtPrice(forecast.targetPrice)} color={positiveTarget ? 'text-green-300' : 'text-red-300'} sub={pctText(forecast.targetPct)} />
        <Metric label={copy.holdAbove} value={fmtPrice(forecast.holdAbove)} color="text-cyan-300" />
        <Metric label={copy.buyAbove} value={fmtPrice(forecast.buyAbove)} color="text-green-300" />
        <Metric label={copy.cutBelow} value={fmtPrice(forecast.invalidBelow)} color="text-red-300" />
        <Metric label={copy.action} value={forecast.suggestedAction} color={tone.text} />
      </div>

      {forecast.multiTimeframe?.timeframes?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400">{copy.alignment}</span>
            <span className={tone.text}>{forecast.multiTimeframe.alignmentPct}% · {timeframeRecommendation}</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {forecast.multiTimeframe.timeframes.map(item => <TimeframeRow key={item.interval} item={item} language={language} />)}
          </div>
        </div>
      )}

      {forecast.drivers?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">{copy.support}</div>
          <ul className="space-y-1">
            {forecast.drivers.map((driver, index) => <li key={index} className="text-xs leading-relaxed text-slate-300">{driver}</li>)}
          </ul>
        </div>
      )}

      {forecast.risks?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">{copy.risks}</div>
          <ul className="space-y-1">
            {forecast.risks.map((risk, index) => <li key={index} className="text-xs leading-relaxed text-slate-300">{risk}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-slate-800/50 bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">{copy.disclaimer}</div>
    </div>
  )
}
