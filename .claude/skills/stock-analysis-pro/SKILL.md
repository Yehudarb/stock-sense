---
name: stock-analysis-pro
description: Performs rigorous, evidence-based stock and ETF analysis using technicals, fundamentals, valuation, catalysts, risks, scenarios, and portfolio context. Use when the user asks to analyze a stock, ETF, leveraged ETF, entry, exit, target, stop, risk/reward, earnings setup, or compare securities.
---

# Stock Analysis Pro

Analyze the security named in `$ARGUMENTS`. If no ticker or company is provided, ask for it.

## Decision engine CLI

This skill now includes a rule-based and score-based Python decision engine under
`scripts/stock_analysis_pro`. From the repository root, run:

```bash
py cli.py analyze TSLA --style swing --account-size 25000 --risk-percent 1 --target-min 5 --target-max 12
```

The root `cli.py` is intentionally only a wrapper. Keep engine code, tests, and strategy
configuration inside this skill directory:

- `scripts/stock_analysis_pro/`
- `scripts/tests/`
- `config/settings.yaml`
- `config/strategies.yaml`

The engine must return one primary action from:

`BUY_NOW`, `WAIT_FOR_BREAKOUT`, `WAIT_FOR_PULLBACK`, `HOLD`,
`ADD_ONLY_IF_CONFIRMED`, `TAKE_PARTIAL_PROFIT`, `MOVE_STOP`, `EXIT_POSITION`,
`AVOID`, `INSUFFICIENT_DATA`.

It also returns JSON with data quality, market regime, technical analysis, fundamentals,
news, entry scenarios, trigger, stop loss, stop management, TP1/TP2/TP3, position sizing,
risk/reward, reason codes, alerts, next review conditions, and a concise Hebrew human
response.

## Core rule

Never invent prices, financial results, dates, estimates, news, analyst targets, technical levels, or probabilities.

Use current external data when tools are available. For every time-sensitive claim, record:
- source
- timestamp
- market session
- whether the data is real-time, delayed, end-of-day, estimated, or historical

If current data cannot be verified, say so explicitly and provide only a framework or historical analysis. Do not present stale data as current.

This skill provides research and decision support, not personalized investment advice or guaranteed predictions.

## Data sources inside StockSense

This project already exposes live market data. Prefer it over guessing — it is the primary
source for every price, bar, and indicator claim in the report.

Start the dev server first (`npm run dev` from the repo root; server on port 3001), then read:

| Need | Endpoint | Notes |
|---|---|---|
| OHLCV bars | `GET http://localhost:3001/api/market/bars/:ticker?interval=5m&limit=200` | `interval` ∈ `1m,5m,15m,1h,4h,1d,1mo,1y,5y`; `limit` clamped to 10–400. Bars are `{t,o,h,l,c,v}`, `t` = Unix ms |
| Current price / session stats | `GET /api/market/snapshot/:ticker` | LRU-cached 5s |
| Earnings dates | `GET /api/market/earnings/:ticker` | Use for the catalyst table — never recall an earnings date from memory |
| Fear & Greed | `GET /api/market/feargreed` | market-regime context |
| Ticker resolution | `GET /api/market/search?q=...` | use to validate the instrument (step 1) |
| Company profile / news | `GET /api/finnhub/profile/:ticker`, `GET /api/finnhub/news/:ticker` | requires `FINNHUB_API_KEY` in the server env; if unset these fail — mark the fundamentals/catalyst sections DEGRADED rather than filling them from memory |
| ATR-based stops | `GET /api/trading-engine/calculate-stops/:ticker` | project's own stop/target math — reuse it instead of inventing levels |
| Existing position | `GET /api/paper-trading` | supplies average price, size, and P&L for the existing-position section |

**Data-quality signal:** the market routes set the response header `X-Data-Source: stale-cache`
when the live fetch failed and cached data was served. If that header is present, the data
quality label is at best **DEGRADED** — say so and do not emit precise trade instructions.

Indicator math lives client-side in `client/src/lib/` and is the reference implementation for
this project — do not re-derive a different convention:
- `indicators.js` — RSI(14), Stochastic(14,3), Williams %R(14), MACD(12,26,9), Bollinger(20,2), ATR(14), Donchian(20), SMA 20/50/200, EMA 20/50
- `marketStructure.js` — HH/HL, BOS, CHoCH primary-trend classification
- `signals.js` — trend gate → gradient scoring → confluence → reversal confirmation
- `patterns.js` — 10 chart patterns
- `riskManagement.js` — stop = price − 1.5×ATR, target = price + 2.0×ATR, trailing = price − 1.2×ATR

