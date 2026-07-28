from __future__ import annotations

from stock_analysis_pro.models import Bar


def relative_strength(symbol_bars: list[Bar], benchmark_bars: list[Bar], lookback: int = 30) -> float | None:
    if len(symbol_bars) < lookback + 1 or len(benchmark_bars) < lookback + 1:
        return None
    s = (symbol_bars[-1].close / symbol_bars[-lookback - 1].close) - 1
    b = (benchmark_bars[-1].close / benchmark_bars[-lookback - 1].close) - 1
    return (s - b) * 100
