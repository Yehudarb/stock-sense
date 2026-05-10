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
  bullish: {
    card: 'border-green-700 bg-green-950/35',
    badge: 'bg-green-500 text-slate-950',
    text: 'text-green-300',
    bar: 'bg-green-400',
  },
  bearish: {
    card: 'border-red-700 bg-red-950/35',
    badge: 'bg-red-500 text-white',
    text: 'text-red-300',
    bar: 'bg-red-400',
  },
  neutral: {
    card: 'border-yellow-700 bg-yellow-950/25',
    badge: 'bg-yellow-400 text-slate-950',
    text: 'text-yellow-300',
    bar: 'bg-yellow-300',
  },
}

const BIAS_DOT = {
  bullish: 'bg-green-400',
  bearish: 'bg-red-400',
  neutral: 'bg-yellow-300',
}

function Metric({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-lg bg-slate-950/70 p-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-black ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function TimeframeRow({ item }) {
  const color = {
    bullish: 'text-green-300',
    bearish: 'text-red-300',
    neutral: 'text-yellow-300',
  }[item.bias] ?? 'text-slate-300'

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${BIAS_DOT[item.bias] ?? 'bg-slate-500'}`} />
        <span className="font-bold text-slate-200">{item.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={color}>{item.trend}</span>
        <span className="font-mono text-slate-500">{scoreText(item.score)}</span>
      </div>
    </div>
  )
}

export default function ForecastOpinionPanel({ forecast, isLoading }) {
  if (isLoading && !forecast) {
    return (
      <div className="rounded-xl bg-slate-800 p-4 text-center text-sm text-slate-500" dir="rtl">
        בונה דעה לפי כמה טווחי זמן...
      </div>
    )
  }

  if (!forecast) {
    return (
      <div className="rounded-xl bg-slate-800 p-4 text-center text-sm text-slate-500" dir="rtl">
        טוען צפי אנליסט...
      </div>
    )
  }

  const tone = TONE[forecast.tone] ?? TONE.neutral
  const positiveTarget = forecast.targetPct != null && forecast.targetPct >= 0

  return (
    <div className={`rounded-xl border p-4 ${tone.card}`} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-400">דעה וצפי אוטומטי</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-lg px-3 py-1 text-sm font-black ${tone.badge}`}>{forecast.label}</span>
            <span className={`text-sm font-bold ${tone.text}`}>{forecast.expectation}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{forecast.horizon}</div>
        </div>
        <div className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">ביטחון</div>
          <div className={`text-lg font-black ${tone.text}`}>{forecast.confidence}%</div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-200">{forecast.summary}</p>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>Score בוליש {scoreText(forecast.bullishScore)}</span>
          <span>Score בריש {scoreText(forecast.bearishScore)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-900">
          <div
            className={`h-full rounded-full ${tone.bar}`}
            style={{ width: `${Math.min(100, Math.max(12, forecast.confidence))}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="מחיר נוכחי" value={fmtPrice(forecast.currentPrice)} />
        <Metric
          label={forecast.tone === 'bearish' ? 'יעד ירידה' : 'יעד צפי'}
          value={fmtPrice(forecast.targetPrice)}
          color={positiveTarget ? 'text-green-300' : 'text-red-300'}
          sub={pctText(forecast.targetPct)}
        />
        <Metric label="להחזיק מעל" value={fmtPrice(forecast.holdAbove)} color="text-cyan-300" />
        <Metric label="קנייה מעל" value={fmtPrice(forecast.buyAbove)} color="text-green-300" />
        <Metric label="לצאת/להקטין מתחת" value={fmtPrice(forecast.invalidBelow)} color="text-red-300" />
        <Metric label="פעולה מועדפת" value={forecast.suggestedAction} color={tone.text} />
      </div>

      {forecast.multiTimeframe?.timeframes?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400">הסכמה בין טווחים</span>
            <span className={tone.text}>
              {forecast.multiTimeframe.alignmentPct}% · {forecast.multiTimeframe.recommendation}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {forecast.multiTimeframe.timeframes.map(item => (
              <TimeframeRow key={item.interval} item={item} />
            ))}
          </div>
        </div>
      )}

      {forecast.drivers?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">מה תומך בצפי</div>
          <ul className="space-y-1">
            {forecast.drivers.map((driver, index) => (
              <li key={index} className="text-xs leading-relaxed text-slate-300">{driver}</li>
            ))}
          </ul>
        </div>
      )}

      {forecast.risks?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">מה יכול לשנות את התמונה</div>
          <ul className="space-y-1">
            {forecast.risks.map((risk, index) => (
              <li key={index} className="text-xs leading-relaxed text-slate-300">{risk}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-slate-950/70 p-2 text-[11px] leading-relaxed text-slate-500">
        לא המלצה פיננסית. זו דעה טכנית אוטומטית לפי מחיר, נפח, תבניות, גאפים, דוחות וטווחי זמן.
      </div>
    </div>
  )
}
