from datetime import datetime, timezone, timedelta

from stock_analysis_pro.indicators.momentum import rsi
from stock_analysis_pro.indicators.volatility import atr, bollinger_bands
from stock_analysis_pro.models import Bar


def bars(count=30):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    out = []
    price = 100.0
    for i in range(count):
        price += 1 if i % 3 else -0.4
        out.append(Bar(start + timedelta(days=i), price - 0.5, price + 1, price - 1, price, 1_000_000))
    return out


def test_rsi_calculation():
    values = [b.close for b in bars(40)]
    result = rsi(values, 14)
    assert result[-1] is not None
    assert 0 <= result[-1] <= 100


def test_atr_calculation():
    result = atr(bars(40), 14)
    assert result[-1] is not None
    assert result[-1] > 0


def test_bollinger_bands_calculation():
    values = [b.close for b in bars(40)]
    result = bollinger_bands(values, 20)
    assert result[-1] is not None
    assert result[-1]["upper"] > result[-1]["middle"] > result[-1]["lower"]
