from __future__ import annotations


def structure_atr_stop(*, entry: float, support: float | None, atr: float | None, price: float) -> dict[str, object]:
    candidates = []
    if support:
        candidates.append(support * 0.995)
    if atr:
        candidates.append(entry - 1.2 * atr)
    if not candidates:
        return {"price": None, "type": "unavailable", "distance_percent": None, "reason": "No structural or ATR invalidation level", "hard_stop": True}
    stop = min(candidates)
    return {
        "price": round(stop, 2),
        "type": "structure_and_atr" if support and atr else "structure" if support else "atr",
        "distance_percent": round((entry - stop) / entry * 100, 2),
        "reason": "Below support and/or 1.2 ATR below entry; invalidates the setup structure",
        "hard_stop": True,
    }
