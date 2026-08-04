# Stock Sense / Stock Analysis Pro

This repository includes a Python `stock_analysis_pro` decision-support engine inside `.claude/skills/stock-analysis-pro/scripts`, alongside the existing JS app. The root `cli.py` is a thin wrapper so the required command remains stable.

Example:

```bash
python cli.py analyze TSLA --style swing --account-size 25000 --risk-percent 1 --target-min 5 --target-max 12
```

The output includes a short Hebrew decision summary and a full JSON object with:

- one required `current_action`
- current price
- entry scenarios and triggers
- stop loss and stop-management rules
- TP1/TP2/TP3 targets
- position sizing
- risk/reward
- trade score, confidence and risk level
- data quality and provider used
- reason codes
- condition-based alert definitions

## Server Integration

The engine is exposed through an isolated server endpoint:

```http
POST /api/stock-analysis-pro/analyze
Content-Type: application/json
```

Body example:

```json
{
  "symbol": "TSLA",
  "style": "swing",
  "account_size": 25000,
  "risk_percent": 1,
  "target_min": 5,
  "target_max": 12
}
```

The route spawns the Python CLI with sanitized arguments, a timeout, and no shell interpolation. Failures return an API error without affecting existing market, watchlist, paper-trading, or trading-bot routes.

## Providers

Primary: Polygon/Massive (`POLYGON_API_KEY`).

Fallback and comparison: Yahoo Finance. Alpha Vantage and SEC EDGAR interfaces are scaffolded for deployments that provide API keys and symbol-to-CIK mapping.

Copy `.env.example` values into your environment before using paid data providers. API keys are never stored in code.

## Market-wide Cup & Handle Scanner

The scanner runs as a shared background server job instead of issuing one
browser request per symbol. It discovers the Nasdaq stock universe and Yahoo's
strong US ETF universe, then applies these deterministic stages:

1. Stocks require at least `$2B` market capitalization; ETFs require at least
   `$2B` net assets (AUM).
2. Batched two-year close history scores trend, 3/6/12-month momentum,
   proximity to the 52-week high, liquidity, and six-month strength versus SPY.
3. Every strong asset receives a close-series Cup pre-scan.
4. Structural candidates receive full daily OHLCV validation on closed bars.
5. Results are ranked by pattern quality, stage, volume confirmation, distance
   to the pivot, upside, and market-strength score.

Start and poll the scan through:

```http
POST /api/scanner/cup-handle
GET /api/scanner/cup-handle/:jobId
GET /api/scanner/cup-handle/latest
```

The result cache is shared across users to avoid repeating a market-wide scan
for every browser session. Yahoo and Nasdaq data may be delayed; scanner scores
are rule scores, not probabilities or trading recommendations.

## Tests

```bash
py -m pytest .claude/skills/stock-analysis-pro/scripts/tests
```

The tests use deterministic in-memory bars and do not require API keys.
