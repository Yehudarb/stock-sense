import useStore from '../../store/useStore'
import { fmtPrice, fmtChange } from '../../lib/formatters'
import { INTERVALS } from '../../../../shared/constants'
import StockLogo from '../ui/StockLogo'

const INTERVAL_LABELS = {
  he: {
    '1m': '1 דק׳',
    '5m': '5 דק׳',
    '15m': '15 דק׳',
    '1h': 'שעה',
    '4h': '4 שעות',
    '1d': 'יום',
    '1mo': 'חודש',
    '1y': 'שנה',
    '5y': '5 שנים',
  },
  en: {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1mo': '1mo',
    '1y': '1y',
    '5y': '5y',
  },
}

export default function Header({ isConnected }) {
  const { currentTicker, snapshot, interval, setInterval, isLoading, language, setLanguage } = useStore()
  const isHebrew = language === 'he'
  const copy = {
    loading: isHebrew ? 'טוען...' : 'Loading...',
    range: isHebrew ? 'טווח' : 'Range',
    language: isHebrew ? '🇮🇱 עברית' : '🇺🇸 English',
    switchLanguage: isHebrew ? 'Switch to English' : 'עבור לעברית',
  }

  const changeColor = snapshot?.change >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="border-b border-white/5 bg-surface/80 backdrop-blur-md px-3 py-3 sm:px-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-start lg:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {isConnected && <span className="live-dot shrink-0" />}
            <StockLogo ticker={currentTicker} size="md" />
            <span className="text-lg font-bold text-white sm:text-xl tracking-tight">{currentTicker}</span>
            {snapshot?.name && (
              <span className="truncate text-xs text-slate-400 sm:text-sm">{snapshot.name}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {snapshot && (
              <>
                <span className="text-xl font-bold text-white sm:text-2xl tracking-tight">
                  {fmtPrice(snapshot.price)}
                </span>
                <span className={`text-sm font-medium ${changeColor}`}>
                  {fmtChange(snapshot.change, snapshot.changePct)}
                </span>
              </>
            )}
            {isLoading && <span className="text-sm text-slate-500">{copy.loading}</span>}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max items-center gap-1 pb-1">
            <button
              onClick={() => setLanguage(isHebrew ? 'en' : 'he')}
              className="mr-2 rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-surface-bright transition-colors"
              title={copy.switchLanguage}
              aria-label={copy.switchLanguage}
            >
              {copy.language}
            </button>
            <span className="hidden text-xs font-bold text-slate-500 md:inline tracking-wider uppercase">{copy.range}</span>
            {INTERVALS.map(iv => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all sm:text-sm ${
                  interval === iv
                    ? 'bg-primary text-surface-muted shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:bg-surface-bright/50 hover:text-white'
                }`}
              >
                {INTERVAL_LABELS[language]?.[iv] ?? iv}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
