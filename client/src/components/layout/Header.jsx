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
    <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {isConnected && <span className="live-dot" />}
          <span className="text-xl font-bold text-white">{currentTicker}</span>
          {snapshot?.name && <span className="text-slate-400 text-sm hidden md:inline">{snapshot.name}</span>}
        </div>
        {snapshot && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{fmtPrice(snapshot.price)}</span>
            <span className={`text-sm font-medium ${changeColor}`}>
              {fmtChange(snapshot.change, snapshot.changePct)}
            </span>
          </div>
        )}
        {isLoading && <span className="text-slate-500 text-sm">טוען...</span>}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        <span className="hidden text-xs font-bold text-slate-500 md:inline">טווח</span>
        {INTERVALS.map(iv => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              interval === iv
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {INTERVAL_LABELS[iv] ?? iv}
          </button>
        ))}
      </div>
    </div>
  )
}