A score from `signals.js` is a score, not a probability. Report it as evidence, never as a
likelihood, and never as a standalone entry trigger.

## Required inputs

Infer these when possible:
- ticker and exchange
- security type: stock, ETF, leveraged ETF, inverse ETF, ADR, option, or other
- requested horizon: intraday, swing, medium-term, or long-term
- user goal: new entry, existing position, recovery plan, exit, comparison, or general research
- position details if provided: average price, quantity, portfolio size, concentration, time horizon, and maximum acceptable loss

Do not delay the analysis for minor missing details. Use clearly labeled assumptions.

## Analysis workflow

### 1. Validate the instrument

Confirm:
- exact ticker and company/fund name
- exchange
- currency
- security type
- whether it is leveraged or inverse
- benchmark or underlying asset
- split, reverse-split, delisting, merger, or symbol-change risk
- market session and trading status

For leveraged ETFs, explicitly analyze:
- daily reset
- leverage multiple
- compounding path dependency
- volatility decay
- tracking error
- expense ratio
- liquidity
- suitability by holding period

### 2. Data-quality gate

Before drawing conclusions:
- compare timestamps across sources
- reject contradictory or incomplete data
- distinguish adjusted from unadjusted prices
- check for splits and dividends
- confirm that technical indicators use a consistent timeframe and provider
- avoid mixing live, delayed, and end-of-day observations without disclosure

Assign:
- VERIFIED
- ACCEPTABLE
- DEGRADED
- UNAVAILABLE

When data quality is DEGRADED or UNAVAILABLE, reduce confidence and avoid precise trade instructions.

In this project: a reachable server with fresh bars and snapshot is at most ACCEPTABLE for
intraday claims (Yahoo data is delayed for many symbols); `X-Data-Source: stale-cache`,
a missing `FINNHUB_API_KEY`, or a server that is not running downgrades to DEGRADED or
UNAVAILABLE respectively.

### 3. Market context

Analyze:
- broad index trend
- sector and industry trend
- rates, inflation, currency, commodities, or macro factors when relevant
- risk-on/risk-off regime
- correlation with the underlying asset and benchmark
- relative strength versus sector and index
- upcoming market-moving events

Do not overstate macro explanations. Separate observed facts from interpretation.

### 4. Business and fundamental analysis

For operating companies, evaluate:
- business model and revenue drivers
- segment mix
- competitive position and moat
- management execution
- revenue growth
- gross, operating, and free-cash-flow margins
- EPS quality
- cash flow conversion
- cash, debt, liquidity, and refinancing risk
- dilution and stock-based compensation
- return on invested capital when meaningful
- cyclicality
- customer or supplier concentration
- regulatory and legal exposure

Compare:
- latest quarter
- year-over-year trend
- sequential trend
- trailing twelve months
- company guidance
- consensus expectations where verified

Separate:
- reported facts
- management guidance
- analyst consensus
- your inference

For ETFs, replace company fundamentals with:
- mandate and index methodology
- holdings and concentration
- rebalance rules
- leverage structure
- expense ratio
- assets under management
- volume and spread
- tracking difference
- issuer and closure risk

### 5. Valuation

Use metrics appropriate to the business:
- P/E
- forward P/E
- PEG
- EV/EBITDA
- EV/Sales
- price-to-sales
- price-to-free-cash-flow
- free-cash-flow yield
- price-to-book when relevant
- sum-of-the-parts when justified

Compare valuation against:
- own historical range
- direct peers
- sector
- expected growth and margins

Do not conclude that a low multiple automatically means cheap or a high multiple automatically means overvalued.

Present at least three valuation cases:
- bear
- base
- bull

State assumptions and avoid false precision.

### 6. Technical analysis

Use multiple timeframes appropriate to the horizon.

Evaluate:
- market structure: higher highs/lows or lower highs/lows
- trend
- support and resistance
- moving averages: 9, 20, 50, 100, 200 where appropriate
- RSI
- MACD
- ATR
- volume and relative volume
- gaps
- VWAP for intraday analysis
- Bollinger Bands: 20-period, 2 standard deviations
- Bollinger bandwidth
- Bollinger %B
- squeeze and expansion
- distance from support, resistance, and moving averages
- overextended conditions

Bollinger Bands must never be the sole entry or exit signal.

Confirm technical setups using price structure, volume, momentum, and market context.

Only use completed candles for confirmed signals unless the user explicitly asks for live intrabar monitoring.

