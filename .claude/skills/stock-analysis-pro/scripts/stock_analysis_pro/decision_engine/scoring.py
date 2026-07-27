from __future__ import annotations

from stock_analysis_pro.risk.position_size import risk_reward
from stock_analysis_pro.setups.base import Setup


WEIGHTS = {
    "swing": {"trend": 25, "rr": 20, "volume": 15, "momentum": 10, "relative_strength": 10, "market": 10, "fundamentals": 5, "news": 5},
    "day_trade": {"trend": 20, "rr": 20, "volume": 20, "momentum": 15, "relative_strength": 10, "market": 15, "fundamentals": 0, "news": 0},
    "position_trade": {"trend": 25, "rr": 20, "volume": 10, "momentum": 10, "relative_strength": 10, "market": 10, "fundamentals": 10, "news": 5},
    "long_term": {"trend": 15, "rr": 10, "volume": 5, "momentum": 5, "relative_strength": 10, "market": 10, "fundamentals": 35, "news": 10},
}


def score_trade(*, setup: Setup | None, technical: dict[str, object], market_regime: dict[str, object], fundamentals: dict[str, object], news: dict[str, object], style: str) -> dict[str, object]:
    weights = WEIGHTS.get(style, WEIGHTS["swing"])
    score = 0.0
    trend = technical.get("trend", {}).get("trend")
    if trend == "bullish":
        score += weights["trend"]
    elif trend == "neutral":
        score += weights["trend"] * 0.45

    if setup and setup.entry_zone and setup.stop and setup.targets:
        rr = risk_reward(setup.entry_zone[0], setup.stop, setup.targets[0])
        if rr and rr >= 2:
            score += weights["rr"]
        elif rr and rr >= 1.5:
            score += weights["rr"] * 0.6

    rvol = technical.get("relative_volume")
    if rvol is not None and float(rvol) >= 1.4:
        score += weights["volume"]
    elif rvol is not None and float(rvol) >= 0.8:
        score += weights["volume"] * 0.5

    rsi = technical.get("rsi14")
    if rsi is not None and 50 <= float(rsi) <= 70:
        score += weights["momentum"]
    elif rsi is not None and 40 <= float(rsi) < 50:
        score += weights["momentum"] * 0.4

    if market_regime.get("state") == "risk_on":
        score += weights["market"]
    elif market_regime.get("state") == "mixed":
        score += weights["market"] * 0.4

    if fundamentals.get("status") == "available":
        score += weights["fundamentals"] * 0.6
    if news.get("status") == "available" and not news.get("high_impact_events"):
        score += weights["news"] * 0.5

    score = max(0, min(100, round(score)))
    return {"trade_score": score, "grade": _grade(score), "confidence": min(95, max(10, score - 5)), "risk_level": _risk(score, news, market_regime)}


def _grade(score: int) -> str:
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    return "No Trade"


def _risk(score: int, news: dict[str, object], market_regime: dict[str, object]) -> str:
    if news.get("high_impact_events") or market_regime.get("state") == "risk_off" or score < 60:
        return "high"
    if score < 75:
        return "medium"
    return "low"
