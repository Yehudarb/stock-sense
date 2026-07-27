from __future__ import annotations

from stock_analysis_pro.indicators import atr, average_volume, bollinger_bands, ema, macd, obv, relative_volume, rsi, sma, structure, support_resistance, vwap
from stock_analysis_pro.models import Bar


def technical_snapshot(bars: list[Bar]) -> dict[str, object]:
    closes = [b.close for b in bars]
    if not bars:
        return {"available": False}
    support, resistance = support_resistance(bars)
    atr_values = atr(bars)
    bb = bollinger_bands(closes)
    macd_values = macd(closes)
    return {
        "available": True,
        "price": round(closes[-1], 2),
        "trend": structure(bars),
        "support": support,
        "resistance": resistance,
        "sma20": _last(sma(closes, 20)),
        "sma50": _last(sma(closes, 50)),
        "sma100": _last(sma(closes, 100)),
        "sma200": _last(sma(closes, 200)),
        "ema9": _last(ema(closes, 9)),
        "ema20": _last(ema(closes, 20)),
        "ema50": _last(ema(closes, 50)),
        "rsi14": _last(rsi(closes, 14)),
        "macd": {"line": _last(macd_values["line"]), "signal": _last(macd_values["signal"]), "histogram": _last(macd_values["histogram"])},
        "bollinger_bands": _round_dict(_last(bb)),
        "atr14": _last(atr_values),
        "atr_percent": round((_last(atr_values) or 0) / closes[-1] * 100, 2) if closes[-1] else None,
        "vwap": _round(vwap(bars[-50:])),
        "anchored_vwap": _round(vwap(bars[-120:])),
        "obv": _last(obv(bars)),
        "relative_volume": _round(relative_volume(bars)),
        "average_volume": _round(average_volume(bars)),
        "volume_profile": {"available": False, "reason": "Requires intraday tick or dense volume-at-price data"},
    }


def _last(values):
    if not values:
        return None
    for value in reversed(values):
        if value is not None:
            return _round(value) if isinstance(value, (float, int)) else value
    return None


def _round(value):
    return round(float(value), 2) if value is not None else None


def _round_dict(value):
    if value is None:
        return None
    return {k: _round(v) for k, v in value.items()}
