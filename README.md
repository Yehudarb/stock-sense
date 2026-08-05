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

## S&P 500 Cup & Handle Scanner

The scanner runs as a shared background server job instead of issuing one
browser request per symbol. It first validates the current S&P 500 constituent
list and never widens the universe to ETFs or non-members. It then applies these
deterministic stages:

1. Load roughly 503 S&P 500 securities, normalize share-class symbols, and
   enrich available market-cap metadata from Nasdaq.
2. Batched two-year close history scores trend, 3/6/12-month momentum,
   proximity to the 52-week high, liquidity, and six-month strength versus SPY.
3. Every strong asset receives a close-series Cup pre-scan.
4. Every strong asset then receives full daily OHLCV validation on closed bars,
   so a breakout cannot be dropped because of a result cap.
5. Results are ranked by pattern quality, stage, volume confirmation, distance
   to the pivot, upside, and market-strength score.

Start and poll the scan through:

```http
POST /api/scanner/cup-handle
GET /api/scanner/cup-handle/:jobId
GET /api/scanner/cup-handle/latest
```

The result cache is shared across users to avoid repeating the same index scan
for every browser session. If membership cannot be validated, the scan fails
closed instead of returning a broad market universe. Yahoo and Nasdaq data may
be delayed; scanner scores are rule scores, not probabilities or trading
recommendations.

## Tests

```bash
py -m pytest .claude/skills/stock-analysis-pro/scripts/tests
```

The tests use deterministic in-memory bars and do not require API keys.
