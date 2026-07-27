from __future__ import annotations

from .base import Setup


def detect_failed_breakout(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    price = float(technical["price"])
    resistance = technical.get("resistance")
    rvol = technical.get("relative_volume") or 0
    if resistance and price < float(resistance) and rvol > 1.5:
        return Setup("FAILED_BREAKOUT", True, "avoid_or_exit", None, f"Price rejected below {float(resistance):.2f} on high volume", confirmation_timeframe, None, [], 62, 80, reason_codes=["FAILED_BREAKOUT"])
    return Setup("FAILED_BREAKOUT", False, "avoid_or_exit", None, "No failed breakout", confirmation_timeframe, None, [], 0, 20)
