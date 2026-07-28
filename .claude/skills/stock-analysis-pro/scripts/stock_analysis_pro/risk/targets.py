from __future__ import annotations


def build_targets(entry: float, stop: float, target_min_percent: float, target_max_percent: float) -> list[dict[str, object]]:
    risk = entry - stop
    pct1 = max(target_min_percent, (risk / entry) * 100 * 2)
    pct2 = max((target_min_percent + target_max_percent) / 2, pct1 + 2)
    pct3 = max(target_max_percent, pct2 + 2)
    return [
        {"price": round(entry * (1 + pct1 / 100), 2), "action": "sell_30_percent"},
        {"price": round(entry * (1 + pct2 / 100), 2), "action": "sell_40_percent"},
        {"price": round(entry * (1 + pct3 / 100), 2), "action": "trail_remaining_position"},
    ]


def stop_management(entry: float, stop: float, targets: list[dict[str, object]]) -> dict[str, object]:
    return {
        "move_to_break_even": f"After TP1 is reached or after a confirmed higher low above {entry:.2f}",
        "activate_trailing_stop": "After TP2; trail below prior daily higher low or 1.5 ATR",
        "time_stop": "Exit or reassess if there is no progress after 10 trading days for swing trades",
        "initial_risk_per_share": round(entry - stop, 2),
    }
