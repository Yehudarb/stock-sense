# Stock Sense - Project Handoff

Last updated: 2026-05-11

## How To Resume

Project path:

```powershell
cd C:\Users\yehud\Projects\stock-sense
```

Branch:

```text
main
```

GitHub remote:

```text
https://github.com/Yehudarb/stock-sense.git
```

Render dashboard URL:

```text
https://stock-sense-demo.onrender.com
```

Important local note:

```text
Do not commit render-deploy-headers.txt, render-deploy-response.json, or render-deploy.json unless explicitly requested.
```

## Recent Commits

```text
192ebae fix: expose triangle pattern toggle
a42fd78 feat: prefer TradingView-style stock logos
a861071 feat: add stock logos and language flags
028348e feat: add advanced trend analysis panel
071695d fix: improve English dashboard translations
f031fc3 feat: add dashboard language toggle
```

## What Was Added In This Session

- Added Hebrew/English dashboard language toggle with persisted language state.
- Improved English mode so dynamic analysis text is generated in English instead of leaking Hebrew.
- Added language flags in the header: Israel flag for Hebrew and USA flag for English.
- Added ticker icons across the dashboard:
  - Header current ticker.
  - Watchlist ticker tokens.
  - Ticker search results.
- Stock icons now prefer TradingView-style SVG logos from `s3-symbol-logo.tradingview.com`, then fall back to Clearbit logos, then ticker initials.
- Added advanced trend analysis from the imported ZIP logic:
  - Pivot-based triangle detection.
  - Ascending triangle.
  - Descending triangle.
  - Symmetrical triangle.
  - Megaphone / expanding triangle.
  - RSI divergence.
  - Volume profile.
  - Institutional volume activity.
  - Market regime.
- Added `AdvancedTrendsPanel` in the right dashboard column.
- Added a dedicated chart toggle:
  - Hebrew: `משולשים`
  - English: `Triangles`
- Triangle overlays can now be toggled separately from general `Patterns`.

## Key Files

```text
client/src/App.jsx
client/src/components/layout/Header.jsx
client/src/components/watchlist/WatchlistPanel.jsx
client/src/components/watchlist/TickerSearch.jsx
client/src/components/ui/StockLogo.jsx
client/src/components/analysis/AdvancedTrendsPanel.jsx
client/src/components/charts/PriceChart.jsx
client/src/hooks/useSignal.js
client/src/lib/advancedTrends.js
client/src/lib/patterns.js
client/src/lib/forecastOpinion.js
client/src/lib/hebrewAnalysis.js
```

## Verification Commands

```powershell
npm run build:client
git status --short
```

Known build warning:

```text
Vite warns that some chunks are larger than 500 kB. This is currently non-blocking.
```

## User Preferences

- User works mostly in Hebrew.
- Prefer proactive changes and push to Git when requested.
- Deploy to Render should only be done when the user explicitly asks.
- If the user says "skip deploy", only push to Git.
- Keep Render temporary files out of commits.

## Next Useful Checks

- Confirm that the deployed Render site has the latest bundle after auto-deploy, only if the user asks.
- If triangles still do not appear for a given ticker, test with several symbols/timeframes because triangle detection is conditional on pivot structure.
- Consider adding a small "No triangle found on this timeframe" message near the chart toggle if the user still expects visible overlays on every ticker.
