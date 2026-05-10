import useStore from '../../store/useStore'
import { fmtPrice, fmtChange } from '../../lib/formatters'
import { INTERVALS } from '../../../../shared/constants'

const INTERVAL_LABELS = {
  '1m': '1 דק׳',
  '5m': '5 דק׳',
  '15m': '15 דק׳',
  '1h': 'שעה',
  '4h': '4 שעות',
  '1d': 'יום',
  '1mo': 'חודש',
  '1y': 'שנה',
  '5y': '5 שנים',
}

export default function Header({ isConnected }) {
  const { currentTicker, snapshot, interval, setInterval, isLoading } = useStore()

  const changeColor = snapshot?.change >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="border-b border-slate-700 bg-slate-900 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-start lg:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {isConnected && <span className="live-dot shrink-0" />}
            <span className="text-lg font-bold text-white sm:text-xl">{currentTicker}</span>
            {snapshot?.name && (
              <span className="truncate text-xs text-slate-400 sm:text-sm">{snapshot.name}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {snapshot && (
              <>
                <span className="text-xl font-bold text-white sm:text-2xl">
                  {fmtPrice(snapshot.price)}
                </span>
                <span className={`text-sm font-medium ${changeColor}`}>
                  {fmtChange(snapshot.change, snapshot.changePct)}
                </span>
              </>
            )}
            {isLoading && <span className="text-sm text-slate-500">טוען...</span>}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max items-center gap-1 pb-1">
            <span className="hidden text-xs font-bold text-slate-500 md:inline">טווח</span>
            {INTERVALS.map(iv => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors sm:text-sm ${
                  interval === iv
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {INTERVAL_LABELS[iv] ?? iv}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
