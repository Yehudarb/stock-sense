function pctText(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value > 0 ? '+' : ''}${value}%`
}

const TONE = {
  PANIC: { color: 'text-red-300', bg: 'bg-red-950/45 border-red-700', bar: '#ef4444' },
  BEAR: { color: 'text-red-300', bg: 'bg-red-950/35 border-red-800', bar: '#ef4444' },
  MILD_BEAR: { color: 'text-orange-300', bg: 'bg-orange-950/25 border-orange-800', bar: '#fb923c' },
  NEUTRAL: { color: 'text-yellow-300', bg: 'bg-yellow-950/25 border-yellow-800', bar: '#eab308' },
  MILD_BULL: { color: 'text-lime-300', bg: 'bg-lime-950/25 border-lime-800', bar: '#a3e635' },
  BULL: { color: 'text-green-300', bg: 'bg-green-950/35 border-green-800', bar: '#22c55e' },
}

const FACTOR_COLOR = {
  bullish: 'text-green-300',
  bearish: 'text-red-300',
  neutral: 'text-slate-300',
}

function AssetMetric({ label, asset, valueOverride, daysLabel }) {
  return (
    <div className="rounded-lg bg-slate-950/70 p-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black text-white">{valueOverride ?? (asset?.current ?? '-')}</div>
      {asset?.return5d != null && (
        <div className={asset.return5d >= 0 ? 'mt-0.5 text-[11px] text-green-300' : 'mt-0.5 text-[11px] text-red-300'}>
          {daysLabel}: {pctText(asset.return5d)}
        </div>
      )}
    </div>
  )
}

export default function MarketContextPanel({ marketContext, isLoading, language = 'he' }) {
  const isHebrew = language === 'he'
  const copy = {
    loading: isHebrew ? 'טוען ניתוח שוק רחב...' : 'Loading market context...',
    score: 'Score',
    sector: isHebrew ? 'סקטור' : 'Sector',
    alignment: isHebrew ? 'התאמת SPY/QQQ' : 'SPY/QQQ alignment',
    warning: isHebrew ? 'אזהרה: לפי שכבת השוק הרחב, קנייה חדשה דורשת אישור חזק במיוחד.' : 'Warning: broad market conditions require stronger confirmation for new buys.',
    included: isHebrew ? 'נכלל במדד' : 'Included in index',
    marketDrivers: isHebrew ? 'גורמי שוק' : 'Market drivers',
    days5: isHebrew ? '5 ימים' : '5 days',
  }
  if (isLoading && !marketContext) {
    return (
      <div className="rounded-xl bg-slate-800 p-4 text-center text-sm text-slate-500" dir={isHebrew ? 'rtl' : 'ltr'}>
        {copy.loading}
      </div>
    )
  }

  if (!marketContext) return null

  const tone = TONE[marketContext.condition] ?? TONE.NEUTRAL
  const scorePosition = Math.round(((marketContext.score + 3) / 6) * 100)
  const conditionLabel = isHebrew
    ? marketContext.label
    : ({
      PANIC: 'Panic',
      BEAR: 'Bearish',
      MILD_BEAR: 'Mildly bearish',
      NEUTRAL: 'Neutral',
      MILD_BULL: 'Mildly bullish',
      BULL: 'Bullish',
    }[marketContext.condition] ?? marketContext.label)
  const factorText = factor => {
    if (isHebrew) return factor.text
    if (factor.tone === 'bullish') return 'Bullish market factor supports the setup.'
    if (factor.tone === 'bearish') return 'Bearish market factor is a headwind.'
    return 'Neutral market factor.'
  }

  return (
    <div className={`rounded-xl border p-4 ${tone.bg}`} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-400">Market Context v4</div>
          <div className={`mt-1 text-lg font-black ${tone.color}`}>{conditionLabel}</div>
          <div className="mt-1 text-xs text-slate-400">
            {copy.sector}: {marketContext.sectorEtf} · {copy.alignment}: {marketContext.alignmentPct}%
          </div>
        </div>
        <div className="rounded-lg bg-slate-950 px-3 py-2 text-center">
          <div className="text-[11px] text-slate-500">{copy.score}</div>
          <div className={`text-lg font-black ${tone.color}`}>{marketContext.score > 0 ? '+' : ''}{marketContext.score}</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950">
        <div className="h-full rounded-full" style={{ width: `${scorePosition}%`, backgroundColor: tone.bar }} />
      </div>

      {marketContext.shouldBlockBuy && (
        <div className="mt-3 rounded-lg border border-red-800 bg-red-950/45 p-2 text-xs font-bold text-red-200">
          {copy.warning}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AssetMetric label="SPY" asset={marketContext.assets?.spy} daysLabel={copy.days5} />
        <AssetMetric label="QQQ" asset={marketContext.assets?.qqq} daysLabel={copy.days5} />
        <AssetMetric label={`${copy.sector} ${marketContext.sectorEtf}`} asset={marketContext.assets?.sector} valueOverride={marketContext.assets?.sector ? null : copy.included} daysLabel={copy.days5} />
        <AssetMetric label="VIX" asset={marketContext.assets?.vix} daysLabel={copy.days5} />
        <AssetMetric label="Dollar" asset={marketContext.assets?.dollar} daysLabel={copy.days5} />
        <AssetMetric label="TLT" asset={marketContext.assets?.tlt} daysLabel={copy.days5} />
      </div>

      {marketContext.factors?.length > 0 && (
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <div className="mb-1 text-xs font-bold text-slate-400">{copy.marketDrivers}</div>
          <ul className="space-y-1">
            {marketContext.factors.map((factor, index) => (
              <li key={index} className={`text-xs leading-relaxed ${FACTOR_COLOR[factor.tone] ?? 'text-slate-300'}`}>
                {factorText(factor)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
