# stock-analysis-pro

Professional trading decision-support skill. The engine returns one primary action, a computed entry plan, stop, targets, risk sizing, invalidation conditions, data-quality status, reason codes, alerts, and a short human explanation.

Run:

```bash
python cli.py analyze TSLA --style swing --account-size 25000 --risk-percent 1 --target-min 5 --target-max 12
```

Primary provider is Polygon/Massive via `POLYGON_API_KEY`. Yahoo Finance is used only as a fallback and comparison source. API keys must be provided through environment variables; never hard-code keys.

The engine is rule-based and score-based. It must not invent entry prices, stops, targets, earnings facts, financials, or news. If data is stale, missing, contradictory, or lacks a clear invalidation level, the result must avoid a new entry or return `INSUFFICIENT_DATA`.

Allowed primary actions:

`BUY_NOW`, `WAIT_FOR_BREAKOUT`, `WAIT_FOR_PULLBACK`, `HOLD`, `ADD_ONLY_IF_CONFIRMED`, `TAKE_PARTIAL_PROFIT`, `MOVE_STOP`, `EXIT_POSITION`, `AVOID`, `INSUFFICIENT_DATA`.

Safety rules:

- Decision support only; no guaranteed returns.
- Show confidence, risk level, stop and invalidation.
- Do not execute trades or connect broker execution without explicit approval flow.
- Leveraged ETFs require reduced risk and explicit warnings.
