from datetime import datetime, timedelta, timezone

from stock_analysis_pro.analysis.technical import technical_snapshot
from stock_analysis_pro.models import Bar
from stock_analysis_pro.setups.breakout import detect_breakout
from stock_analysis_pro.setups.failed_breakout import detect_failed_breakout


def bars_for_breakout(volume_last=2_000_000, close_above=True):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    out = []
    for i in range(80):
        close = 100 + i * 0.1
        out.append(Bar(start + timedelta(days=i), close - 0.2, close + 0.5, close - 0.8, close, 1_000_000))
    last = out[-1]
    close = last.high + 1 if close_above else last.close
    out[-1] = Bar(last.timestamp, last.open, close + 0.2, last.low, close, volume_last)
    return out


def test_confirmed_breakout():
    tech = technical_snapshot(bars_for_breakout())
    tech["resistance"] = tech["price"] - 0.5
    tech["support"] = tech["price"] - 5
    setup = detect_breakout(tech, "1H", 5, 12)
    assert setup.valid


def test_breakout_without_volume_not_confirmed():
    tech = technical_snapshot(bars_for_breakout(volume_last=500_000))
    tech["resistance"] = tech["price"] - 0.5
    tech["support"] = tech["price"] - 5
    setup = detect_breakout(tech, "1H", 5, 12)
    assert not setup.valid
    assert "VOLUME_CONFIRMATION_MISSING" in setup.reason_codes


def test_failed_breakout():
    tech = technical_snapshot(bars_for_breakout(volume_last=2_000_000, close_above=False))
    tech["resistance"] = tech["price"] + 0.5
    setup = detect_failed_breakout(tech, "1H")
    assert setup.valid