### 7. Catalysts and event risk

Identify verified upcoming or recent:
- earnings
- guidance
- investor days
- product launches
- regulatory decisions
- litigation
- financing
- buybacks
- dividends
- index inclusion or removal
- macro releases
- sector events

For each catalyst state:
- date
- expected relevance
- bull interpretation
- bear interpretation
- what would invalidate the thesis

Do not infer an event date from memory when current verification is possible — use
`/api/market/earnings/:ticker` and `/api/finnhub/news/:ticker`.

### 8. Risk analysis

Cover:
- company-specific risk
- sector risk
- valuation risk
- liquidity risk
- gap risk
- earnings risk
- leverage risk
- concentration risk
- regulatory risk
- execution risk
- dilution risk
- macro sensitivity
- thesis-invalidating developments

For an existing position calculate, when inputs are available:
- current unrealized P&L
- return needed to break even
- portfolio concentration
- downside to technical invalidation
- position risk in currency and percentage
- recovery scenarios

Never recommend averaging down merely because price fell.

### 9. Scenario model

Build at least three scenarios:

#### Bear case
- triggers
- expected business/market outcome
- relevant price zone or valuation range
- invalidation conditions

#### Base case
- triggers
- expected business/market outcome
- relevant price zone or valuation range
- invalidation conditions

#### Bull case
- triggers
- expected business/market outcome
- relevant price zone or valuation range
- invalidation conditions

Use conditional language. Price targets are scenarios, not promises.

### 10. Trade-plan framework

Only produce a trade plan when data quality is sufficient.

Separate:
- watch zone
- entry trigger
- entry zone
- invalidation level
- stop concept
- target 1
- target 2
- time stop
- risk/reward
- conditions that cancel the setup

Do not say "buy now" solely from a score or indicator.

A confirmed entry requires:
- completed candle
- acceptable data quality
- structural trigger
- volume or momentum confirmation
- valid stop
- acceptable risk/reward
- no blocking event risk

Default minimum risk/reward:
- 1.5 for swing trades
- 2.0 preferred when event or leverage risk is high

For leveraged ETFs, use stricter risk controls and shorter review intervals.

Note: the app's own simple-signal path (`hooks/useSimpleSignal.js`) gates on R:R ≥ 2.5. When a
plan produced here is looser than that, say so explicitly so the report and the UI do not
appear to contradict each other.

### 11. Confidence

Do not report a numerical probability unless based on a defined, tested, calibrated model.

Instead use:
- Low confidence
- Moderate confidence
- High confidence

Explain why, including data limitations and conflicting signals.

### 12. Final conclusion

End with a direct conclusion containing:
1. overall stance: bullish, cautiously bullish, neutral, cautiously bearish, or bearish
2. strongest supporting evidence
3. strongest opposing evidence
4. key level or condition to watch
5. what would change the conclusion
6. suitability by horizon
7. explicit data-quality label

Use the output structure in `references/output-template.md`.

## Output

Save the report to `reports/[TICKER]_stock_analysis_[YYYY-MM-DD].md`, matching the sibling
skills' convention. Print the executive conclusion in the chat as well.

## Related skills in this project

Hand off rather than duplicating:
- `position-sizer` — share count / position size once a stop level exists here
- `technical-analyst` — weekly chart-image analysis and contrarian confirmation
- `market-breadth-analyzer`, `uptrend-analyzer` — market-regime input for section 3
- `exposure-coach` — portfolio-level net exposure
- `backtest-expert`, `signal-postmortem` — after-the-fact review of a call made here

## Mandatory behavior

- Cite current factual claims.
- Include exact dates for time-sensitive events.
- Distinguish facts, assumptions, and interpretations.
- State when data is unavailable.
- Do not fabricate a price target.
- Do not hide material risks.
- Do not call a score a probability.
- Do not guarantee profit.
- Do not treat analyst consensus as fact.
- Do not rely on a single indicator.
- Do not recommend an oversized position.
- Do not provide live execution instructions from delayed data.
- Do not change a conclusion merely to agree with the user.
- When evidence conflicts, show the conflict.
- Prefer "no valid setup" over forcing a trade.

## Compact mode

If the user asks for a short answer, still include:
- stance
- technical structure
- fundamental/catalyst summary
- primary risk
- key level
- data quality

## Language

The StockSense interface is Hebrew. If the user writes in Hebrew, produce the report in Hebrew
(RTL prose, LTR tickers/numbers/levels), keeping the section order of the output template.
