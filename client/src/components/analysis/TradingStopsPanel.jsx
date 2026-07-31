import { useState } from 'react'
import { useTradingStops } from '../../hooks/useTradingStops'
import { TRADER_TEXT } from '../../lib/traderColors'
import { ChevronDown, ChevronUp, AlertCircle, TrendingUp } from 'lucide-react'

export default function TradingStopsPanel({
  _ticker,
  currentPrice,
  atr,
  supportPrice = null,
  language = 'en'
}) {
  const isHebrew = language === 'he'
  const [expandedScenario, setExpandedScenario] = useState('normal')
  const [entryPrice, setEntryPrice] = useState(currentPrice || '')

  const { stops, loading, error } = useTradingStops(
    entryPrice ? parseFloat(entryPrice) : null,
    atr ? parseFloat(atr) : null,
    supportPrice ? parseFloat(supportPrice) : null
  )

  if (!atr) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
        <div className="flex gap-3 text-sm text-slate-400">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            {isHebrew
              ? 'חסרים נתוני ATR - לא ניתן לחשב stops'
              : 'ATR data missing — cannot calculate stops'}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
        <div className="animate-pulse text-sm text-slate-400">
          {isHebrew ? '📊 מחשב stops...' : '📊 Calculating stops...'}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-orange-500/20 bg-orange-950/20 p-6">
        <div className="text-sm text-orange-400">
          {isHebrew ? '⚠️ שגיאה בחישוב' : '⚠️ Calculation error'}: {error}
        </div>
      </div>
    )
  }

  if (!stops || !entryPrice) {
    return null
  }

  const recommendedStyle = (scenario) => {
    if (scenario === stops.recommended) {
      return 'border-primary/50 bg-primary/10'
    }
    return 'border-white/10 bg-slate-900/30'
  }

  const getScenarioIcon = (scenario) => {
    const icons = {
      tight: '🎯',
      normal: '⚖️',
      wide: '📈',
    }
    return icons[scenario] || '•'
  }

  const getRecommendationLabel = () => {
    const labels = {
      he: {
        tight: 'הגבלה קטנה - סיכון גבוה',
        normal: 'איזון מיטבי',
        wide: 'הגבלה רחבה - סיכון נמוך',
      },
      en: {
        tight: 'Tight Stop - High Confidence',
        normal: 'Balanced Approach',
        wide: 'Wide Stop - Volatile Market',
      },
    }
    return labels[language][stops.recommended]
  }

  const ScenarioCard = ({ scenario, data }) => {
    const isExpanded = expandedScenario === scenario
    const isRecommended = scenario === stops.recommended

    return (
      <div
        key={scenario}
        className={`rounded-xl border-2 transition-all cursor-pointer ${recommendedStyle(scenario)}`}
        onClick={() => setExpandedScenario(isExpanded ? null : scenario)}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-xl">{getScenarioIcon(scenario)}</span>
            <div>
              <div className="font-bold text-white capitalize">
                {scenario}
                {isRecommended && (
                  <span className={`ml-2 text-xs font-black uppercase tracking-widest ${TRADER_TEXT.bullish}`}>
                    ✓ {isHebrew ? 'מומלץ' : 'RECOMMENDED'}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {isHebrew
                  ? `R:R ${data.rr_ratio.toFixed(2)}:1`
                  : `Risk ${data.risk_pct.toFixed(1)}% | R:R ${data.rr_ratio.toFixed(2)}:1`}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="text-right">
            <div className="font-bold text-lg text-white">
              ${data.target.toFixed(2)}
            </div>
            <div className={`text-xs font-semibold ${
              data.rr_ratio >= 3 ? TRADER_TEXT.bullish :
              data.rr_ratio >= 2 ? TRADER_TEXT.neutral :
              TRADER_TEXT.bearish
            }`}>
              {data.rr_ratio >= 3 ? '⬆️ Strong' : data.rr_ratio >= 2 ? '→ Fair' : '⬇️ Weak'}
            </div>
          </div>

          {/* Expand Icon */}
          <div className="ml-3 text-slate-500">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-white/10 px-4 py-3 space-y-3">
            {/* Stop Loss */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-red-950/30 border border-red-500/20 p-2.5">
                <div className="text-xs text-red-400 font-semibold uppercase tracking-wide">
                  {isHebrew ? 'Stop Loss' : 'Stop Loss'}
                </div>
                <div className="text-lg font-bold text-red-400 mt-1">
                  ${data.stop.toFixed(2)}
                </div>
                <div className="text-xs text-red-400/70 mt-1">
                  {isHebrew ? 'סיכון' : 'Risk'}: {data.risk_pct.toFixed(1)}%
                </div>
              </div>

              {/* Entry */}
              <div className="rounded-lg bg-slate-800/50 border border-slate-600/30 p-2.5">
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  {isHebrew ? 'כניסה' : 'Entry'}
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  ${parseFloat(entryPrice).toFixed(2)}
                </div>
              </div>

              {/* Target */}
              <div className="rounded-lg bg-green-950/30 border border-green-500/20 p-2.5">
                <div className="text-xs text-green-400 font-semibold uppercase tracking-wide">
                  {isHebrew ? 'Target' : 'Target'}
                </div>
                <div className="text-lg font-bold text-green-400 mt-1">
                  ${data.target.toFixed(2)}
                </div>
                <div className="text-xs text-green-400/70 mt-1">
                  {isHebrew ? 'רווח' : 'Gain'}: {data.reward_pct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* R:R Ratio */}
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-primary font-semibold uppercase tracking-wide">
                    {isHebrew ? 'יחס סיכון:רווח' : 'Risk:Reward Ratio'}
                  </div>
                  <div className="text-2xl font-black text-primary mt-1">
                    {data.rr_ratio.toFixed(2)}:1
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 mb-2">
                    {isHebrew ? 'סוג' : 'Type'}
                  </div>
                  <div className="font-bold text-white capitalize">
                    {data.reason.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Slider */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-semibold uppercase">
                {isHebrew ? 'מרחק מהכניסה' : 'Price Levels'}
              </div>
              <div className="h-8 bg-slate-800 rounded-lg overflow-hidden flex">
                {/* Stop Loss Zone */}
                <div
                  className="bg-red-500/30 border-r border-red-500/50 flex items-center justify-center text-xs font-bold text-red-400"
                  style={{ width: `${(parseFloat(entryPrice) - data.stop) / parseFloat(entryPrice) * 100}%` }}
                >
                  SL
                </div>

                {/* Profit Zone */}
                <div
                  className="bg-green-500/30 flex-1 flex items-center justify-center text-xs font-bold text-green-400"
                >
                  TP
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>${data.stop.toFixed(2)}</span>
                <span>${data.target.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-300">
          {isHebrew ? '📊 מחשב Stop/Target' : '📊 Stop Loss Calculator'}
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Entry Price */}
          <div>
            <label className="block text-xs text-slate-500 font-semibold mb-2">
              {isHebrew ? 'כניסה' : 'Entry Price'}
            </label>
            <input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2 text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none"
            />
          </div>

          {/* ATR */}
          <div>
            <label className="block text-xs text-slate-500 font-semibold mb-2">ATR</label>
            <input
              type="number"
              step="0.01"
              value={atr || ''}
              disabled
              className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2 text-slate-400 cursor-not-allowed opacity-60"
            />
          </div>

          {/* Support (if available) */}
          {supportPrice && (
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-2">
                {isHebrew ? 'תמיכה' : 'Support'}
              </label>
              <input
                type="number"
                step="0.01"
                value={supportPrice}
                disabled
                className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2 text-slate-400 cursor-not-allowed opacity-60"
              />
            </div>
          )}
        </div>

        {stops.warning && (
          <div className="mt-4 p-3 rounded-lg bg-orange-950/30 border border-orange-500/20 flex gap-2">
            <AlertCircle size={16} className="flex-shrink-0 text-orange-400 mt-0.5" />
            <div className="text-sm text-orange-400">{stops.warning}</div>
          </div>
        )}
      </div>

      {/* Recommendation Banner */}
      <div className={`rounded-2xl border-2 ${
        stops.recommended === 'tight' ? 'border-blue-500/50 bg-blue-950/20' :
        stops.recommended === 'normal' ? 'border-primary/50 bg-primary/10' :
        'border-amber-500/50 bg-amber-950/20'
      } p-4`}>
        <div className="flex items-start gap-3">
          <TrendingUp
            size={20}
            className={
              stops.recommended === 'tight' ? 'text-blue-400' :
              stops.recommended === 'normal' ? 'text-primary' :
              'text-amber-400'
            }
          />
          <div>
            <div className="font-bold text-white">
              {isHebrew ? 'המלצה:' : 'Recommendation:'} {getRecommendationLabel()}
            </div>
            <div className="text-sm text-slate-300 mt-1">
              {isHebrew
                ? `Stop: $${stops[stops.recommended].stop.toFixed(2)} | Target: $${stops[stops.recommended].target.toFixed(2)}`
                : `Stop at $${stops[stops.recommended].stop.toFixed(2)} | Target $${stops[stops.recommended].target.toFixed(2)}`}
            </div>
          </div>
        </div>
      </div>

      {/* Three Scenarios */}
      <div className="space-y-3">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
          {isHebrew ? 'שלוש תרחישים' : 'Three Scenarios'}
        </div>
        <div className="space-y-2">
          {['tight', 'normal', 'wide'].map((scenario) => (
            <ScenarioCard
              key={scenario}
              scenario={scenario}
              data={stops[scenario]}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg bg-slate-900/30 border border-slate-700/50 p-4 text-xs text-slate-400 space-y-2">
        <div className="font-semibold text-slate-300 mb-2">
          {isHebrew ? 'הסבר' : 'Legend'}
        </div>
        <div>
          <span className="font-bold text-primary">🎯 Tight:</span>
          {isHebrew
            ? ' סטופ הדוק (1.0×ATR), R:R גבוה, לביטחון גבוה'
            : ' Tight stop (1.0×ATR), high R:R, high confidence'}
        </div>
        <div>
          <span className="font-bold text-primary">⚖️ Normal:</span>
          {isHebrew
            ? ' איזון (1.5×ATR), R:R בינוני, מומלץ'
            : ' Balanced (1.5×ATR), medium R:R, recommended'}
        </div>
        <div>
          <span className="font-bold text-primary">📈 Wide:</span>
          {isHebrew
            ? ' סטופ רחב (2.0×ATR), R:R נמוך, שוק תנודתי'
            : ' Wide stop (2.0×ATR), low R:R, volatile market'}
        </div>
      </div>
    </div>
  )
}
