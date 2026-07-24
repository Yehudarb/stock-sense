import { useEffect, useState } from 'react'
import { Calculator, AlertTriangle } from 'lucide-react'

const STORAGE_KEY = 'stock-sense.position-sizing.v1'

function readStoredSettings() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Position Size = (Account x Risk%) / (Entry - Stop)
 * Standalone calculator - entry/stop are editable inputs (pre-filled from
 * currentPrice/suggestedStop when available) rather than pulled live from
 * TradingStopsPanel, so this stays usable even before a stop is picked.
 */
export default function PositionSizeCalculator({ currentPrice, suggestedStop, language = 'he' }) {
  const isHebrew = language === 'he'
  const stored = readStoredSettings()

  const [accountSize, setAccountSize] = useState(stored.accountSize ?? '10000')
  const [riskPct, setRiskPct] = useState(stored.riskPct ?? '2')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')

  // Pre-fill entry/stop once real values arrive, without clobbering a value
  // the user already typed.
  useEffect(() => {
    if (!entryPrice && currentPrice != null) setEntryPrice(currentPrice.toFixed(2))
  }, [currentPrice]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!stopPrice && suggestedStop != null) setStopPrice(suggestedStop.toFixed(2))
  }, [suggestedStop]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountSize, riskPct }))
  }, [accountSize, riskPct])

  const account = parseFloat(accountSize)
  const risk = parseFloat(riskPct)
  const entry = parseFloat(entryPrice)
  const stop = parseFloat(stopPrice)

  const inputsValid = [account, risk, entry, stop].every(Number.isFinite) && account > 0 && risk > 0 && entry > 0
  const riskPerShare = inputsValid ? entry - stop : null
  const stopBelowEntry = riskPerShare != null && riskPerShare > 0

  let result = null
  if (inputsValid && stopBelowEntry) {
    const riskAmount = account * (risk / 100)
    const shares = Math.floor(riskAmount / riskPerShare)
    const positionValue = shares * entry
    const accountPct = (positionValue / account) * 100

    result = {
      riskAmount,
      shares,
      positionValue,
      accountPct,
      overLeveraged: accountPct > 100,
    }
  }

  const copy = {
    title: isHebrew ? '📐 מחשבון גודל פוזיציה' : '📐 Position Size Calculator',
    account: isHebrew ? 'גודל חשבון ($)' : 'Account size ($)',
    risk: isHebrew ? 'סיכון לעסקה (%)' : 'Risk per trade (%)',
    entry: isHebrew ? 'מחיר כניסה' : 'Entry price',
    stop: isHebrew ? 'מחיר Stop' : 'Stop price',
    riskAmount: isHebrew ? 'סיכון בדולרים' : 'Dollar risk',
    riskPerShare: isHebrew ? 'סיכון למניה' : 'Risk per share',
    shares: isHebrew ? 'מניות לקנייה' : 'Shares to buy',
    positionValue: isHebrew ? 'שווי פוזיציה' : 'Position value',
    accountPct: isHebrew ? 'אחוז מהחשבון' : '% of account',
    invalidStop: isHebrew ? 'ה-Stop חייב להיות מתחת למחיר הכניסה' : 'Stop must be below entry price',
    overLeveraged: isHebrew
      ? 'שווי הפוזיציה עולה על גודל החשבון — נדרש מרווח/מינוף, שקול להקטין סיכון.'
      : 'Position value exceeds account size — requires margin/leverage; consider reducing risk.',
  }

  return (
    <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        <Calculator size={14} />
        {copy.title}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-1.5">{copy.account}</label>
          <input
            type="number"
            min="0"
            step="100"
            value={accountSize}
            onChange={e => setAccountSize(e.target.value)}
            className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-2.5 py-1.5 text-sm text-white focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-1.5">{copy.risk}</label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={riskPct}
            onChange={e => setRiskPct(e.target.value)}
            className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-2.5 py-1.5 text-sm text-white focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-1.5">{copy.entry}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={entryPrice}
            onChange={e => setEntryPrice(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-2.5 py-1.5 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-1.5">{copy.stop}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={stopPrice}
            onChange={e => setStopPrice(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-2.5 py-1.5 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {inputsValid && !stopBelowEntry && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2 text-xs text-red-400">
          <AlertTriangle size={14} className="shrink-0" />
          {copy.invalidStop}
        </div>
      )}

      {result && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-900/40 border border-slate-800/50 p-2.5">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">{copy.riskAmount}</div>
              <div className="mt-0.5 text-sm font-black text-white">${result.riskAmount.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-slate-900/40 border border-slate-800/50 p-2.5">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">{copy.riskPerShare}</div>
              <div className="mt-0.5 text-sm font-black text-white">${riskPerShare.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-2.5">
              <div className="text-[10px] text-primary uppercase font-semibold">{copy.shares}</div>
              <div className="mt-0.5 text-lg font-black text-primary">{result.shares.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-900/40 border border-slate-800/50 p-2.5">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">{copy.positionValue}</div>
              <div className="mt-0.5 text-sm font-black text-white">${result.positionValue.toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {copy.accountPct}: <span className="font-semibold text-slate-300">{result.accountPct.toFixed(1)}%</span>
          </div>

          {result.overLeveraged && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">
              <AlertTriangle size={14} className="shrink-0" />
              {copy.overLeveraged}
            </div>
          )}
        </>
      )}
    </div>
  )
}
