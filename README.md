# Stock Sense / Stock Analysis Pro

This repository now includes a Python `stock_analysis_pro` decision-support engine alongside the existing JS app.

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

## Providers

Primary: Polygon/Massive (`POLYGON_API_KEY`).

Fallback and comparison: Yahoo Finance. Alpha Vantage and SEC EDGAR interfaces are scaffolded for deployments that provide API keys and symbol-to-CIK mapping.

Copy `.env.example` values into your environment before using paid data providers. API keys are never stored in code.

## Tests

```bash
python -m pytest tests
```

The tests use deterministic in-memory bars and do not require API keys.
