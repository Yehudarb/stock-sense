from __future__ import annotations

from stock_analysis_pro.models import Bar


def average_volume(bars: list[Bar], period: int = 20) -> float | None:
    if len(bars) < period:
        return None
    return sum(b.volume for b in bars[-period:]) / period


def relative_volume(bars: list[Bar], period: int = 20) -> float | None:
    avg = average_volume(bars[:-1], period)
    if not avg:
        return None
    return bars[-1].volume / avg


def obv(bars: list[Bar]) -> list[float]:
    out: list[float] = []
    current = 0.0
    prev = None
    for bar in bars:
        if prev is not None:
            if bar.close > prev:
                current += bar.volume
            elif bar.close < prev:
                current -= bar.volume
        out.append(current)
        prev = bar.close
    return out


def vwap(bars: list[Bar]) -> float | None:
    pv = sum(((b.high + b.low + b.close) / 3) * b.volume for b in bars)
    vol = sum(b.volume for b in bars)
    return pv / vol if vol else None
