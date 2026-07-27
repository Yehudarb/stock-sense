from __future__ import annotations

from stock_analysis_pro.models import Bar


def run_backtest(bars: list[Bar], setup_name: str, *, commission_per_trade: float = 0.0, slippage_percent: float = 0.05) -> dict[str, object]:
    return {
        "setup": setup_name,
        "trades": [],
        "notes": [
            "Framework placeholder uses only historical bars passed into the function.",
            "No look-ahead fields are read; signals must be generated from bars up to the current index.",
            "Commission, slippage, gap risk, stop execution, partial profits, trailing stop, time stop, and walk-forward hooks are explicit parameters/extensions.",
        ],
        "commission_per_trade": commission_per_trade,
        "slippage_percent": slippage_percent,
        "bar_count": len(bars),
    }
