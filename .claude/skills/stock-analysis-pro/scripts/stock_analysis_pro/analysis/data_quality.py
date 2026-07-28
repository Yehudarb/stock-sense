from __future__ import annotations

from datetime import datetime, timezone

from stock_analysis_pro.models import Bar, Quote


def market_status(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        eastern = now.astimezone(ZoneInfo("America/New_York"))
    except Exception:
        eastern = now
    if eastern.weekday() >= 5:
        return "closed"
    minutes = eastern.hour * 60 + eastern.minute
    return "open" if 9 * 60 + 30 <= minutes < 16 * 60 else "closed"


def validate_data(
    *,
    primary_provider: str,
    backup_provider: str | None,
    quote: Quote | None,
    backup_quote: Quote | None,
    bars: list[Bar],
    max_age_minutes_open: int = 30,
    max_price_difference_percent: float = 2.0,
    min_bars: int = 60,
    min_average_volume: float = 200_000,
) -> dict[str, object]:
    warnings: list[str] = []
    status = "verified"
    now = datetime.now(timezone.utc)
    last_ts = quote.timestamp if quote else (bars[-1].timestamp if bars else None)
    age_minutes = ((now - last_ts).total_seconds() / 60) if last_ts else None
    session = market_status(now)

    if not bars or len(bars) < min_bars:
        warnings.append("MISSING_OR_INSUFFICIENT_BARS")
        status = "invalid"

    if quote and quote.is_delayed and status == "verified":
        status = "acceptable"
        warnings.append("DELAYED_DATA")

    if last_ts is None:
        warnings.append("MISSING_TIMESTAMP")
        status = "invalid"
    elif session == "open" and age_minutes is not None and age_minutes > max_age_minutes_open:
        warnings.append("STALE_DATA")
        status = "invalid"

    price_difference_percent = None
    if quote and backup_quote and quote.price and backup_quote.price:
        price_difference_percent = abs((quote.price - backup_quote.price) / quote.price) * 100
        if price_difference_percent > max_price_difference_percent:
            warnings.append("PROVIDER_PRICE_DIVERGENCE")
            status = "invalid"

    if bars:
        avg_vol = sum(b.volume for b in bars[-20:]) / min(20, len(bars))
        if avg_vol < min_average_volume:
            warnings.append("LOW_LIQUIDITY")
            status = "degraded" if status == "verified" else status
        if any(b.high < b.low or b.close <= 0 for b in bars):
            warnings.append("ANOMALOUS_BAR")
            status = "invalid"
        if len(bars) >= 2 and abs((bars[-1].open - bars[-2].close) / bars[-2].close) > 0.12:
            warnings.append("LARGE_GAP_RISK")

    return {
        "status": status,
        "primary_provider": primary_provider,
        "backup_provider": backup_provider,
        "price_difference_percent": round(price_difference_percent, 2) if price_difference_percent is not None else None,
        "is_delayed": bool(quote.is_delayed) if quote else True,
        "last_market_timestamp": last_ts.isoformat() if last_ts else None,
        "market_status": session,
        "warnings": warnings,
    }
