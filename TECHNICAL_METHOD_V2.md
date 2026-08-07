# Long-Term Technical Confluence Method v2

## Purpose

The Micha Method is a deterministic research layer that combines long-term trend, short-term timing, price structure, trendlines, technical patterns, Fibonacci, volume, and risk. Its score is an alignment score, not a probability and not a buy or sell instruction.

All calculations use the closed bars passed to the engine. A setup cannot become `triggered` because of score or risk/reward alone. It requires explicit closed-bar price confirmation and must pass trend, score, stop-distance, and risk/reward gates.

## Module Map

| Module | Responsibility |
| --- | --- |
| `config.js` | Auditable weights, thresholds, ATR buffers, confirmation rules, and risk limits. |
| `movingAverages.js` | SMA150/200 trend qualification, normalized 20/50-session slopes, SMA20 timing and ATR distance. |
| `levels.js` | Pivot clustering into ATR-width zones, strength scoring, false breaks, and support/resistance role changes. |
| `trendlines.js` | Three-touch ascending/descending lines, quality score, projection, close-based break and reclaim state. |
| `patterns.js` | Adapter over the shared pattern engine; normalizes contracts, rejects weak evidence, and de-duplicates overlap. |
| `fibonacci.js` | Directional completed-swing retracement, 23.6/38.2/50/61.8/78.6 levels and Golden Zone confluence. |
| `confluence.js` | Traceable weighted contributions. Every score component includes its source evidence. |
| `setup.js` | Setup classification, closed-bar trigger, technical stop candidates, invalidation, targets and risk/reward gates. |
| `scanner.js` | Pure scanner filtering and documented presets. |
| `backtest.js` | No-lookahead adapter to the existing walk-forward and split-sample infrastructure. |
| `index.js` | Stable public namespace, conclusions, observed/interpreted/risk separation and compact scanner payload. |

## Default Score Weights

| Evidence | Weight |
| --- | ---: |
| SMA150/200 long-term trend | 30% |
| SMA20 timing | 15% |
| Support/resistance | 20% |
| Trendlines | 10% |
| Technical patterns | 10% |
| Fibonacci | 10% |
| Volume | 5% |

Status bands are 85+ strong alignment, 70-84 good alignment, 55-69 mixed/constructive, 40-54 weak, 20-39 bearish, and below 20 strongly bearish. These bands never bypass setup confirmation.

## Setup and Risk Gates

A positive long-term qualification requires close above SMA150 and SMA200, SMA150 above SMA200, and a rising SMA200. Missing one condition is classified rather than silently converted to failure. Less than 200 closed bars blocks positive setup status.

An active setup remains `forming` or `ready_for_monitoring` until a closed bullish confirmation candle is observed, or the configured number of closes clears the trigger with supporting relative volume. A technically valid setup also requires:

- Long-term trend qualification.
- Confluence score at least 55.
- No confirmed bearish invalidation.
- Technical stop no wider than 12%.
- Risk/reward at least 1.5.

Stop candidates are derived independently from horizontal support, recent swing low, ascending trendline, Fibonacci 61.8%, and SMA20 when it belongs to the setup. The selected source and all candidates are returned. The stop is never moved merely to improve risk/reward.

## Scanner Presets

- `strong_long_term_trend`: all long-term conditions and score 70+.
- `healthy_pullback`: qualified trend, healthy SMA20 timing, nearby support, not extended, no trendline break.
- `golden_zone_pullback`: qualified trend, price in 50%-61.8%, support nearby, score 55+.
- `breakout_watch`: resistance nearby, pattern forming/pending/confirmed, price above SMA200, score 55+.
- `trend_breakdown_warning`: trendline break, both long averages lost, downtrend, or invalidated setup.

The Cup & Handle scanner still scans the verified S&P 500 universe. Micha filters operate on the compact technical-method fields returned for each verified candidate; they do not expand the universe or treat an ETF as an index constituent.

## API Shape

The stock analysis response keeps existing fields and adds the `technicalMethod` namespace. Important additions in v2 include `version`, `context`, `availability`, `evidenceQuality`, normalized `patterns`, stop candidates, trigger evidence, and explicit observed/interpreted/risk arrays.

```json
{
  "technicalMethod": {
    "version": "2.0.0",
    "score": 76.4,
    "evidenceQuality": 81.2,
    "setup": {
      "setupType": "pullback_to_sma20",
      "status": "ready_for_monitoring",
      "actionState": "prepare",
      "trigger": {
        "confirmed": false,
        "confirmationType": "closed_bar_price_confirmation"
      }
    },
    "risk": {
      "technicalInvalidationLevel": 94.2,
      "riskReward": 1.8,
      "stopCandidates": []
    },
    "conclusion": {
      "observedData": [],
      "interpretation": [],
      "riskNotes": []
    }
  }
}
```

## Chart and UI

The chart toggle displays SMA20/150/200, nearest support/resistance, trigger, invalidation, targets, Golden Zone and validated trendlines. One current-state annotation is shown to avoid clutter: monitoring, confirmed, or invalidated. The detailed panel labels confidence as evidence quality and separates observed facts, method interpretation, and risk.

## Validation

`runTechnicalMethodWalkForward` supports long-term only, trend plus SMA20, trend plus support, trend plus Fibonacci, trend plus pattern, and full-confluence variants. At every replay index it receives only `bars.slice(0, index + 1)`. The adapter reports forward-return and split-sample evidence through the existing infrastructure.

Known limitation: this adapter is not an execution simulator. It does not model fills, spread, commissions, position sizing, or stop orders. Its output must not be presented as strategy profitability, and meaningful conclusions require out-of-sample testing across symbols and market regimes.
