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

function roundPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return ''
  return String(Math.round(Number(value) * 100) / 100)
}

function buildOrderDefaults({ side, orderType, snapshot, decision }) {
  const marketPrice = Number(snapshot?.price)
  const fallbackPrice = Number(decision?.currentPrice)
  const baseEntry = Number.isFinite(marketPrice) ? marketPrice : (Number.isFinite(fallbackPrice) ? fallbackPrice : null)
  const longStop = Number(decision?.invalidation ?? decision?.stopLoss)
  const longTarget = Number(decision?.takeProfit ?? decision?.holdUntil)
  const fallbackRiskPct = Math.abs(Number(decision?.downsidePct)) > 0 ? Math.abs(Number(decision?.downsidePct)) / 100 : 0.02
  const fallbackRewardPct = Math.abs(Number(decision?.upsidePct)) > 0 ? Math.abs(Number(decision?.upsidePct)) / 100 : 0.03

  let entry = baseEntry
  let stop = Number.isFinite(longStop) ? longStop : (Number.isFinite(baseEntry) ? baseEntry * (1 - fallbackRiskPct) : null)
  let target = Number.isFinite(longTarget) ? longTarget : (Number.isFinite(baseEntry) ? baseEntry * (1 + fallbackRewardPct) : null)

  if (side === 'short' && Number.isFinite(baseEntry)) {
    const riskDistance = Number.isFinite(stop) ? Math.abs(baseEntry - stop) : baseEntry * fallbackRiskPct
    const rewardDistance = Number.isFinite(target) ? Math.abs(target - baseEntry) : baseEntry * fallbackRewardPct
    stop = baseEntry + riskDistance
    target = Math.max(0.01, baseEntry - rewardDistance)
  }

  if ((orderType === 'limit' || orderType === 'stop') && Number.isFinite(baseEntry)) {
    const offset = baseEntry * 0.003
    entry = side === 'long'
      ? (orderType === 'limit' ? baseEntry - offset : baseEntry + offset)
      : (orderType === 'limit' ? baseEntry + offset : baseEntry - offset)
  }

  return {
    entryPrice: roundPrice(entry),
    stopLoss: roundPrice(stop),
    takeProfit: roundPrice(target),
  }
}

function computeBotQuantity({ snapshotPrice, stopLoss, settings, equity }) {
  const price = Number(snapshotPrice)
  const stop = Number(stopLoss)
  const riskPct = Number(settings?.riskPerTradePct ?? 1)
  if (!Number.isFinite(price) || !Number.isFinite(stop) || price <= 0 || stop <= 0 || !Number.isFinite(equity) || equity <= 0) {
    return 1
  }

  const riskPerShare = Math.abs(price - stop)
  if (!riskPerShare) return 1

  const maxRisk = equity * (riskPct / 100)
  const qty = Math.floor(maxRisk / riskPerShare)
  return Math.max(1, Math.min(5000, qty))
}

