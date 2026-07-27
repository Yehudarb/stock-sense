from __future__ import annotations

from stock_analysis_pro.setups import detect_breakout, detect_failed_breakout, detect_pullback, detect_reversal, detect_support_bounce

from .base import Setup


REQUIRED_SETUP_NAMES = {
    "BREAKOUT",
    "BREAKOUT_RETEST",
    "PULLBACK_IN_UPTREND",
    "SUPPORT_BOUNCE",
    "TREND_CONTINUATION",
    "REVERSAL",
    "GAP_FILL",
    "MEAN_REVERSION",
    "EARNINGS_MOMENTUM",
    "FAILED_BREAKOUT",
    "BREAKDOWN",
    "NO_TRADE",
}


def detect_all_setups(technical: dict[str, object], confirmation_timeframe: str, target_min: float, target_max: float, news: dict[str, object]) -> list[Setup]:
    setups = [
        detect_failed_breakout(technical, confirmation_timeframe),
        detect_breakout(technical, confirmation_timeframe, target_min, target_max),
        detect_pullback(technical, confirmation_timeframe, target_min, target_max),
        detect_support_bounce(technical, confirmation_timeframe, target_min, target_max),
        detect_reversal(technical, confirmation_timeframe),
        _trend_continuation(technical, confirmation_timeframe),
        _breakout_retest(technical, confirmation_timeframe),
        _gap_fill(technical, confirmation_timeframe),
        _mean_reversion(technical, confirmation_timeframe),
        _earnings_momentum(technical, confirmation_timeframe, news),
        _breakdown(technical, confirmation_timeframe),
    ]
    present = {s.name for s in setups}
    if not any(s.valid for s in setups):
        setups.append(Setup("NO_TRADE", True, "no_trade", None, "No setup satisfies all required conditions", confirmation_timeframe, None, [], 0, 100, reason_codes=["NO_VALID_SETUP"]))
    for missing in sorted(REQUIRED_SETUP_NAMES - present - {"NO_TRADE"}):
        setups.append(Setup(missing, False, "unavailable", None, "Setup not confirmed by current data", confirmation_timeframe, None, [], 0, 50, reason_codes=[f"{missing}_NOT_CONFIRMED"]))
    return setups


def _trend_continuation(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    price = float(technical["price"])
    ema20 = technical.get("ema20")
    trend = technical.get("trend", {}).get("trend")
    valid = trend == "bullish" and ema20 is not None and price > float(ema20)
    return Setup("TREND_CONTINUATION", valid, "continuation", None, f"{confirmation_timeframe} higher low above EMA20", confirmation_timeframe, None, [], 50 if valid else 0, 45)


def _breakout_retest(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    price = float(technical["price"])
    support = technical.get("support")
    ema20 = technical.get("ema20")
    valid = bool(support and ema20 and price >= float(support) and price > float(ema20))
    return Setup("BREAKOUT_RETEST", valid, "breakout_retest", None, f"Successful retest of prior breakout support on {confirmation_timeframe}", confirmation_timeframe, None, [], 48 if valid else 0, 50)


def _gap_fill(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    return Setup("GAP_FILL", False, "gap_fill", None, "Requires explicit gap map from adjacent bars; no actionable gap-fill setup confirmed", confirmation_timeframe, None, [], 0, 55, reason_codes=["GAP_FILL_NOT_CONFIRMED"])


def _mean_reversion(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    rsi = technical.get("rsi14")
    bb = technical.get("bollinger_bands") or {}
    valid = rsi is not None and float(rsi) < 30 and bb.get("percent_b") is not None and float(bb["percent_b"]) < 0
    return Setup("MEAN_REVERSION", valid, "mean_reversion", None, "Reclaim lower Bollinger Band after RSI washout; RSI alone is not enough", confirmation_timeframe, None, [], 42 if valid else 0, 75)


def _earnings_momentum(technical: dict[str, object], confirmation_timeframe: str, news: dict[str, object]) -> Setup:
    valid = bool(news.get("earnings_soon") and (technical.get("relative_volume") or 0) >= 1.5)
    return Setup("EARNINGS_MOMENTUM", valid, "earnings_momentum", None, "Post-earnings continuation with volume confirmation only", confirmation_timeframe, None, [], 45 if valid else 0, 80)


def _breakdown(technical: dict[str, object], confirmation_timeframe: str) -> Setup:
    support = technical.get("support")
    price = float(technical["price"])
    valid = bool(support and price < float(support))
    return Setup("BREAKDOWN", valid, "avoid_or_exit", None, f"{confirmation_timeframe} close below support", confirmation_timeframe, None, [], 65 if valid else 0, 85, reason_codes=["BREAKDOWN"] if valid else [])
