import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Badge from '../ui/Badge'

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'AMZN', 'GOOGL']

export default function HeroSection({
  currentTicker,
  isLoading,
  onAnalyze,
  onPickTicker,
  lastLoadedTicker,
}) {
  const [value, setValue] = useState(currentTicker ?? '')
  const [inlineError, setInlineError] = useState('')

  useEffect(() => {
    setValue(currentTicker ?? '')
  }, [currentTicker])

  function handleSubmit(event) {
    event.preventDefault()
    const normalized = value.trim().toUpperCase()

    if (!normalized) {
      setInlineError('Enter a ticker symbol like AAPL or NVDA to start an analysis.')
      return
    }

    if (!/^[A-Z.^-]{1,12}$/.test(normalized)) {
      setInlineError('Use a market symbol only. Example: AAPL, MSFT, NVDA, SPY, or ^VIX.')
      return
    }

    setInlineError('')
    onAnalyze(normalized)
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,rgba(11,19,38,0.98),rgba(14,24,46,0.95))] p-6 shadow-premium sm:p-8 lg:p-10">
      <div className="relative grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
        <div className="flex flex-col gap-6">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Clear stock analysis before you make a move.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Review trend, sentiment, risk, and market context in one place.
            </p>
          </div>

          <form className="flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <Input
              aria-label="Ticker symbol"
              placeholder="Enter a ticker symbol like TSLA or AAPL"
              value={value}
              onChange={event => setValue(event.target.value.toUpperCase())}
              className="sm:flex-1"
            />
            <Button type="submit" size="lg" className="sm:min-w-[180px]">
              {isLoading ? 'Loading...' : 'Analyze'}
            </Button>
          </form>

          {inlineError && <div className="rounded-2xl border border-rose-400/15 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">{inlineError}</div>}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400">Popular:</span>
            {POPULAR_TICKERS.slice(0, 5).map(ticker => (
              <button
                key={ticker}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-primary/30 hover:text-white"
                onClick={() => {
                  setValue(ticker)
                  setInlineError('')
                  onPickTicker(ticker)
                }}
                type="button"
              >
                {ticker}
              </button>
            ))}
          </div>

          <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/6 bg-slate-950/30 p-4">
              <div className="text-sm font-semibold text-white">Trend overview</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">See whether the chart is rising, flat, or under pressure.</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/30 p-4">
              <div className="text-sm font-semibold text-white">Risk snapshot</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">Spot nearby support, resistance, and risk zones quickly.</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/30 p-4">
              <div className="text-sm font-semibold text-white">Market context</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">Check how broader market conditions may affect the setup.</div>
            </div>
          </div>
        </div>

        <Card className="rounded-[1.75rem] p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Example</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-white">{currentTicker}</div>
              </div>
              <Badge tone="balanced">{lastLoadedTicker ? 'Live' : 'Sample'}</Badge>
            </div>

            <p className="text-sm leading-6 text-slate-300">
              Momentum is improving, but resistance remains nearby.
            </p>

            <div className="flex flex-wrap gap-2">
              <Badge tone="balanced">Trend: Mixed</Badge>
              <Badge tone="positive">Sentiment: Positive</Badge>
              <Badge tone="warning">Risk: Medium</Badge>
            </div>

            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => onAnalyze(value.trim().toUpperCase() || currentTicker)}>
              View Analysis
            </Button>
          </div>
        </Card>
      </div>
    </section>
  )
}
