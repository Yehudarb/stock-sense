from __future__ import annotations


def calculate_position_size(
    *,
    account_size: float,
    risk_percent: float,
    entry_price: float,
    stop_price: float,
    max_position_percent: float = 25.0,
) -> dict[str, float | int | str | None]:
    max_risk_amount = account_size * (risk_percent / 100)
    risk_per_share = entry_price - stop_price
    if risk_per_share <= 0:
        return {"error": "INVALID_STOP", "shares": 0, "risk_per_share": risk_per_share}
    raw_shares = int(max_risk_amount // risk_per_share)
    max_value = account_size * (max_position_percent / 100)
    max_shares_by_value = int(max_value // entry_price)
    shares = max(0, min(raw_shares, max_shares_by_value))
    return {
        "account_size": round(account_size, 2),
        "risk_percent": round(risk_percent, 2),
        "max_risk_amount": round(max_risk_amount, 2),
        "entry_price": round(entry_price, 2),
        "stop_price": round(stop_price, 2),
        "risk_per_share": round(risk_per_share, 2),
        "shares": shares,
        "position_value": round(shares * entry_price, 2),
        "max_position_percent": max_position_percent,
    }


def risk_reward(entry: float, stop: float, target: float) -> float | None:
    risk = entry - stop
    reward = target - entry
    if risk <= 0:
        return None
    return round(reward / risk, 2)
