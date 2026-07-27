from __future__ import annotations

from .trend import ema


def rsi(values: list[float], period: int = 14) -> list[float | None]:
    if len(values) < period + 1:
        return [None] * len(values)
    out: list[float | None] = [None] * period
    gains = [max(values[i] - values[i - 1], 0) for i in range(1, period + 1)]
    losses = [max(values[i - 1] - values[i], 0) for i in range(1, period + 1)]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    out.append(_rsi(avg_gain, avg_loss))
    for i in range(period + 1, len(values)):
        change = values[i] - values[i - 1]
        gain = max(change, 0)
        loss = max(-change, 0)
        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period
        out.append(_rsi(avg_gain, avg_loss))
    return out


def _rsi(avg_gain: float, avg_loss: float) -> float:
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(values: list[float]) -> dict[str, list[float | None]]:
    fast = ema(values, 12)
    slow = ema(values, 26)
    line = [None if f is None or s is None else f - s for f, s in zip(fast, slow)]
    valid = [v for v in line if v is not None]
    sig_valid = ema(valid, 9)
    signal: list[float | None] = [None] * (len(line) - len(sig_valid)) + sig_valid
    hist = [None if l is None or s is None else l - s for l, s in zip(line, signal)]
    return {"line": line, "signal": signal, "histogram": hist}
