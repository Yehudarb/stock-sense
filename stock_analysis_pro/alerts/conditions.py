from __future__ import annotations


def condition_met(condition: str, snapshot: dict[str, float | bool]) -> bool:
    if condition.startswith("price_above_"):
        return float(snapshot.get("price", 0)) >= float(condition.removeprefix("price_above_"))
    if condition.startswith("price_below_"):
        return float(snapshot.get("price", 0)) <= float(condition.removeprefix("price_below_"))
    if condition == "relative_volume_above_1.4":
        return float(snapshot.get("relative_volume", 0)) >= 1.4
    if condition.endswith("_candle_closed"):
        return bool(snapshot.get("candle_closed", False))
    return False
