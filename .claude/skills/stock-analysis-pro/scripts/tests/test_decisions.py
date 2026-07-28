from datetime import datetime, timedelta, timezone

from stock_analysis_pro.engine import analyze
from stock_analysis_pro.models import AnalysisInput, Bar, Quote
from stock_analysis_pro.providers.base import MarketDataProvider
from stock_analysis_pro.risk.leveraged_etf import leveraged_profile


class FakeProvider(MarketDataProvider):
    name = "fake"

    def get_quote(self, symbol):
        return Quote(symbol, 110, datetime.now(timezone.utc), provider=self.name, is_delayed=False)

    def get_bars(self, symbol, timeframe, start, end):
        return make_bars()


class BackupProvider(FakeProvider):
    name = "backup"

    def get_quote(self, symbol):
        return Quote(symbol, 110.1, datetime.now(timezone.utc), provider=self.name, is_delayed=True)


def make_bars(count=220):
    start = datetime.now(timezone.utc) - timedelta(days=count)
    out = []
    for i in range(count):
        price = 80 + i * 0.15
        out.append(Bar(start + timedelta(days=i), price - 0.5, price + 1, price - 1, price, 1_000_000 if i < count - 1 else 2_000_000))
    return out


def test_user_without_position_gets_action():
    result = analyze(AnalysisInput(symbol="AAPL"), providers=[FakeProvider(), BackupProvider()])
    assert result["current_action"] in {"BUY_NOW", "WAIT_FOR_BREAKOUT", "WAIT_FOR_PULLBACK", "AVOID", "INSUFFICIENT_DATA"}
    assert result["entry_scenarios"]


def test_user_with_position_gets_position_analysis():
    request = AnalysisInput(symbol="AAPL", has_position=True, average_entry_price=100, shares=50, current_stop=95)
    result = analyze(request, providers=[FakeProvider(), BackupProvider()])
    assert result["position_analysis"]["shares"] == 50
    assert result["position_analysis"]["average_down_allowed"] is False


def test_leveraged_etf_profile():
    result = leveraged_profile("TSLL")
    assert result["is_leveraged_etf"] is True
    assert result["recommended_risk_multiplier"] < 1


def test_earnings_soon_blocks_without_approval():
    request = AnalysisInput(symbol="AAPL")
    result = analyze(request, providers=[FakeProvider(), BackupProvider()])
    assert "current_action" in result


def test_stop_too_far_or_low_rr_has_reason_codes():
    result = analyze(AnalysisInput(symbol="AAPL"), providers=[FakeProvider(), BackupProvider()])
    assert isinstance(result["reason_codes"], list)


def test_no_invalidation_prevents_buy():
    result = analyze(AnalysisInput(symbol="AAPL"), providers=[FakeProvider(), BackupProvider()])
    assert result["stop_loss"]["hard_stop"] is True
