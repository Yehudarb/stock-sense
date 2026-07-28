# Stock Sense - Core Project Map

Last updated: 2026-07-06

## What This Project Is

`stock-sense` is a stock-analysis dashboard with:

- charting and technical analysis
- signal generation
- market context panels
- advanced trend detection
- paper trading
- an automatic paper-trading bot

The project is split into:

- `client/` = React dashboard
- `server/` = Express API and trading logic
- `shared/` = shared constants

## Simple Mode (TSLL)

For day-to-day TSLL trading, the app opens in a stripped-down 3-screen flow instead of the
full multi-ticker dashboard described below. Toggle between the two with the mode button in
the header (top-left pill, "Simple mode (TSLL)" / "Advanced mode"). Simple mode auto-activates
whenever the last-loaded ticker is `TSLL`.

- `client/src/App.jsx` — thin router: renders `SimpleApp` or `AdvancedApp` based on
  `useStore().simpleMode`.
- `client/src/AdvancedApp.jsx` — the full dashboard (unchanged logic, just renamed from the old
  `App.jsx`).
- `client/src/simple/SimpleApp.jsx` — owns which of the 3 screens is shown; wires the existing
  `useSignal`/`usePaperTrading` hooks (no new signal or risk logic — only re-labels their output).
  - **Screen 1 — `screens/DashboardScreen.jsx`**: "Should I trade today?" — price, BUY/SELL/
    HOLD/WAIT signal, confidence, account value, total P&L, goal progress bar, tax-shield meter.
  - **Screen 2 — `screens/TradeSetupScreen.jsx`**: "How exactly do I enter?" — entry, stop,
    target, $ at risk / to gain, R:R, position size, trailing-stop rules, ENTER TRADE button
    (calls `usePaperTrading().createOrder`).
  - **Screen 3 — `screens/PositionTrackerScreen.jsx`**: "What do I do with my open trade?" —
    entry vs. current price, live P&L, action recommendation (HOLD / MOVE STOP TO BREAK-EVEN /
    SELL HALF / SELL ALL / STOP LOSS HIT), price ladder, CLOSE TRADE button, trade history.
  - `hooks/useSimpleSignal.js` reduces `signal.decision` (from `lib/analystDecision.js`) into
    BUY/SELL/HOLD/WAIT + Strong/Medium/Weak confidence, gated on R:R ≥ 2.5.
  - `hooks/useGoalTracking.js` reads/writes the paper account's `goal`/`taxShield` fields.
- `server/services/paperTradingStore.js` — extended (not replaced) with `goal: {start, target}`
  and `taxShield: {total, used}` on the account record; `taxShield.used` auto-increments when a
  position closes at a realized loss. `PATCH /api/paper-trading/goal` updates both.

Every developer-facing feature (backtests, indicator internals, grid search, reason codes, raw
JSON) stays exactly where it was, reachable only through Advanced mode.

## Claude Code Skills (`.claude/skills/`)

Analyst-grade research tools from
[tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills),
invoked ad hoc during a Claude Code session — they do not run inside the app itself
(Python CLI scripts producing JSON/Markdown reports under `reports/`):

- `technical-analyst` — weekly chart trend/S-R/scenario analysis from chart images
- `position-sizer` — fixed-fractional / ATR / Kelly share-count sizing (tested against a
  TSLL-scale example: 100k account, 1% risk, $7.50 entry / $6.90 stop → 1,666 shares)
- `market-breadth-analyzer`, `uptrend-analyzer` — 0-100 market-breadth health scores from
  public CSV data, no API key required
