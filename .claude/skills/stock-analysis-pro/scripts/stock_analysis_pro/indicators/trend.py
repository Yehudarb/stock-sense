from __future__ import annotations

from stock_analysis_pro.models import Bar


def sma(values: list[float], period: int) -> list[float | None]:
    out: list[float | None] = []
    for i in range(len(values)):
        if i + 1 < period:
            out.append(None)
        else:
            out.append(sum(values[i + 1 - period:i + 1]) / period)
    return out


def ema(values: list[float], period: int) -> list[float | None]:
    if not values:
        return []
    out: list[float | None] = []
    k = 2 / (period + 1)
    current: float | None = None
    for i, value in enumerate(values):
        if i + 1 < period:
            out.append(None)
            continue
        if current is None:
            current = sum(values[i + 1 - period:i + 1]) / period
        else:
            current = value * k + current * (1 - k)
        out.append(current)
    return out


def support_resistance(bars: list[Bar], lookback: int = 60) -> tuple[float | None, float | None]:
    recent = bars[-lookback:]
    if len(recent) < 10:
        return None, None
    price = recent[-1].close
    lows = sorted({round(b.low, 2) for b in recent if b.low < price})
    highs = sorted({round(b.high, 2) for b in recent if b.high > price})
    return (lows[-1] if lows else None, highs[0] if highs else None)


def structure(bars: list[Bar], lookback: int = 20) -> dict[str, object]:
    recent = bars[-lookback:]
    if len(recent) < 6:
        return {"trend": "unknown", "higher_high": False, "higher_low": False, "lower_high": False, "lower_low": False}
    first = recent[: len(recent) // 2]
    second = recent[len(recent) // 2:]
    higher_high = max(b.high for b in second) > max(b.high for b in first)
    higher_low = min(b.low for b in second) > min(b.low for b in first)
    lower_high = max(b.high for b in second) < max(b.high for b in first)
    lower_low = min(b.low for b in second) < min(b.low for b in first)
    trend = "bullish" if higher_high and higher_low else "bearish" if lower_high and lower_low else "neutral"
    return {
        "trend": trend,
        "higher_high": higher_high,
        "higher_low": higher_low,
        "lower_high": lower_high,
        "lower_low": lower_low,
        "consolidation": (max(b.high for b in recent) - min(b.low for b in recent)) / recent[-1].close < 0.06,
    }
