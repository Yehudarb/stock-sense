from __future__ import annotations

from stock_analysis_pro.analysis.technical import technical_snapshot
from stock_analysis_pro.models import Bar


TIMEFRAMES = {
    "day_trade": ["1d", "1h", "15m", "5m"],
    "swing": ["1wk", "1d", "4h", "1h"],
    "position_trade": ["1mo", "1wk", "1d"],
    "long_term": ["1mo", "1wk", "1d"],
}


def analyze_timeframes(bars_by_timeframe: dict[str, list[Bar]], trading_style: str) -> dict[str, object]:
    required = TIMEFRAMES.get(trading_style, TIMEFRAMES["swing"])
    frames = {}
    bullish = bearish = 0
    for timeframe in required:
        snapshot = technical_snapshot(bars_by_timeframe.get(timeframe, []))
        frames[timeframe] = snapshot
        trend = snapshot.get("trend", {}).get("trend") if snapshot.get("available") else "unknown"
        bullish += trend == "bullish"
        bearish += trend == "bearish"
    return {
        "required_timeframes": required,
        "frames": frames,
        "alignment": "bullish" if bullish > bearish else "bearish" if bearish > bullish else "mixed",
        "bullish_count": bullish,
        "bearish_count": bearish,
    }
