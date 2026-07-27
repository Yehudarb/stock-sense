from stock_analysis_pro.risk.position_size import calculate_position_size, risk_reward


def test_position_sizing():
    result = calculate_position_size(account_size=25_000, risk_percent=1, entry_price=100, stop_price=95)
    assert result["max_risk_amount"] == 250
    assert result["risk_per_share"] == 5
    assert result["shares"] == 50


def test_risk_reward():
    assert risk_reward(100, 95, 110) == 2
