from __future__ import annotations


def summarize_backtest(result: dict[str, object]) -> str:
    return f"Backtest setup={result.get('setup')} trades={len(result.get('trades', []))} bars={result.get('bar_count')}"
