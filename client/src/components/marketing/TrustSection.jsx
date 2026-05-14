import Card from '../ui/Card'
import SectionTitle from '../ui/SectionTitle'

const ITEMS = [
  {
    title: 'Market data sources',
    body: 'Price history, symbol search, and snapshots are pulled from Yahoo Finance. Earnings dates and revisions come from Nasdaq endpoints.',
  },
  {
    title: 'What the AI analyzes',
    body: 'Trend structure, moving averages, RSI, MACD, price patterns, support and resistance, earnings timing, multi-timeframe alignment, and broad market context.',
  },
  {
    title: 'How to read confidence',
    body: 'Confidence reflects how strongly the bullish and bearish evidence align. A higher score means the signal stack is more internally consistent, not that the trade is guaranteed.',
  },
  {
    title: 'How to read sentiment',
    body: 'Bullish, neutral, and bearish labels summarize the balance of evidence. They are designed to help frame the setup, not replace your own risk process.',
  },
]

export default function TrustSection() {
  return (
    <section className="space-y-6">
      <SectionTitle
        eyebrow="Trust / How it works"
        title="Explainable signals, transparent inputs, and clear limits."
        subtitle="The demo is intentionally explicit about where its data comes from, what it can infer, and why any conclusion still deserves human judgment."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {ITEMS.map(item => (
          <Card key={item.title} className="rounded-2xl p-5">
            <div className="text-sm font-bold text-white">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-300/12 bg-amber-300/6 px-5 py-4 text-sm leading-6 text-amber-50/90">
        This tool is for educational and informational purposes only and is not financial advice.
      </div>
    </section>
  )
}
