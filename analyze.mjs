// Runs the StockSense engine over live bars and prints one JSON analysis packet.
//
// The point is that the agent does not reimplement analysis in a prompt. It
// calls this, gets the same numbers the app shows, and spends its turn on
// judgement instead of arithmetic. Every field below comes from the engine that
// ships in the product — indicators, patterns, levels, structure — so the chat
// and the chart can never disagree.
//
// Client modules use extensionless imports that Vite resolves and Node does
// not, so this must be bundled before it runs:
//
//   node_modules/.bin/esbuild analyze.mjs --bundle --platform=node //     --format=esm --outfile=analyze.bundle.mjs
//   node analyze.bundle.mjs TICKER [interval]
//
// Rebuild the bundle after pulling; it is generated, not committed.

import { computeAll } from './client/src/lib/indicators.js'
import { computeSignal } from './client/src/lib/signals.js'
import { detectPatterns } from './client/src/lib/patterns.js'
import { computeProfessionalFeatures } from './client/src/lib/professionalFeatures.js'
import { computeRisk } from './client/src/lib/riskManagement.js'
import { computeEnsembleConsensus } from './client/src/lib/ensembleConsensus.js'
import { computeAnalystDecision } from './client/src/lib/analystDecision.js'
import { computeTechnicalAnalysis } from './client/src/lib/technicalAnalysis.js'
import { maTrendStructure } from './client/src/lib/maStructure.js'
import { measuredMoveTargets, patternBreakoutLevel, isTrendlinePattern } from './client/src/components/charts/chartHelpers.js'

const API = process.env.STOCKSENSE_API ?? 'https://stock-sense-demo.onrender.com'
const ticker = (process.argv[2] ?? '').toUpperCase()
const interval = process.argv[3] ?? '1d'
if (!ticker) {
  console.error('usage: node analyze.mjs TICKER [interval]')
  process.exit(2)
}

const get = async (path) => {
  const res = await fetch(API + path, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.json()
}

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)))

try {
  const [barsRes, snapshot] = await Promise.all([
    get(`/api/market/bars/${encodeURIComponent(ticker)}?interval=${interval}&limit=400`),
    get(`/api/market/snapshot/${encodeURIComponent(ticker)}`).catch(() => null),
  ])
  const bars = barsRes?.bars ?? []
  if (bars.length < 60) throw new Error(`only ${bars.length} bars available`)

  // Higher timeframes, best-effort: their absence degrades the report rather
  // than failing it.
  const weekly = await get(`/api/market/bars/${ticker}?interval=5y&limit=400`).then(r => r.bars).catch(() => null)
  const monthly = await get(`/api/market/bars/${ticker}?interval=1mo&limit=200`).then(r => r.bars).catch(() => null)

  const spot = bars.at(-1).c
  const ind = computeAll(bars)
  const patternResult = detectPatterns(bars)
  const base = computeSignal(bars, ind, patternResult, null)
  const pro = computeProfessionalFeatures(bars, ind, base)
  const risk = computeRisk(bars, ind, {
    nearestSupport: pro?.supportResistance?.nearestSupport ?? null,
    nearestResistance: pro?.supportResistance?.nearestResistance ?? null,
    patternInvalidation: patternResult?.best?.invalidationLevel ?? null,
  })
  const ensemble = computeEnsembleConsensus(bars, ind, { ...base, pro, patterns: patternResult })
  const decision = computeAnalystDecision(bars, ind, { ...base, pro, patterns: patternResult, ensemble }, risk, 'he')
  const ta = computeTechnicalAnalysis(ticker, { daily: bars, weekly, monthly, h4: null })
  const structure = maTrendStructure(ind, spot)

  // The leading pattern is the one the engine itself treats as the read, or one
  // sitting at its trigger — the same selection the chart draws levels for.
  const STAGES = new Set(['near_breakout', 'broken_out'])
  const leading = (patternResult?.patterns ?? [])
    .filter(p => p.key === patternResult?.best?.key || STAGES.has(p.meta?.stage))
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))[0] ?? null
  const trigger = leading ? patternBreakoutLevel(leading, spot) : null
  const dir = (leading?.direction ?? leading?.bias) === 'bearish' ? 'bearish' : 'bullish'

  const out = {
    ticker,
    interval,
    asOf: new Date(bars.at(-1).t).toISOString(),
    bars: bars.length,
    price: {
      spot: round(spot),
      snapshot: snapshot ? { price: round(snapshot.price), changePct: round(snapshot.changePct), volume: snapshot.volume } : null,
      high52: round(Math.max(...bars.slice(-252).map(b => b.h))),
      low52: round(Math.min(...bars.slice(-252).map(b => b.l))),
    },
    indicators: {
      rsi14: round(ind.rsi14.at(-1), 1),
      macd: { line: round(ind.macd.line.at(-1), 3), signal: round(ind.macd.signal.at(-1), 3), hist: round(ind.macd.histogram.at(-1), 3) },
      atr14: round(ind.atr14.at(-1)),
      atrPct: round((ind.atr14.at(-1) / spot) * 100),
      volRatio: round(ind.volRatio.at(-1), 2),
      sma: { 20: round(ind.sma20.at(-1)), 50: round(ind.sma50.at(-1)), 100: round(ind.sma100.at(-1)), 150: round(ind.sma150.at(-1)), 200: round(ind.sma200.at(-1)) },
    },
    maStructure: structure && {
      state: structure.state,
      passed: `${structure.passed}/${structure.total}`,
      checks: structure.checks.map(c => ({ name: c.labelEn, pass: c.pass })),
      slope200Pct: round(structure.slope200Pct, 1),
      ladder: structure.stack?.order,
      ladderBreaks: structure.stack?.breaks?.map(b => `${b.faster}/${b.slower}`) ?? [],
    },
    signal: { action: base.action, buyScore: base.buyScore, sellScore: base.sellScore },
    decision: decision && {
      action: decision.action ?? null,
      entry: round(decision.entryLow) ?? null,
      stop: round(decision.invalidation ?? decision.stopLoss),
      target: round(decision.takeProfit),
      support: round(decision.support),
      resistance: round(decision.resistance),
    },
    risk: risk && { stop: round(risk.stopLoss), target: round(risk.target), rrRatio: round(risk.rrRatio, 2) },
    keyLevels: ta?.keyLevels ?? null,
    technicalScore: ta?.technicalScore ?? null,
    patterns: (patternResult?.patterns ?? []).map(p => ({
      key: p.key,
      direction: p.direction ?? p.bias,
      weight: p.weight,
      stage: p.meta?.stage ?? null,
      target: round(p.targetPrice),
      trendlineFamily: isTrendlinePattern(p),
    })),
    leadingPattern: leading && {
      key: leading.key,
      direction: dir,
      stage: leading.meta?.stage ?? null,
      trigger: round(trigger),
      target: round(leading.targetPrice),
      stop: round(leading.meta?.invalidationLevel),
    },
    measuredMoveTargets: trigger != null
      ? measuredMoveTargets(bars, trigger, dir).map(t => ({ anchor: t.label, price: round(t.price), basis: t.basis }))
      : [],
    gaps: {
      total: pro?.gaps?.gaps?.length ?? 0,
      open: pro?.gaps?.openCount ?? 0,
      nearestOpen: pro?.gaps?.nearestOpen ? { low: round(pro.gaps.nearestOpen.zoneLow), high: round(pro.gaps.nearestOpen.zoneHigh) } : null,
    },
  }

  console.log(JSON.stringify(out, null, 2))
} catch (err) {
  console.log(JSON.stringify({ ticker, error: err.message }, null, 2))
  process.exit(1)
}
