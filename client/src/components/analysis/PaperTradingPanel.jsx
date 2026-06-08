import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import { fmtPercent, fmtPrice } from '../../lib/formatters'
import { TRADER_TEXT } from '../../lib/traderColors'

function MetricCard({ label, value, accent = 'text-white', subtext = '' }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/45 p-4 backdrop-blur-md">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-black tracking-tight ${accent}`}>{value}</div>
      {subtext ? <div className="mt-1 text-xs text-slate-500">{subtext}</div> : null}
    </div>
  )
}

function toneForPnl(value) {
  if (value == null) return 'text-slate-200'
  if (value > 0) return TRADER_TEXT.bullish
  if (value < 0) return TRADER_TEXT.bearish
  return 'text-slate-200'
}

function inputValue(value) {
  return value == null || Number.isNaN(Number(value)) ? '' : String(value)
}

function Field({ children, label }) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ControlInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 text-white outline-none transition focus:border-primary/50 ${props.className ?? ''}`}
    />
  )
}

export default function PaperTradingPanel({
  currentTicker,
  snapshot,
  decision,
  language = 'he',
  account,
  isLoading,
  isSaving,
  error,
  onCreateOrder,
  onCancelOrder,
  onClosePosition,
  onResetAccount,
  onUpdateSettings,
}) {
  const isEnglish = language === 'en'
  const [side, setSide] = useState('long')
  const [orderType, setOrderType] = useState('market')
  const [quantity, setQuantity] = useState(10)
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [settingsDraft, setSettingsDraft] = useState(null)

  useEffect(() => {
    setEntryPrice(inputValue(snapshot?.price))
    setStopLoss(inputValue(decision?.invalidation ?? decision?.stopLoss))
    setTakeProfit(inputValue(decision?.takeProfit ?? decision?.holdUntil))
    setNotes('')
  }, [currentTicker, snapshot?.price, decision?.invalidation, decision?.stopLoss, decision?.takeProfit, decision?.holdUntil])

  useEffect(() => {
    if (!account?.riskSettings) return
    setSettingsDraft({
      riskPerTradePct: account.riskSettings.riskPerTradePct,
      maxDailyLossPct: account.riskSettings.maxDailyLossPct,
      maxOpenPositions: account.riskSettings.maxOpenPositions,
      maxSymbolExposurePct: account.riskSettings.maxSymbolExposurePct,
      commissionPerTrade: account.riskSettings.commissionPerTrade,
      slippageBps: account.riskSettings.slippageBps,
      shortSellingEnabled: account.riskSettings.shortSellingEnabled,
    })
  }, [account?.riskSettings])

  const copy = {
    badge: isEnglish ? 'Demo mode' : 'מצב דמו',
    paperOnly: isEnglish ? 'Paper trading only' : 'מסחר מדומה בלבד',
    educational: isEnglish ? 'Educational simulation' : 'סימולציה לימודית',
    noAdvice: isEnglish ? 'Not financial advice' : 'לא ייעוץ פיננסי',
    title: isEnglish ? 'Demo trading workspace' : 'מרחב מסחר דמו',
    subtitle: isEnglish
      ? 'Create demo orders, manage pending entries, and train risk management on live market data.'
      : 'פתח פקודות דמו, נהל פקודות ממתינות, ותרגל ניהול סיכון על נתוני שוק חיים.',
    cash: isEnglish ? 'Cash' : 'מזומן',
    equity: isEnglish ? 'Equity' : 'שווי תיק',
    realized: isEnglish ? 'Realized P&L' : 'רווח ממומש',
    unrealized: isEnglish ? 'Open P&L' : 'רווח פתוח',
    returnPct: isEnglish ? 'Return %' : 'תשואה %',
    winRate: isEnglish ? 'Win rate' : 'אחוז הצלחה',
    orderTicket: isEnglish ? 'Demo order ticket' : 'טופס פקודת דמו',
    riskSettings: isEnglish ? 'Risk settings' : 'הגדרות סיכון',
    pendingOrders: isEnglish ? 'Pending orders' : 'פקודות ממתינות',
    openPositions: isEnglish ? 'Open positions' : 'פוזיציות פתוחות',
    closedTrades: isEnglish ? 'Recent trade journal' : 'יומן עסקאות אחרון',
    side: isEnglish ? 'Side' : 'כיוון',
    long: isEnglish ? 'Long' : 'לונג',
    short: isEnglish ? 'Short' : 'שורט',
    orderType: isEnglish ? 'Order type' : 'סוג פקודה',
    market: isEnglish ? 'Market' : 'מרקט',
    limit: isEnglish ? 'Limit' : 'לימיט',
    stop: isEnglish ? 'Stop entry' : 'סטופ כניסה',
    quantity: isEnglish ? 'Quantity' : 'כמות',
    entryPrice: isEnglish ? 'Entry / trigger price' : 'מחיר כניסה / טריגר',
    stopLoss: isEnglish ? 'Stop loss' : 'סטופ לוס',
    takeProfit: isEnglish ? 'Take profit' : 'טייק פרופיט',
    notes: isEnglish ? 'Notes' : 'הערות',
    submit: isEnglish ? 'Create order' : 'צור פקודה',
    close: isEnglish ? 'Close now' : 'סגור עכשיו',
    cancel: isEnglish ? 'Cancel' : 'בטל',
    reset: isEnglish ? 'Reset simulator' : 'אפס סימולטור',
    noPending: isEnglish ? 'No pending orders.' : 'אין פקודות ממתינות.',
    noOpen: isEnglish ? 'No open positions.' : 'אין פוזיציות פתוחות.',
    noClosed: isEnglish ? 'No closed trades yet.' : 'אין עדיין עסקאות סגורות.',
    exposure: isEnglish ? 'Exposure' : 'חשיפה',
    pnl: isEnglish ? 'P&L' : 'רווח/הפסד',
    status: isEnglish ? 'Status' : 'סטטוס',
    opened: isEnglish ? 'Opened' : 'נפתח',
    closed: isEnglish ? 'Closed' : 'נסגר',
    reason: isEnglish ? 'Exit reason' : 'סיבת יציאה',
    assumption: isEnglish ? 'Execution assumption' : 'הנחת ביצוע',
    saveSettings: isEnglish ? 'Save settings' : 'שמור הגדרות',
    riskPerTradePct: isEnglish ? 'Risk per trade %' : 'סיכון לעסקה %',
    maxDailyLossPct: isEnglish ? 'Max daily loss %' : 'הפסד יומי מקסימלי %',
    maxOpenPositions: isEnglish ? 'Max open trades' : 'מספר עסקאות מקסימלי',
    maxSymbolExposurePct: isEnglish ? 'Max symbol exposure %' : 'חשיפה מקסימלית למניה %',
    commissionPerTrade: isEnglish ? 'Commission / share' : 'עמלה ליחידה',
    slippageBps: isEnglish ? 'Slippage (bps)' : 'סליפג׳ (bps)',
    shortEnabled: isEnglish ? 'Allow short selling' : 'אפשר שורט',
    updated: isEnglish ? 'Updated' : 'עודכן',
    stats: isEnglish ? 'Performance stats' : 'סטטיסטיקות ביצועים',
    avgWin: isEnglish ? 'Average win' : 'רווח ממוצע',
    avgLoss: isEnglish ? 'Average loss' : 'הפסד ממוצע',
    openCount: isEnglish ? 'Open trades' : 'עסקאות פתוחות',
    pendingCount: isEnglish ? 'Pending orders' : 'פקודות ממתינות',
    closedCount: isEnglish ? 'Closed trades' : 'עסקאות סגורות',
    dailyLoss: isEnglish ? 'Daily realized loss' : 'הפסד יומי ממומש',
    created: isEnglish ? 'Demo order created.' : 'פקודת דמו נוצרה.',
    settingsSaved: isEnglish ? 'Risk settings updated.' : 'הגדרות הסיכון עודכנו.',
    positionClosed: isEnglish ? 'Position closed.' : 'הפוזיציה נסגרה.',
    orderCancelled: isEnglish ? 'Pending order cancelled.' : 'הפקודה בוטלה.',
    resetDone: isEnglish ? 'Simulator reset complete.' : 'הסימולטור אופס.',
    currentSignal: isEnglish ? 'Prefilled from current analysis' : 'הוזן לפי הניתוח הנוכחי',
  }

  async function handleCreateOrder(event) {
    event.preventDefault()
    setMessage('')
    try {
      await onCreateOrder({
        ticker: currentTicker,
        side,
        orderType,
        quantity: Number(quantity),
        entryPrice: entryPrice === '' ? null : Number(entryPrice),
        stopLoss: stopLoss === '' ? null : Number(stopLoss),
        takeProfit: takeProfit === '' ? null : Number(takeProfit),
        notes,
      })
      setMessage(copy.created)
    } catch (nextError) {
      setMessage(nextError.message)
    }
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    if (!settingsDraft) return
    setMessage('')
    try {
      await onUpdateSettings({
        ...settingsDraft,
        riskPerTradePct: Number(settingsDraft.riskPerTradePct),
        maxDailyLossPct: Number(settingsDraft.maxDailyLossPct),
        maxOpenPositions: Number(settingsDraft.maxOpenPositions),
        maxSymbolExposurePct: Number(settingsDraft.maxSymbolExposurePct),
        commissionPerTrade: Number(settingsDraft.commissionPerTrade),
        slippageBps: Number(settingsDraft.slippageBps),
      })
      setMessage(copy.settingsSaved)
    } catch (nextError) {
      setMessage(nextError.message)
    }
  }

  async function handleClosePosition(positionId) {
    setMessage('')
    try {
      await onClosePosition(positionId)
      setMessage(copy.positionClosed)
    } catch (nextError) {
      setMessage(nextError.message)
    }
  }

  async function handleCancelOrder(orderId) {
    setMessage('')
    try {
      await onCancelOrder(orderId)
      setMessage(copy.orderCancelled)
    } catch (nextError) {
      setMessage(nextError.message)
    }
  }

  async function handleReset() {
    setMessage('')
    try {
      await onResetAccount()
      setMessage(copy.resetDone)
    } catch (nextError) {
      setMessage(nextError.message)
    }
  }

  if (isLoading && !account) {
    return (
      <div className="rounded-3xl border border-white/8 bg-slate-950/40 p-6 text-sm text-slate-300">
        {isEnglish ? 'Loading demo trading workspace...' : 'טוען את מרחב מסחר הדמו...'}
      </div>
    )
  }

  if (!account) return null

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(14,116,144,0.14),rgba(15,23,42,0.9))] p-6 shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              {[copy.badge, copy.paperOnly, copy.educational, copy.noAdvice].map(tag => (
                <span key={tag} className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="mt-4 text-2xl font-black tracking-tight text-white">{copy.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{copy.subtitle}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleReset} disabled={isSaving}>
            {copy.reset}
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-6">
          <MetricCard label={copy.cash} value={fmtPrice(account.cash)} />
          <MetricCard label={copy.equity} value={fmtPrice(account.equity)} />
          <MetricCard label={copy.realized} value={fmtPrice(account.realizedPnl)} accent={toneForPnl(account.realizedPnl)} />
          <MetricCard label={copy.unrealized} value={fmtPrice(account.unrealizedPnl)} accent={toneForPnl(account.unrealizedPnl)} />
          <MetricCard label={copy.returnPct} value={fmtPercent(account.totalReturnPct)} accent={toneForPnl(account.totalReturnPct)} />
          <MetricCard label={copy.winRate} value={account.winRatePct == null ? '-' : fmtPercent(account.winRatePct)} />
        </div>

        <div className="mt-3 text-xs text-slate-500">
          {copy.updated}: {account.updatedAt ? new Date(account.updatedAt).toLocaleString(isEnglish ? 'en-US' : 'he-IL') : '-'}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
          <div className="text-sm font-bold text-white">{copy.orderTicket}</div>
          <div className="mt-1 text-xs text-slate-500">{currentTicker} · {copy.currentSignal}</div>

          <form className="mt-5 space-y-4" onSubmit={handleCreateOrder}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={copy.side}>
                <div className="flex gap-2">
                  {[
                    { id: 'long', label: copy.long },
                    { id: 'short', label: copy.short },
                  ].map(option => (
                    <button
                      key={option.id}
                      className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                        side === option.id
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-white/8 bg-slate-950/45 text-slate-300'
                      }`}
                      onClick={() => setSide(option.id)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={copy.orderType}>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'market', label: copy.market },
                    { id: 'limit', label: copy.limit },
                    { id: 'stop', label: copy.stop },
                  ].map(option => (
                    <button
                      key={option.id}
                      className={`rounded-2xl border px-3 py-3 text-sm font-bold transition-all ${
                        orderType === option.id
                          ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                          : 'border-white/8 bg-slate-950/45 text-slate-300'
                      }`}
                      onClick={() => {
                        setOrderType(option.id)
                        if (option.id === 'market') setEntryPrice(inputValue(snapshot?.price))
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={copy.quantity}>
                <ControlInput min="1" onChange={event => setQuantity(event.target.value)} type="number" value={quantity} />
              </Field>

              <Field label={copy.entryPrice}>
                <ControlInput
                  onChange={event => setEntryPrice(event.target.value)}
                  readOnly={orderType === 'market'}
                  step="0.01"
                  type="number"
                  value={entryPrice}
                />
              </Field>

              <Field label={copy.stopLoss}>
                <ControlInput onChange={event => setStopLoss(event.target.value)} step="0.01" type="number" value={stopLoss} />
              </Field>

              <Field label={copy.takeProfit}>
                <ControlInput onChange={event => setTakeProfit(event.target.value)} step="0.01" type="number" value={takeProfit} />
              </Field>

              <Field label={copy.notes}>
                <textarea
                  className="min-h-[92px] w-full rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 text-white outline-none transition focus:border-primary/50 md:col-span-2"
                  onChange={event => setNotes(event.target.value)}
                  value={notes}
                />
              </Field>
            </div>

            {(error || message) ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-500/25 bg-rose-500/10 text-rose-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>
                {error || message}
              </div>
            ) : null}

            <Button className="w-full sm:w-auto" disabled={isSaving || !snapshot?.price} type="submit">
              {copy.submit}
            </Button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
          <div className="text-sm font-bold text-white">{copy.riskSettings}</div>
          {settingsDraft && (
            <form className="mt-4 space-y-4" onSubmit={handleSaveSettings}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.riskPerTradePct}>
                  <ControlInput onChange={event => setSettingsDraft(current => ({ ...current, riskPerTradePct: event.target.value }))} step="0.1" type="number" value={settingsDraft.riskPerTradePct} />
                </Field>
                <Field label={copy.maxDailyLossPct}>
                  <ControlInput onChange={event => setSettingsDraft(current => ({ ...current, maxDailyLossPct: event.target.value }))} step="0.1" type="number" value={settingsDraft.maxDailyLossPct} />
                </Field>
                <Field label={copy.maxOpenPositions}>
                  <ControlInput onChange={event => setSettingsDraft(current => ({ ...current, maxOpenPositions: event.target.value }))} step="1" type="number" value={settingsDraft.maxOpenPositions} />
                </Field>
                <Field label={copy.maxSymbolExposurePct}>
                  <ControlInput onChange={event => setSettingsDraft(current => ({ ...current, maxSymbolExposurePct: event.target.value }))} step="0.1" type="number" value={settingsDraft.maxSymbolExposurePct} />
                </Field>
                <Field label={copy.commissionPerTrade}>
                  <ControlInput onChange={event => setSettingsDraft(current => ({ ...current, commissionPerTrade: event.target.value }))} step="0.01" type="number" value={settingsDraft.commissionPerTrade} />
                </Field>
                <Field label={copy.slippageBps}>
                  <ControlInput onChange={event => setSettingsDraft(current => ({ ...current, slippageBps: event.target.value }))} step="1" type="number" value={settingsDraft.slippageBps} />
                </Field>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                <input
                  checked={settingsDraft.shortSellingEnabled}
                  onChange={event => setSettingsDraft(current => ({ ...current, shortSellingEnabled: event.target.checked }))}
                  type="checkbox"
                />
                <span>{copy.shortEnabled}</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label={copy.openCount} value={account.stats?.openCount ?? 0} />
                <MetricCard label={copy.pendingCount} value={account.stats?.pendingCount ?? 0} />
                <MetricCard label={copy.closedCount} value={account.stats?.closedCount ?? 0} />
                <MetricCard label={copy.dailyLoss} value={fmtPrice(account.stats?.dailyRealizedLoss ?? 0)} accent={toneForPnl(-(account.stats?.dailyRealizedLoss ?? 0))} />
                <MetricCard label={copy.avgWin} value={account.stats?.averageWin == null ? '-' : fmtPrice(account.stats.averageWin)} accent={toneForPnl(account.stats?.averageWin)} />
                <MetricCard label={copy.avgLoss} value={account.stats?.averageLoss == null ? '-' : fmtPrice(account.stats.averageLoss)} accent={toneForPnl(account.stats?.averageLoss)} />
              </div>

              <Button className="w-full sm:w-auto" disabled={isSaving} type="submit" variant="secondary">
                {copy.saveSettings}
              </Button>
            </form>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
        <div className="text-sm font-bold text-white">{copy.pendingOrders}</div>
        <div className="mt-4 space-y-3">
          {(account.pendingOrders ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">{copy.noPending}</div>
          ) : account.pendingOrders.map(order => (
            <div key={order.id} className="rounded-2xl border border-white/8 bg-slate-950/45 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="text-white font-bold">{order.ticker}</div>
                  <div>{copy.side}: {order.side === 'long' ? copy.long : copy.short}</div>
                  <div>{copy.orderType}: {copy[order.orderType]}</div>
                  <div>{copy.quantity}: {order.quantity}</div>
                  <div>{copy.entryPrice}: {fmtPrice(order.entryPrice)}</div>
                  <div>{copy.stopLoss}: {fmtPrice(order.stopLoss)}</div>
                  <div>{copy.takeProfit}: {order.takeProfit == null ? '-' : fmtPrice(order.takeProfit)}</div>
                  <div>{copy.status}: {order.status}</div>
                  <div>{copy.opened}: {new Date(order.createdAt).toLocaleString(isEnglish ? 'en-US' : 'he-IL')}</div>
                  <div>{copy.notes}: {order.notes || '-'}</div>
                </div>
                <Button disabled={isSaving} onClick={() => handleCancelOrder(order.id)} size="sm" variant="secondary">
                  {copy.cancel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
        <div className="text-sm font-bold text-white">{copy.openPositions}</div>
        <div className="mt-4 space-y-3">
          {account.openPositions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">{copy.noOpen}</div>
          ) : account.openPositions.map(position => (
            <div key={position.id} className="rounded-2xl border border-white/8 bg-slate-950/45 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="text-white font-bold">{position.ticker}</div>
                  <div>{copy.side}: {position.side === 'long' ? copy.long : copy.short}</div>
                  <div>{copy.orderType}: {copy[position.orderType]}</div>
                  <div>{copy.quantity}: {position.quantity}</div>
                  <div>{copy.entryPrice}: {fmtPrice(position.entryPrice)}</div>
                  <div>{copy.stopLoss}: {fmtPrice(position.stopLoss)}</div>
                  <div>{copy.takeProfit}: {position.takeProfit == null ? '-' : fmtPrice(position.takeProfit)}</div>
                  <div>{copy.exposure}: {fmtPrice(position.exposure)}</div>
                  <div>{copy.pnl}: <span className={toneForPnl(position.unrealizedPnl)}>{fmtPrice(position.unrealizedPnl)} / {position.unrealizedPct == null ? '-' : fmtPercent(position.unrealizedPct)}</span></div>
                  <div>{copy.opened}: {new Date(position.openedAt).toLocaleString(isEnglish ? 'en-US' : 'he-IL')}</div>
                </div>
                <Button disabled={isSaving} onClick={() => handleClosePosition(position.id)} size="sm" variant="secondary">
                  {copy.close}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
        <div className="text-sm font-bold text-white">{copy.closedTrades}</div>
        <div className="mt-4 space-y-3">
          {account.closedTrades.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">{copy.noClosed}</div>
          ) : account.closedTrades.map(trade => (
            <div key={trade.id} className="rounded-2xl border border-white/8 bg-slate-950/45 p-4">
              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                <div className="text-white font-bold">{trade.ticker}</div>
                <div>{copy.side}: {trade.side === 'long' ? copy.long : copy.short}</div>
                <div>{copy.orderType}: {copy[trade.orderType]}</div>
                <div>{copy.quantity}: {trade.quantity}</div>
                <div className={toneForPnl(trade.realizedPnl)}>{fmtPrice(trade.realizedPnl)}</div>
                <div>{copy.entryPrice}: {fmtPrice(trade.entryPrice)}</div>
                <div>{copy.takeProfit}: {fmtPrice(trade.exitPrice)}</div>
                <div>{copy.reason}: {trade.exitReason}</div>
                <div>{copy.closed}: {new Date(trade.closedAt).toLocaleString(isEnglish ? 'en-US' : 'he-IL')}</div>
                <div>{copy.assumption}: {trade.executionAssumption}</div>
                <div>{copy.notes}: {trade.notes || '-'}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
