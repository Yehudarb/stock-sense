# StockSense Implementation Notes for Claude Code

Updated: 2026-05-15

## Start Here

1. Read `IMPLEMENTATION_ROADMAP.md` first.
2. Use `TECHNICAL_IMPROVEMENTS.md`, `THEME_AND_TRANSLATION.md`, and `IMPROVEMENTS.md` as supporting detail.
3. Limit code edits to `client/src/` unless the user explicitly asks otherwise.

## Current Project Conventions

- Theme state currently lives in `client/src/store/useStore.js`.
- Do not create a second active theme source unless the user explicitly requests a store split.
- `Layout.jsx` is responsible for applying `data-theme` and the `theme-light` root class.
- Chart components should use shared helpers from `client/src/components/charts/chartHelpers.js` for theme-aware axis, tooltip, and crosshair styling.
- Keep trader-facing colors consistent with `client/src/lib/traderColors.js`.

## Current UX Direction

- `TradeActionCard` stays above KPI cards.
- Chart controls should appear above the main chart, not below it.
- Summary cards should stay collapsed by default.
- Mobile must clearly show timeframe and last update status.
- Hebrew mode should avoid mixed English/Hebrew UI labels unless the term is a standard trading term.

## Checklist to Verify

- TradeActionCard is visible before KPI cards.
- Price chart shows entry, stop loss, take profit, support, and resistance overlays when available.
- RSI, Stochastic, and Williams %R show threshold guides.
- Theme toggle changes both layout styling and chart styling.
- Chart control bar is above the chart.
- Hebrew labels are readable in Header, App, SignalPanel, ChartWorkspace, TradeActionCard, and FactorRow.
- Build passes with `npm run build` from `client/`.

## Practical Reminder

- If the roadmap and the code disagree, prefer the roadmap order but preserve working functionality already in place.
- If a requested architecture conflicts with the current implementation, favor the working in-repo pattern and document the deviation briefly.
