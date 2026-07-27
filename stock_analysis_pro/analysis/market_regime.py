from __future__ import annotations

from stock_analysis_pro.analysis.technical import technical_snapshot
from stock_analysis_pro.models import Bar


def detect_market_regime(market_bars: dict[str, list[Bar]]) -> dict[str, object]:
    trends = {}
    for symbol in ["SPY", "QQQ", "IWM"]:
        snap = technical_snapshot(market_bars.get(symbol, []))
        trends[symbol.lower() + "_trend"] = snap.get("trend", {}).get("trend", "unknown") if snap.get("available") else "unknown"
    bearish = sum(1 for value in trends.values() if value == "bearish")
    bullish = sum(1 for value in trends.values() if value == "bullish")
    state = "risk_off" if bearish >= 2 else "risk_on" if bullish >= 2 else "mixed"
    return {
        "state": state,
        **trends,
        "sector_trend": "unknown",
        "vix_state": "unavailable",
        "breadth": "unavailable",
        "rates": "unavailable",
    }
