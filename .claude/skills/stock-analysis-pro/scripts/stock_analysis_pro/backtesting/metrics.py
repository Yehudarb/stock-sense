from __future__ import annotations

import math


def calculate_metrics(trades: list[dict[str, float]]) -> dict[str, float | int]:
    returns = [float(t.get("r_multiple", 0)) for t in trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r < 0]
    gross_win = sum(wins)
    gross_loss = abs(sum(losses))
    expectancy = sum(returns) / len(returns) if returns else 0
    mean = expectancy
    variance = sum((r - mean) ** 2 for r in returns) / len(returns) if returns else 0
    return {
        "win_rate": round(len(wins) / len(returns) * 100, 2) if returns else 0,
        "profit_factor": round(gross_win / gross_loss, 2) if gross_loss else math.inf if gross_win else 0,
        "average_r": round(expectancy, 2),
        "maximum_drawdown": _max_drawdown(returns),
        "expectancy": round(expectancy, 2),
        "sharpe_ratio": round(mean / math.sqrt(variance), 2) if variance else 0,
        "number_of_trades": len(trades),
    }


def _max_drawdown(returns: list[float]) -> float:
    equity = peak = 0.0
    max_dd = 0.0
    for r in returns:
        equity += r
        peak = max(peak, equity)
        max_dd = min(max_dd, equity - peak)
    return round(max_dd, 2)
