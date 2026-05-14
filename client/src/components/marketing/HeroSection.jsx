import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import SectionTitle from '../ui/SectionTitle'
import Badge from '../ui/Badge'

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'AMZN', 'GOOGL']

export default function HeroSection({
  currentTicker,
  isLoading,
  onAnalyze,
  onPickTicker,
  watchlistCount = 0,
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
    <section className="relative overflow-hidden rounded-[2rem] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_32%),linear-gradient(180deg,rgba(11,19,38,0.98),rgba(14,24,46,0.95))] p-6 shadow-premium sm:p-8 lg:p-10">
      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] lg:block" />

      <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <div className="flex flex-col gap-6">
          <SectionTitle
            eyebrow="Stock Sense Demo"
            title="AI-powered stock analysis that compares bullish and bearish signals before giving a market outlook."
            subtitle="Run a fast, explainable read on price action, technical structure, market context, and event risk before you decide what to do next."
          />

          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <Input
              aria-label="Ticker symbol"
              placeholder="Enter ticker symbol, e.g. AAPL"
              value={value}
              onChange={event => setValue(event.target.value.toUpperCase())}
              className="sm:flex-1"
            />
            <Button type="submit" size="lg" className="sm:min-w-[180px]">
              {isLoading ? 'Running analysis...' : 'Analyze a Stock'}
            </Button>
          </form>

          {inlineError && <div className="rounded-2xl border border-rose-400/15 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">{inlineError}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Popular tickers</span>
            {POPULAR_TICKERS.map(ticker => (
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">What it does</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Compares trend, momentum, pattern, risk, and macro context before surfacing a directional outlook.</div>
            </Card>
            <Card className="rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Trust layer</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Every analysis includes confidence, risk, and the main reasons supporting and challenging the setup.</div>
            </Card>
            <Card className="rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Best for</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Fast demo research, idea validation, and educational walkthroughs before placing a trade elsewhere.</div>
            </Card>
          </div>
        </div>

        <Card className="rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Demo analysis card</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-white">{currentTicker}</div>
            </div>
            <Badge tone="balanced">{lastLoadedTicker ? `Last loaded: ${lastLoadedTicker}` : 'Live demo'}</Badge>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/6 p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Sample output</div>
              <div className="mt-2 text-base font-bold text-emerald-100">Bullish vs bearish evidence is weighed before a final outlook is shown.</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">You will see a TL;DR, sentiment, confidence score, bull case, bear case, key risks, technical read, and a final AI stance.</div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/6 bg-slate-950/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Saved watchlist</div>
                <div className="mt-2 text-lg font-bold text-white">{watchlistCount}</div>
                <div className="mt-1 text-sm text-slate-400">Tracked names in the demo workspace.</div>
              </div>
              <div className="rounded-2xl border border-white/6 bg-slate-950/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Shareable report</div>
                <div className="mt-2 text-sm font-semibold text-white">Placeholder ready</div>
                <div className="mt-1 text-sm text-slate-400">Use the report CTA below to stage a share flow.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button variant="secondary" size="lg" onClick={() => onAnalyze(value.trim().toUpperCase() || currentTicker)}>
                Try Demo Analysis
              </Button>
              <Button variant="ghost" size="lg" className="border border-white/10" onClick={() => onPickTicker('NVDA')}>
                Compare two stocks
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
