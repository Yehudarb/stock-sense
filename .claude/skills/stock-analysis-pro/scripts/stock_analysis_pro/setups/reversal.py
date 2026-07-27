from __future__ import annotations

from .base import Setup


def detect_reversal(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    rsi = technical.get("rsi14")
    trend = technical.get("trend", {}).get("trend")
    valid = trend == "bearish" and rsi is not None and float(rsi) > 45
    return Setup("REVERSAL", valid, "reversal", None, "Wait for confirmed higher low and reclaim of EMA20", confirmation_timeframe, None, [], 45 if valid else 0, 65)