- `exposure-coach` — synthesizes breadth/regime/flow skills into a net-exposure recommendation
  (needs several upstream skills' JSON outputs plus an FMP API key — not fully wired without them)
- `trader-memory-core` — tracks a trade idea's lifecycle (IDEA → ENTRY_READY → ACTIVE → CLOSED)
  with postmortems; needs `pyyaml`/`jsonschema` (present) and optionally an FMP key for MAE/MFE
- `signal-postmortem`, `backtest-expert` — after-the-fact signal/backtest quality review

Installed separately (prompt-only, no Python — reads this project's own `/api/market/*`,
`/api/finnhub/*`, `/api/trading/*` endpoints on port 3001 for its data):

- `stock-analysis-pro` — full single-security research report: instrument validation, data-quality
  gate (VERIFIED/ACCEPTABLE/DEGRADED/UNAVAILABLE), market context, fundamentals or ETF structure,
  valuation, multi-timeframe technicals, catalysts, risks, bear/base/bull scenarios, and a
  trade-plan framework. Hands off sizing to `position-sizer`. Requires the dev server running;
  the Finnhub-backed fundamentals/news sections need `FINNHUB_API_KEY`.
  **This skill also runs inside the app** — see "Stock Analysis Pro (in-app)" below.

## Stock Analysis Pro (in-app) — the `Pro` tab

The same analysis method, implemented as app code so it runs on every ticker without a Claude
session:

- `client/src/lib/stockAnalysisPro.js` — pure, dependency-free engine. `buildStockAnalysisPro()`
  returns the structured report; `toMarkdown()` renders it in the skill's output-template order,
  so the in-app report and the skill-generated report are interchangeable.
- `client/src/hooks/useStockAnalysisPro.js` — feeds the engine from the existing hooks and fetches
  only the Finnhub profile/news (their absence is recorded as a data-quality fact, not an error).
- `client/src/components/analysis/StockAnalysisProPanel.jsx` — the `Pro` tab in `AdvancedApp.jsx`,
  with a "copy report" button that yields the Markdown.

Three rules of the method are enforced structurally, not by convention:
1. **Nothing is invented.** Every number traces to OHLCV/indicators or an API payload; anything
   missing is emitted as `UNAVAILABLE` with a reason (fundamentals and valuation are permanently
   unavailable — the project has no financial-statements source).
2. **A score is not a probability.** `signal.buyProbability` is deliberately not surfaced;
   confidence is Low/Moderate/High with stated reasons.
3. **"No valid setup" beats a forced trade.** The trade plan is gated on data quality, R:R
   (1.5 swing / 2.0 when leverage or event risk is present), structure, volume confirmation, and
   an earnings blackout of 7 days — and returns `noValidSetup` with reasons when any fails.

Data quality is capped at `ACCEPTABLE` by design: the Yahoo-backed feed is delayed and carries no
real-time attestation, so `VERIFIED` is never claimed automatically.

Requires `py` (Python 3.11+ launcher) with `requests`, `pyyaml`, `jsonschema` — already
available in this environment. `exposure-coach` and `trader-memory-core` reference sibling
skills (`macro-regime-detector`, `ftd-detector`, `theme-detector`, etc.) from the upstream repo
that were **not** installed here; those two will run in a reduced/manual capacity until such
inputs are supplied by hand.

## Read This First

If you want to understand the project fast, read these files in this order:

1. `package.json`
2. `PROJECT_HANDOFF.md`
3. `client/src/App.jsx`
4. `server/index.js`
5. `client/src/components/charts/ChartWorkspace.jsx`
6. `client/src/components/analysis/PaperTradingPanel.jsx`
7. `server/services/paperTradingStore.js`
8. `server/services/tradingBotStore.js`

## Core Files By Area

### 1. App Entry And Global Flow

- `package.json`
  What it tells you:
  - this is a monorepo with `client` and `server` workspaces
  - main scripts: `dev`, `build:client`, `test:server`

- `client/src/App.jsx`
  What it does:
  - main dashboard entry
  - wires together market data, signals, chart, analysis panels, paper trading, and trading bot
  - controls the main tabs: chart, summary, details, paper

- `server/index.js`
  What it does:
  - boots the Express server
  - mounts the API routes
  - is the backend entry point

### 2. Global Client State And Hooks

- `client/src/store/useStore.js`
  What it does:
  - holds current ticker, interval, OHLCV data, snapshot, language, and loading state

- `client/src/hooks/useTicker.js`
  What it does:
  - loads ticker data into the app store

- `client/src/hooks/useIndicators.js`
  What it does:
  - computes indicator data from candles

- `client/src/hooks/useSignal.js`
  What it does:
  - builds the core trading/analysis signal from candles and indicators

- `client/src/hooks/useTechnicalAnalysis.js`
  What it does:
  - fetches server-side technical analysis data

- `client/src/hooks/usePaperTrading.js`
  What it does:
  - client API wrapper for paper trading

- `client/src/hooks/useTradingBot.js`
  What it does:
  - client API wrapper for bot settings, audit events, and auto execution

### 3. Chart And Visual Trading Workspace

- `client/src/components/charts/ChartWorkspace.jsx`
  What it does:
  - the main chart workspace
  - passes market data, signal data, and paper-trading overlays into the chart

- `client/src/components/charts/PriceChart.jsx`
  What it does:
  - renders the main price chart
  - shows overlays such as markers, levels, pattern lines, and paper-trading visual elements

- `client/src/components/charts/chartHelpers.js`
  What it does:
  - chart helper logic used by the chart components

### 4. Analysis Panels

- `client/src/components/analysis/SignalPanel.jsx`
  What it does:
  - shows the signal interpretation for the current stock

- `client/src/components/analysis/TechnicalAnalysisPanel.jsx`
  What it does:
  - presents technical-analysis data in a panel

- `client/src/components/analysis/AdvancedTrendsPanel.jsx`
  What it does:
  - shows advanced trend logic such as triangle detection and related pattern analysis

- `client/src/components/analysis/MarketContextPanel.jsx`
  What it does:
  - shows broader market context

- `client/src/components/analysis/AnalysisResultCard.jsx`
  What it does:
  - summarizes the overall result of the analysis

### 5. Trading / Demo Trading

- `client/src/components/analysis/PaperTradingPanel.jsx`
  What it does:
  - full paper-trading workspace in the UI
  - manual orders
  - risk settings
  - positions, pending orders, journal
  - bot control section

- `server/routes/paperTrading.js`
  What it does:
  - backend API endpoints for paper trading

- `server/services/paperTradingStore.js`
  What it does:
  - main trading engine for demo mode
  - order validation
  - pending orders
  - stop-loss / take-profit logic
  - position and P&L accounting
  - account state persistence

- `server/routes/tradingBot.js`
  What it does:
  - backend API endpoints for bot settings and auto execution

- `server/services/tradingBotStore.js`
  What it does:
  - bot state
  - kill switch
  - cooldown
  - audit trail
  - automatic paper-trade execution

### 6. Analysis Logic

- `client/src/lib/indicators.js`
  What it does:
  - indicator calculations

- `client/src/lib/signals.js`
  What it does:
  - signal-building logic

- `client/src/lib/technicalAnalysis.js`
  What it does:
  - technical-analysis helpers

- `client/src/lib/advancedTrends.js`
  What it does:
  - advanced trend logic

- `client/src/lib/patterns.js`
  What it does:
  - chart-pattern logic, including triangles and related structures

- `client/src/lib/analysisResult.js`
  What it does:
  - converts raw signal/context into a final summary result

- `client/src/lib/forecastOpinion.js`
  What it does:
  - higher-level forecast interpretation

### 7. Market Data

- `server/routes/market.js`
  What it does:
  - backend market-data endpoints

- `server/services/yahooFinance.js`
  What it does:
  - main market-data integration layer

### 8. Tests That Explain The Logic

- `server/tests/paperTradingStore.test.js`
  What it proves:
  - stop-loss rules
  - short-selling rules
  - pending-order behavior
  - auto-close behavior
  - realized/unrealized logic

- `server/tests/tradingBotStore.test.js`
  What it proves:
  - bot defaults
  - auto-entry behavior
  - auto-exit behavior

## If You Only Want The Most Important Files

Take only these:

- `package.json`
- `PROJECT_HANDOFF.md`
- `CORE_PROJECT_MAP.md`
- `client/src/App.jsx`
- `client/src/components/charts/ChartWorkspace.jsx`
- `client/src/components/analysis/PaperTradingPanel.jsx`
- `client/src/hooks/useSignal.js`
- `client/src/hooks/usePaperTrading.js`
- `client/src/hooks/useTradingBot.js`
- `server/index.js`
- `server/routes/paperTrading.js`
- `server/routes/tradingBot.js`
- `server/services/paperTradingStore.js`
- `server/services/tradingBotStore.js`
- `server/services/yahooFinance.js`

## Files You Can Ignore At First

You do not need these to understand the project architecture initially:

- `node_modules/`
- `*.log`
- `render-deploy-headers.txt`
- `render-deploy-response.json`
- `render-deploy.json`
- `CLAUDE.md`
- `CLAUDE_CODE_FINAL.md`
- `FOR_CLAUDE_CODE.md`
- `IMPROVEMENTS.md`
- `IMPLEMENTATION_ROADMAP.md`
- `TECHNICAL_IMPROVEMENTS.md`
- `THEME_AND_TRANSLATION.md`

## Short Logic Summary

The flow of the project is:

1. The user selects a ticker.
2. Market data is loaded into `useStore`.
3. Indicators are computed from OHLCV candles.
4. Signals and analysis summaries are derived from that data.
5. The chart and analysis panels render the result.
6. In `Paper Trading`, the user or bot creates demo orders.
7. The backend validates risk, manages positions, and tracks P&L.
8. The trading bot can auto-open or auto-close demo positions in `paper` mode only.

## Recommended Commands

```powershell
cd C:\Users\yehud\Projects\stock-sense
npm run build:client
npm run test:server
git status --short
```
