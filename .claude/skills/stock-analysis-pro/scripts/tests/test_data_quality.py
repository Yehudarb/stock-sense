from datetime import datetime, timedelta, timezone

from stock_analysis_pro.analysis.data_quality import validate_data
from stock_analysis_pro.models import Bar, Quote


def make_bars(count=70, volume=1_000_000):
    start = datetime.now(timezone.utc) - timedelta(days=count)
    return [Bar(start + timedelta(days=i), 100 + i, 101 + i, 99 + i, 100 + i, volume) for i in range(count)]


def test_missing_data_invalid():
    result = validate_data(primary_provider="x", backup_provider=None, quote=None, backup_quote=None, bars=[])
    assert result["status"] == "invalid"
    assert "MISSING_OR_INSUFFICIENT_BARS" in result["warnings"]


def test_stale_data_invalid_when_open_like_timestamp_missing():
    old_quote = Quote("AAPL", 100, datetime.now(timezone.utc) - timedelta(days=10), provider="test")
    result = validate_data(primary_provider="x", backup_provider=None, quote=old_quote, backup_quote=None, bars=make_bars())
    assert result["last_market_timestamp"] is not None


def test_provider_price_gap_invalid():
    quote = Quote("AAPL", 100, datetime.now(timezone.utc), provider="a")
    backup = Quote("AAPL", 105, datetime.now(timezone.utc), provider="b")
    result = validate_data(primary_provider="a", backup_provider="b", quote=quote, backup_quote=backup, bars=make_bars())
    assert result["status"] == "invalid"
    assert "PROVIDER_PRICE_DIVERGENCE" in result["warnings"]
