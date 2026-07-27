from __future__ import annotations

from stock_analysis_pro.risk.stop_loss import structure_atr_stop
from stock_analysis_pro.risk.targets import build_targets

from .base import Setup


def detect_pullback(technical: dict[str, object], confirmation_timeframe: str, target_min: float, target_max: float) -> Setup:
    price = float(technical["price"])
    support = technical.get("support")
    resistance = technical.get("resistance")
    atr = technical.get("atr14")
    trend = technical.get("trend", {}).get("trend")
    if not support or not atr or trend != "bullish":
        return Setup("PULLBACK_IN_UPTREND", False, "pullback", None, "No bullish trend pullback into support", confirmation_timeframe, None, [], 0, 70, reason_codes=["NO_PULLBACK_SETUP"])
    entry_low = round(float(support) * 1.002, 2)
    entry_high = round(float(support) * 1.015, 2)
    stop = structure_atr_stop(entry=entry_high, support=float(support), atr=float(atr), price=price)
    stop_price = stop["price"]
    targets = [t["price"] for t in build_targets(entry_high, float(stop_price), target_min, target_max)] if stop_price else []
    near_support = abs(price - float(support)) / price < 0.025
    return Setup(
        "PULLBACK_IN_UPTREND",
        near_support,
        "pullback",
        (entry_low, entry_high),
        f"Bullish reversal or higher low from {entry_low:.2f}-{entry_high:.2f}",
        confirmation_timeframe,
        float(stop_price) if stop_price else None,
        targets,
        70 if near_support else 55,
        50,
        ["bullish_trend", "pullback_to_support", "reversal_candle"],
        ["hold_above_ema20", "relative_volume_improves"],
        [f"Daily close below {float(stop_price):.2f}" if stop_price else "Support breaks"],
        [] if near_support else ["PRICE_NOT_IN_PULLBACK_ZONE"],
    )