function buildBotPlan({ account, currentTicker, snapshot, decision, language }) {
  const isEnglish = language === 'en'
  const position = account?.openPositions?.find(item => item.ticker === currentTicker) ?? null
  const currentPrice = Number(snapshot?.price ?? decision?.currentPrice)
  const stopLoss = Number(decision?.invalidation ?? decision?.stopLoss)
  const takeProfit = Number(decision?.takeProfit ?? decision?.holdUntil)
  const recommendedQuantity = computeBotQuantity({
    snapshotPrice: currentPrice,
    stopLoss,
    settings: account?.riskSettings,
    equity: Number(account?.equity ?? account?.cash),
  })

  const base = {
    badge: isEnglish ? 'Demo Bot' : 'בוט דמו',
    warning: isEnglish ? 'Educational assistant only. Not live trading.' : 'עוזר לימודי בלבד. לא מסחר חי.',
    recommendedQuantity,
  }

  if (position) {
    const shouldExitLong = position.side === 'long' && ['SELL', 'STRONG_SELL'].includes(decision?.action)
    const shouldExitShort = position.side === 'short' && ['BUY', 'STRONG_BUY'].includes(decision?.action)
    const stopBreached = position.side === 'long'
      ? currentPrice <= Number(position.stopLoss)
      : currentPrice >= Number(position.stopLoss)
    const targetReached = position.takeProfit != null && (
      position.side === 'long'
        ? currentPrice >= Number(position.takeProfit)
        : currentPrice <= Number(position.takeProfit)
    )

    if (shouldExitLong || shouldExitShort || stopBreached || targetReached) {
      return {
        ...base,
        mode: 'close',
        tone: 'danger',
        title: isEnglish ? 'Bot suggests exit' : 'הבוט מציע יציאה',
        summary: isEnglish
          ? `Close the current ${position.side} demo position on ${currentTicker}.`
          : `לסגור את פוזיציית ה-${position.side === 'long' ? 'לונג' : 'שורט'} הנוכחית ב-${currentTicker}.`,
        reason: targetReached
          ? (isEnglish ? 'Target was reached.' : 'היעד הושג.')
          : stopBreached
            ? (isEnglish ? 'Stop was breached.' : 'הסטופ נשבר.')
            : isEnglish
              ? 'The current signal flipped against the open position.'
              : 'הסיגנל הנוכחי התהפך נגד הפוזיציה הפתוחה.',
        buttonLabel: isEnglish ? 'Close with bot' : 'סגור עם הבוט',
        positionId: position.id,
      }
    }

    return {
      ...base,
      mode: 'hold',
      tone: 'neutral',
      title: isEnglish ? 'Bot suggests hold' : 'הבוט מציע להחזיק',
      summary: isEnglish
        ? `Keep the ${position.side} demo position open while the setup remains valid.`
        : `להשאיר את פוזיציית ה-${position.side === 'long' ? 'לונג' : 'שורט'} פתוחה כל עוד הסטאפ נשאר תקין.`,
      reason: isEnglish
        ? 'Signal still aligns with the open position. Monitor stop and target.'
        : 'הסיגנל עדיין תומך בפוזיציה. לעקוב אחרי הסטופ והיעד.',
      buttonLabel: isEnglish ? 'No action now' : 'אין פעולה כרגע',
    }
  }

  if (['BUY', 'STRONG_BUY'].includes(decision?.action)) {
    return {
      ...base,
      mode: 'open',
      tone: 'positive',
      title: isEnglish ? 'Bot suggests long entry' : 'הבוט מציע כניסת לונג',
      summary: isEnglish ? `Open a demo long on ${currentTicker}.` : `לפתוח עסקת לונג דמו ב-${currentTicker}.`,
      reason: isEnglish
        ? `Current signal is ${decision?.primaryAction ?? 'bullish'} with defined stop and target.`
        : `הסיגנל הנוכחי הוא ${decision?.primaryAction ?? 'חיובי'} עם סטופ ויעד מוגדרים.`,
      buttonLabel: isEnglish ? 'Open long with bot' : 'פתח לונג עם הבוט',
      orderPayload: {
        ticker: currentTicker,
        side: 'long',
        orderType: 'market',
        quantity: recommendedQuantity,
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        notes: isEnglish ? 'Demo Bot long setup' : 'סטאפ לונג של בוט דמו',
      },
    }
  }

  if (['SELL', 'STRONG_SELL'].includes(decision?.action) && account?.riskSettings?.shortSellingEnabled) {
    return {
      ...base,
      mode: 'open',
      tone: 'danger',
      title: isEnglish ? 'Bot suggests short entry' : 'הבוט מציע כניסת שורט',
      summary: isEnglish ? `Open a demo short on ${currentTicker}.` : `לפתוח עסקת שורט דמו ב-${currentTicker}.`,
      reason: isEnglish
        ? 'The active signal is bearish and short selling is enabled in demo mode.'
        : 'הסיגנל הפעיל דובי ומסחר שורט מופעל במצב דמו.',
      buttonLabel: isEnglish ? 'Open short with bot' : 'פתח שורט עם הבוט',
      orderPayload: {
        ticker: currentTicker,
        side: 'short',
        orderType: 'market',
        quantity: recommendedQuantity,
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        notes: isEnglish ? 'Demo Bot short setup' : 'סטאפ שורט של בוט דמו',
      },
    }
  }

  return {
    ...base,
    mode: 'wait',
    tone: 'neutral',
    title: isEnglish ? 'Bot suggests waiting' : 'הבוט מציע להמתין',
    summary: isEnglish ? `No clean demo setup on ${currentTicker} right now.` : `אין כרגע סטאפ דמו נקי ב-${currentTicker}.`,
    reason: isEnglish
      ? 'Current signal does not justify a new entry.'
      : 'הסיגנל הנוכחי לא מצדיק כניסה חדשה.',
    buttonLabel: isEnglish ? 'Wait for setup' : 'המתן לסטאפ',
  }
}

