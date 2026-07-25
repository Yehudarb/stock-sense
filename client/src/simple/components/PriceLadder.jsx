import { fmtPrice } from '../../lib/formatters'

const TONE_STYLE = {
  bullish: 'border-green-400/40 bg-green-500/10 text-green-300',
  bearish: 'border-red-400/40 bg-red-500/10 text-red-300',
  neutral: 'border-blue-400/40 bg-blue-500/10 text-blue-300',
}

/**
 * rungs: [{ key, label, price, tone }] - rendered highest price on top.
 * currentPrice draws a marker next to the rung it currently sits closest to.
 */
export default function PriceLadder({ rungs, currentPrice }) {
  const sorted = [...rungs]
    .filter(rung => rung.price != null)
    .sort((a, b) => b.price - a.price)

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(rung => {
        const isCurrent = currentPrice != null && sorted[0] &&
          Math.abs(rung.price - currentPrice) === Math.min(...sorted.map(r => Math.abs(r.price - currentPrice)))

        return (
          <div
            key={rung.key}
            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${TONE_STYLE[rung.tone] ?? TONE_STYLE.neutral} ${isCurrent ? 'ring-2 ring-white/40' : ''}`}
          >
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">{rung.label}</span>
            <span className="text-base font-black">{fmtPrice(rung.price)}</span>
          </div>
        )
      })}
    </div>
  )
}
