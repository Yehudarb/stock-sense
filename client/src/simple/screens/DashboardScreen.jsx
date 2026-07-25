import { fmtPrice } from '../../lib/formatters'
import SignalBadge from '../components/SignalBadge'
import GoalProgressBar from '../components/GoalProgressBar'
import TaxShieldMeter from '../components/TaxShieldMeter'
import PlainVerdictCard from '../../components/analysis/PlainVerdictCard'
import RiskPercentControl from '../components/RiskPercentControl'

/**
 * Screen 1 - answers "Should I trade today?"
 * Price, signal, one plain-language verdict paragraph, account value,
 * total P&L, goal progress, tax shield, and the risk-per-trade % control.
 */
export default function DashboardScreen({
  price,
  simpleSignal,
  account,
  goal,
  taxShield,
  language = 'he',
  onOpenTradeSetup,
  onOpenPosition,
  hasOpenPosition,
  onSaveRiskPct,
  isSavingRiskPct,
}) {
  const isHebrew = language === 'he'
  const totalPnl = (account?.realizedPnl ?? 0) + (account?.unrealizedPnl ?? 0)
  const pnlColor = totalPnl >= 0 ? 'text-green-300' : 'text-red-300'

  const copy = {
    price: isHebrew ? 'מחיר TSLL' : 'TSLL price',
    accountValue: isHebrew ? 'שווי חשבון' : 'Account value',
    totalPnl: isHebrew ? 'רווח/הפסד כולל' : 'Total P&L',
    enterTrade: isHebrew ? 'צפייה בהגדרת עסקה' : 'View trade setup',
    viewPosition: isHebrew ? 'צפייה בפוזיציה פתוחה' : 'View open position',
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{copy.price}</div>
        <div className="text-4xl font-black text-white">{fmtPrice(price)}</div>
      </div>

      <SignalBadge action={simpleSignal.action} confidence={simpleSignal.confidence} language={language} />

      <PlainVerdictCard decision={simpleSignal.decision} language={language} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
          <div className="text-xs font-semibold text-slate-500">{copy.accountValue}</div>
          <div className="mt-1 text-xl font-black text-white">{fmtPrice(account?.equity)}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-center">
          <div className="text-xs font-semibold text-slate-500">{copy.totalPnl}</div>
          <div className={`mt-1 text-xl font-black ${pnlColor}`}>
            {totalPnl >= 0 ? '+' : ''}{fmtPrice(totalPnl)}
          </div>
        </div>
      </div>

      <GoalProgressBar equity={account?.equity} goal={goal} language={language} />
      <TaxShieldMeter taxShield={taxShield} language={language} />

      <RiskPercentControl
        riskPct={account?.riskSettings?.riskPerTradePct}
        onSave={onSaveRiskPct}
        isSaving={isSavingRiskPct}
        language={language}
      />

      {hasOpenPosition && (
        <button
          type="button"
          onClick={onOpenPosition}
          className="w-full rounded-2xl bg-blue-500 py-4 text-lg font-black text-white shadow-lg shadow-blue-500/20 transition-transform active:scale-[0.98]"
        >
          {copy.viewPosition}
        </button>
      )}

      {!hasOpenPosition && simpleSignal.action === 'BUY' && (
        <button
          type="button"
          onClick={onOpenTradeSetup}
          className="w-full rounded-2xl bg-green-500 py-4 text-lg font-black text-slate-950 shadow-lg shadow-green-500/20 transition-transform active:scale-[0.98]"
        >
          {copy.enterTrade}
        </button>
      )}
    </div>
  )
}
