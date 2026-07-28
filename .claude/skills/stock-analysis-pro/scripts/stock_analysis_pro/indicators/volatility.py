from __future__ import annotations

from statistics import pstdev

from stock_analysis_pro.models import Bar

from .trend import sma


def atr(bars: list[Bar], period: int = 14) -> list[float | None]:
    if not bars:
        return []
    true_ranges: list[float] = []
    prev_close: float | None = None
    for bar in bars:
        if prev_close is None:
            tr = bar.high - bar.low
        else:
            tr = max(bar.high - bar.low, abs(bar.high - prev_close), abs(bar.low - prev_close))
        true_ranges.append(tr)
        prev_close = bar.close
    out: list[float | None] = []
    current: float | None = None
    for i, tr in enumerate(true_ranges):
        if i + 1 < period:
            out.append(None)
        elif current is None:
            current = sum(true_ranges[i + 1 - period:i + 1]) / period
            out.append(current)
        else:
            current = ((current * (period - 1)) + tr) / period
            out.append(current)
    return out


def bollinger_bands(values: list[float], period: int = 20, deviations: float = 2.0) -> list[dict[str, float] | None]:
    means = sma(values, period)
    out: list[dict[str, float] | None] = []
    for i, mean in enumerate(means):
        if mean is None:
            out.append(None)
            continue
        window = values[i + 1 - period:i + 1]
        sd = pstdev(window)
        upper = mean + deviations * sd
        lower = mean - deviations * sd
        bandwidth = (upper - lower) / mean if mean else 0
        percent_b = (values[i] - lower) / (upper - lower) if upper != lower else 0.5
        out.append({"middle": mean, "upper": upper, "lower": lower, "bandwidth": bandwidth, "percent_b": percent_b})
    return out
