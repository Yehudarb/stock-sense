# TSLL Assistant Integration

Last updated: 2026-07-23

## Purpose

This document explains how `stock-sense` can be used by the separate Python project
`tsll-trading-assistant` as a research-only market data source.

The goal is safe integration:

- `stock-sense` supplies market data only.
- `tsll-trading-assistant` remains the deterministic analysis engine.
- `stock-sense` does not become the source of truth for execution.
- no live trading authority is delegated to `stock-sense`.

## Safe Boundary

`stock-sense` may be used for:

- delayed or near-real-time research snapshots
- historical bar retrieval
- watchlist or chart-oriented inspection

`stock-sense` must not be treated as:

- a broker
- a live stop-loss execution source
- a fill-confirmation source
- a live trading authority

## Endpoints Used By TSLL Assistant

The Python assistant expects these routes from the running `stock-sense` server:

```text
GET /health
GET /api/market/bars/:ticker?interval=1d&limit=260
GET /api/market/bars/:ticker?interval=1h&limit=200
GET /api/market/bars/:ticker?interval=15m&limit=200
GET /api/market/snapshot/:ticker
```

The current server-side route definitions live in:

- `server/index.js`
- `server/routes/market.js`
- `server/services/yahooFinance.js`

## Expected Bar Payload

The Python assistant expects each bar to follow this shape:

```json
{
  "t": 1778269200000,
  "o": 425.27,
  "h": 425.50,
  "l": 424.80,
  "c": 425.01,
  "v": 423737
}
```

Where:

- `t` = Unix timestamp in milliseconds
- `o` = open
- `h` = high
- `l` = low
- `c` = close
- `v` = volume

The assistant normalizes these values into its own `MarketBar` model in UTC.

## Runtime Notes

Default server port:

```text
3001
```

If port `3001` is already occupied on the local machine, do not force-kill an unknown process.
Start `stock-sense` on an alternate port instead.

PowerShell example:

```powershell
$env:PORT=3101
npm run start:server
```

Then configure the Python project with:

```dotenv
STOCK_SENSE_BASE_URL=http://127.0.0.1:3101
```

## Operational Rules

- signals in the Python assistant must be based on closed bars only
- if `stock-sense` returns invalid or unavailable data, the Python assistant must block the signal
- Yahoo-based data from `stock-sense` is acceptable for research, demo, and charting
- Yahoo-based data from `stock-sense` must not be used for live stop handling or execution decisions

## Recommended Validation Before Use

Run these checks before connecting the projects:

```powershell
cd C:\Users\yehud\Projects\stock-sense
npm run test:server
```

Then verify the API manually:

```powershell
Invoke-WebRequest http://127.0.0.1:3001/health
Invoke-WebRequest "http://127.0.0.1:3001/api/market/bars/TSLA?interval=1d&limit=30"
```

## Integration Summary

`stock-sense` is useful here as a local market-data service.

`tsll-trading-assistant` remains responsible for:

- validation
- indicator calculation
- signal scoring
- target logic
- stop logic
- risk management
- backtesting
- deterministic explanations

That separation should remain in place.