function buildControlledBotPlan({ account, currentTicker, snapshot, decision, language, tradingBot }) {
  const isEnglish = language === 'en'
  const basePlan = buildBotPlan({ account, currentTicker, snapshot, decision, language })

  if (!tradingBot) {
    return {
      ...basePlan,
      mode: 'wait',
      tone: 'neutral',
      title: isEnglish ? 'Bot control loading' : 'בקרת בוט נטענת',
      summary: isEnglish ? 'Loading professional bot controls.' : 'טוען את בקרת הבוט המקצועית.',
      reason: isEnglish ? 'Waiting for bot state from server.' : 'ממתין למצב הבוט מהשרת.',
      buttonLabel: isEnglish ? 'Loading' : 'טוען',
    }
  }

  if (tradingBot.killSwitch) {
    return {
      ...basePlan,
      mode: 'wait',
      tone: 'danger',
      title: isEnglish ? 'Kill switch active' : 'Kill Switch פעיל',
      summary: isEnglish ? 'Automated bot actions are blocked.' : 'פעולות אוטומטיות של הבוט חסומות.',
      reason: isEnglish ? 'Disable the kill switch before allowing the bot to execute paper trades.' : 'יש לכבות את ה-Kill Switch לפני שהבוט יבצע עסקאות דמו.',
      buttonLabel: isEnglish ? 'Blocked' : 'חסום',
    }
  }

  if (!tradingBot.botEnabled) {
    return {
      ...basePlan,
      mode: 'wait',
      tone: 'neutral',
      title: isEnglish ? 'Bot is paused' : 'הבוט מושהה',
      summary: isEnglish ? 'Enable the professional bot first.' : 'יש להפעיל קודם את הבוט המקצועי.',
      reason: isEnglish ? 'Bot automation is currently disabled in the control panel.' : 'האוטומציה של הבוט כבויה כרגע בלוח הבקרה.',
      buttonLabel: isEnglish ? 'Paused' : 'מושהה',
    }
  }

  if (tradingBot.mode !== 'paper') {
    return {
      ...basePlan,
      mode: 'wait',
      tone: 'neutral',
      title: isEnglish ? 'Paper mode required' : 'נדרש מצב Paper',
      summary: isEnglish ? 'Bot execution is currently allowed only in paper mode.' : 'הבוט יכול לפעול כרגע רק במצב Paper.',
      reason: isEnglish ? `Current mode is ${tradingBot.mode}.` : `המצב הנוכחי הוא ${tradingBot.mode}.`,
      buttonLabel: isEnglish ? 'Switch mode' : 'החלף מצב',
    }
  }

  return basePlan
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
  tradingBot,
  tradingBotLoading = false,
  tradingBotSaving = false,
  tradingBotError = '',
  onCreateOrder,
  onCancelOrder,
  onClosePosition,
  onResetAccount,
  onUpdateSettings,
  onUpdateBotSettings,
  onRecordBotEvent,
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
  const [botDraft, setBotDraft] = useState(null)

  useEffect(() => {
    const defaults = buildOrderDefaults({ side: 'long', orderType: 'market', snapshot, decision })
    setSide('long')
    setOrderType('market')
    setEntryPrice(defaults.entryPrice)
    setStopLoss(defaults.stopLoss)
    setTakeProfit(defaults.takeProfit)
    setNotes('')
    setMessage('')
  }, [currentTicker, snapshot?.price, decision?.currentPrice, decision?.invalidation, decision?.stopLoss, decision?.takeProfit, decision?.holdUntil, decision?.downsidePct, decision?.upsidePct])

  useEffect(() => {
    const defaults = buildOrderDefaults({ side, orderType, snapshot, decision })
    setEntryPrice(defaults.entryPrice)
    setStopLoss(defaults.stopLoss)
    setTakeProfit(defaults.takeProfit)
    setMessage('')
  }, [side, orderType, snapshot, decision])

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

  useEffect(() => {
    if (!tradingBot) return
    setBotDraft({
      mode: tradingBot.mode,
      botEnabled: tradingBot.botEnabled,
      killSwitch: tradingBot.killSwitch,
      activeStrategy: tradingBot.activeStrategy,
      cooldownMinutes: tradingBot.cooldownMinutes,
      maxDailyLossPct: tradingBot.maxDailyLossPct,
      maxRiskPerTradePct: tradingBot.maxRiskPerTradePct,
      alertsEnabled: tradingBot.alertsEnabled,
      userConfirmedLiveTrading: tradingBot.userConfirmedLiveTrading,
    })
  }, [tradingBot])

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
    helperLongMarket: isEnglish ? 'Market long keeps stop below price and target above price.' : 'לונג מרקט שומר סטופ מתחת למחיר ויעד מעל המחיר.',
    helperShortMarket: isEnglish ? 'Market short keeps stop above price and target below price.' : 'שורט מרקט שומר סטופ מעל המחיר ויעד מתחת למחיר.',
    helperLongLimit: isEnglish ? 'Long limit waits below the market for a pullback entry.' : 'לונג לימיט ממתין מתחת למחיר לכניסת פולבק.',
    helperShortLimit: isEnglish ? 'Short limit waits above the market for a rally entry.' : 'שורט לימיט ממתין מעל המחיר לכניסה בריבאונד.',
    helperLongStop: isEnglish ? 'Long stop entry triggers only after a breakout higher.' : 'סטופ לונג יופעל רק אחרי פריצה כלפי מעלה.',
    helperShortStop: isEnglish ? 'Short stop entry triggers only after a breakdown lower.' : 'סטופ שורט יופעל רק אחרי שבירה כלפי מטה.',
    botControl: isEnglish ? 'Professional bot control' : 'בקרת בוט מקצועית',
    botMode: isEnglish ? 'Mode' : 'מצב',
    botEnabled: isEnglish ? 'Bot enabled' : 'הבוט פעיל',
    killSwitch: isEnglish ? 'Kill switch' : 'Kill Switch',
    strategy: isEnglish ? 'Strategy' : 'אסטרטגיה',
    cooldown: isEnglish ? 'Cooldown minutes' : 'דקות קירור',
    alertsEnabled: isEnglish ? 'Alerts enabled' : 'התראות פעילות',
    liveDisabled: isEnglish ? 'Live trading disabled' : 'מסחר חי מושבת',
    paperMode: isEnglish ? 'Paper' : 'Paper',
    backtestMode: isEnglish ? 'Backtest' : 'Backtest',
    liveMode: isEnglish ? 'Live (disabled by default)' : 'Live (כבוי כברירת מחדל)',
    saveBot: isEnglish ? 'Save bot settings' : 'שמור הגדרות בוט',
    botEvents: isEnglish ? 'Recent bot audit trail' : 'Audit trail אחרון של הבוט',
    noBotEvents: isEnglish ? 'No bot events logged yet.' : 'עדיין לא נרשמו אירועי בוט.',
    lastRun: isEnglish ? 'Last run' : 'ריצה אחרונה',
    botSaved: isEnglish ? 'Bot settings updated.' : 'הגדרות הבוט עודכנו.',
  }

  const orderHelperText = side === 'long'
    ? (orderType === 'market' ? copy.helperLongMarket : orderType === 'limit' ? copy.helperLongLimit : copy.helperLongStop)
    : (orderType === 'market' ? copy.helperShortMarket : orderType === 'limit' ? copy.helperShortLimit : copy.helperShortStop)
  const botPlan = buildControlledBotPlan({ account, currentTicker, snapshot, decision, language, tradingBot })

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

  async function handleBotAction() {
    setMessage('')
    try {
      if (botPlan.mode === 'open' && botPlan.orderPayload) {
        const nextAccount = await onCreateOrder(botPlan.orderPayload)
        await onRecordBotEvent?.({
          eventType: 'order_created',
          ticker: currentTicker,
          orderId: nextAccount?.openPositions?.[0]?.orderId ?? null,
          message: `Bot opened ${botPlan.orderPayload.side} paper order on ${currentTicker}.`,
          metadata: {
            action: 'open',
            side: botPlan.orderPayload.side,
            quantity: botPlan.orderPayload.quantity,
            strategy: tradingBot?.activeStrategy,
          },
        })
        setMessage(copy.created)
      } else if (botPlan.mode === 'close' && botPlan.positionId) {
        await onClosePosition(botPlan.positionId)
        await onRecordBotEvent?.({
          eventType: 'position_closed',
          ticker: currentTicker,
          message: `Bot closed paper position on ${currentTicker}.`,
          metadata: {
            action: 'close',
            strategy: tradingBot?.activeStrategy,
          },
        })
        setMessage(copy.positionClosed)
      }
    } catch (nextError) {
      setMessage(nextError.message)
    }
  }

  async function handleSaveBotSettings(event) {
    event.preventDefault()
    if (!botDraft) return
    setMessage('')
    try {
      await onUpdateBotSettings?.(botDraft)
      setMessage(copy.botSaved)
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

      <section className={`rounded-3xl border p-6 ${
        botPlan.tone === 'positive'
          ? 'border-emerald-400/18 bg-emerald-400/8'
          : botPlan.tone === 'danger'
            ? 'border-rose-400/18 bg-rose-400/8'
            : 'border-amber-300/18 bg-amber-300/8'
      }`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-200">{botPlan.badge}</div>
            <div className="mt-2 text-2xl font-black text-white">{botPlan.title}</div>
            <p className="mt-2 text-sm text-slate-200">{botPlan.summary}</p>
            <p className="mt-2 text-sm text-slate-300">{botPlan.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-1">
                {isEnglish ? `Suggested size: ${botPlan.recommendedQuantity}` : `כמות מוצעת: ${botPlan.recommendedQuantity}`}
              </span>
              <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-1">
                {botPlan.warning}
              </span>
            </div>
          </div>
          <Button
            disabled={isSaving || !['open', 'close'].includes(botPlan.mode)}
            onClick={handleBotAction}
            variant={botPlan.tone === 'danger' ? 'secondary' : 'primary'}
          >
            {botPlan.buttonLabel}
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
        <div className="text-sm font-bold text-white">{copy.botControl}</div>
        {botDraft && (
          <form className="mt-4 space-y-4" onSubmit={handleSaveBotSettings}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.botMode}>
                <select
                  className="w-full rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 text-white outline-none transition focus:border-primary/50"
                  onChange={event => setBotDraft(current => ({ ...current, mode: event.target.value }))}
                  value={botDraft.mode}
                >
                  <option value="paper">{copy.paperMode}</option>
                  <option value="backtest">{copy.backtestMode}</option>
                  <option value="live">{copy.liveMode}</option>
                </select>
              </Field>

              <Field label={copy.strategy}>
                <ControlInput onChange={event => setBotDraft(current => ({ ...current, activeStrategy: event.target.value }))} type="text" value={botDraft.activeStrategy} />
              </Field>

              <Field label={copy.cooldown}>
                <ControlInput onChange={event => setBotDraft(current => ({ ...current, cooldownMinutes: event.target.value }))} step="1" type="number" value={botDraft.cooldownMinutes} />
              </Field>

              <Field label={copy.riskPerTradePct}>
                <ControlInput onChange={event => setBotDraft(current => ({ ...current, maxRiskPerTradePct: event.target.value }))} step="0.1" type="number" value={botDraft.maxRiskPerTradePct} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                <input checked={botDraft.botEnabled} onChange={event => setBotDraft(current => ({ ...current, botEnabled: event.target.checked }))} type="checkbox" />
                <span>{copy.botEnabled}</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                <input checked={botDraft.killSwitch} onChange={event => setBotDraft(current => ({ ...current, killSwitch: event.target.checked }))} type="checkbox" />
                <span>{copy.killSwitch}</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                <input checked={botDraft.alertsEnabled} onChange={event => setBotDraft(current => ({ ...current, alertsEnabled: event.target.checked }))} type="checkbox" />
                <span>{copy.alertsEnabled}</span>
              </label>
              <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                {copy.liveDisabled}: {tradingBot?.liveTradingEnabled ? 'ON' : 'OFF'}
              </div>
            </div>

            {(tradingBotError || tradingBot?.warnings?.length) ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {tradingBotError || tradingBot.warnings.join(' ')}
              </div>
            ) : null}

            <div className="text-xs text-slate-500">
              {copy.lastRun}: {tradingBot?.lastRunAt ? new Date(tradingBot.lastRunAt).toLocaleString(isEnglish ? 'en-US' : 'he-IL') : '-'}
            </div>

            <Button disabled={isSaving || tradingBotSaving || tradingBotLoading} type="submit" variant="secondary">
              {copy.saveBot}
            </Button>
          </form>
        )}
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

            <div className="rounded-2xl border border-cyan-400/18 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100">
              {orderHelperText}
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

      <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-6">
        <div className="text-sm font-bold text-white">{copy.botEvents}</div>
        <div className="mt-4 space-y-3">
          {(tradingBot?.recentEvents ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">{copy.noBotEvents}</div>
          ) : tradingBot.recentEvents.map(event => (
            <div key={event.id} className="rounded-2xl border border-white/8 bg-slate-950/45 p-4">
              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                <div className="text-white font-bold">{event.eventType}</div>
                <div>{event.ticker ?? '-'}</div>
                <div>{event.mode}</div>
                <div>{event.strategyId ?? '-'}</div>
                <div>{new Date(event.timestamp).toLocaleString(isEnglish ? 'en-US' : 'he-IL')}</div>
                <div className="sm:col-span-2 xl:col-span-5">{event.message}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
