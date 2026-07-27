from __future__ import annotations

from stock_analysis_pro.risk.stop_loss import structure_atr_stop
from stock_analysis_pro.risk.targets import build_targets

from .base import Setup


def detect_breakout(technical: dict[str, object], confirmation_timeframe: str, target_min: float, target_max: float) -> Setup:
    price = float(technical["price"])
    resistance = technical.get("resistance")
    support = technical.get("support")
    atr = technical.get("atr14")
    rvol = technical.get("relative_volume")
    if not resistance or not support or not atr:
        return Setup("BREAKOUT", False, "breakout", None, "No clear resistance/support/ATR", confirmation_timeframe, None, [], 0, 90, reason_codes=["NO_CLEAR_INVALIDATION"])
    entry_low = round(float(resistance) * 1.001, 2)
    entry_high = round(float(resistance) * 1.008, 2)
    stop = structure_atr_stop(entry=entry_low, support=float(support), atr=float(atr), price=price)
    stop_price = stop["price"]
    if stop_price is None:
        return Setup("BREAKOUT", False, "breakout", None, "No structural stop", confirmation_timeframe, None, [], 0, 90, reason_codes=["NO_CLEAR_INVALIDATION"])
    targets = [t["price"] for t in build_targets(entry_low, float(stop_price), target_min, target_max)]
    confirmed = price > float(resistance) and (rvol or 0) >= 1.4
    return Setup(
        "BREAKOUT",
        confirmed,
        "breakout",
        (entry_low, entry_high),
        f"{confirmation_timeframe} close above {entry_low:.2f} with relative volume above 1.4",
        confirmation_timeframe,
        float(stop_price),
        targets,
        72 if confirmed else 58,
        45 if confirmed else 60,
        ["close_above_resistance", "relative_volume_above_1.4"],
        ["market_regime_not_risk_off", "sector_confirmation"],
        [f"Daily close below {float(stop_price):.2f}"],
        [] if confirmed else ["PRICE_BELOW_RESISTANCE" if price <= float(resistance) else "VOLUME_CONFIRMATION_MISSING"],
    )
