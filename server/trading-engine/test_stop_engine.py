"""
Unit tests for stop_engine.py
Tests ATR-based stops, support levels, edge cases
"""

import pytest
from stop_engine import (
    calculate_optimal_levels,
    calculate_rr_ratio,
    calculate_risk_reward_pct,
    StopDecision,
    StopReason,
)


class TestCalculateRRRatio:
    """Test R:R ratio calculation"""

    def test_basic_rr_ratio(self):
        """Test basic R:R calculation"""
        # Entry 100, Stop 90, Target 130
        # Risk = 10, Reward = 30 → R:R = 3:1
        rr = calculate_rr_ratio(entry=100, stop=90, target=130)
        assert rr == 3.0

    def test_rr_ratio_small_values(self):
        """Test R:R with small values (like stocks)"""
        # Entry 7.60, Stop 7.30, Target 8.74
        rr = calculate_rr_ratio(entry=7.60, stop=7.30, target=8.74)
        assert abs(rr - 3.75) < 0.01

    def test_rr_ratio_invalid_stop_above_entry(self):
        """Raise error if stop >= entry"""
        with pytest.raises(ValueError, match="Stop.*must be below entry"):
            calculate_rr_ratio(entry=100, stop=100, target=120)

    def test_rr_ratio_invalid_target_below_entry(self):
        """Raise error if target <= entry"""
        with pytest.raises(ValueError, match="Target.*must be above entry"):
            calculate_rr_ratio(entry=100, stop=80, target=100)


class TestCalculateRiskRewardPct:
    """Test risk/reward percentage calculation"""

    def test_risk_reward_pct_simple(self):
        """Test simple percentage calculation"""
        risk_pct, reward_pct = calculate_risk_reward_pct(entry=100, stop=95, target=115)
        assert risk_pct == 5.0
        assert reward_pct == 15.0

    def test_risk_reward_pct_stock_prices(self):
        """Test with stock prices (TSLL example)"""
        risk_pct, reward_pct = calculate_risk_reward_pct(entry=7.60, stop=7.30, target=8.74)
        assert abs(risk_pct - 3.95) < 0.1
        assert abs(reward_pct - 15.0) < 0.1


class TestCalculateOptimalLevels:
    """Test main stop decision calculator"""

    def test_basic_atr_calculation(self):
        """Test basic ATR-based stops without support"""
        # TSLL example: entry=7.60, atr=0.38
        decision = calculate_optimal_levels(entry_price=7.60, atr=0.38)

        assert isinstance(decision, StopDecision)
        assert decision.entry_price == 7.60
        assert decision.atr == 0.38

        # Tight: entry - 1.0*ATR = 7.60 - 0.38 = 7.22
        assert abs(decision.tight.stop_price - 7.22) < 0.01

        # Normal: entry - 1.5*ATR = 7.60 - 0.57 = 7.03
        assert abs(decision.normal.stop_price - 7.03) < 0.01

        # R:R should be good
        assert decision.tight.rr_ratio >= 3.5
        assert decision.normal.rr_ratio >= 3.0

    def test_recommended_without_support(self):
        """Without support, should recommend 'normal'"""
        decision = calculate_optimal_levels(entry_price=7.60, atr=0.38)
        assert decision.recommended == "normal"
        assert decision.warning is None

    def test_support_level_below_stop(self):
        """Support below normal stop → recommend normal"""
        # Support at 7.10 is below normal stop (7.03)
        decision = calculate_optimal_levels(
            entry_price=7.60,
            atr=0.38,
            support_price=7.10,  # Below normal stop
        )
        assert decision.recommended in ["normal", "wide"]

    def test_support_level_above_tight_stop(self):
        """Support above tight stop → recommend tight"""
        # Support at 7.20 is above tight stop (7.22)? No, let's adjust
        # Support at 7.23 is above tight stop (7.22)
        decision = calculate_optimal_levels(
            entry_price=7.60,
            atr=0.38,
            support_price=7.23,  # Above tight stop
        )
        assert decision.recommended == "tight"

    def test_support_above_entry_warning(self):
        """Support >= entry should trigger warning"""
        decision = calculate_optimal_levels(
            entry_price=7.60,
            atr=0.38,
            support_price=7.60,  # At entry price
        )
        assert "Support is above entry" in decision.warning

    def test_edge_case_zero_atr(self):
        """With zero ATR, fallback to fixed percentages"""
        decision = calculate_optimal_levels(entry_price=7.60, atr=0.0)

        # Should fall back to fixed %
        assert decision.tight.reason == StopReason.EDGE_CASE_ZERO_ATR
        assert decision.normal.reason == StopReason.EDGE_CASE_ZERO_ATR

        # Tight: 3% stop, 12% target
        expected_stop = 7.60 * (1 - 0.03)
        assert abs(decision.tight.stop_price - expected_stop) < 0.01

    def test_edge_case_negative_atr(self):
        """Negative ATR should raise ValueError"""
        with pytest.raises(ValueError, match="ATR cannot be negative"):
            calculate_optimal_levels(entry_price=7.60, atr=-0.5)

    def test_edge_case_invalid_entry(self):
        """Zero or negative entry price should raise ValueError"""
        with pytest.raises(ValueError, match="Entry price must be positive"):
            calculate_optimal_levels(entry_price=0, atr=0.38)

        with pytest.raises(ValueError, match="Entry price must be positive"):
            calculate_optimal_levels(entry_price=-5, atr=0.38)

    def test_risk_capped_at_5_percent(self):
        """Risk should never exceed 5%"""
        # Very high ATR to test cap
        decision = calculate_optimal_levels(entry_price=100, atr=10)

        # All risk percentages should be <= 5%
        assert decision.tight.risk_pct <= 5.0
        assert decision.normal.risk_pct <= 5.0
        assert decision.wide.risk_pct <= 5.0

    def test_to_dict_conversion(self):
        """Test conversion to dictionary for JSON"""
        decision = calculate_optimal_levels(entry_price=7.60, atr=0.38)
        data = decision.to_dict()

        assert data["entry_price"] == 7.60
        assert data["atr"] == 0.38
        assert "tight" in data
        assert "normal" in data
        assert "wide" in data
        assert "recommended" in data
        assert data["tight"]["stop"] > 0
        assert data["tight"]["target"] > data["entry_price"]

    def test_realistic_scenario_tsll(self):
        """
        Realistic scenario: TSLL stock
        Entry: $7.60, ATR: $0.38, Support: $7.25
        """
        decision = calculate_optimal_levels(
            entry_price=7.60,
            atr=0.38,
            support_price=7.25,
            volatility_pct=0.05,
        )

        # Verify structure
        assert decision.entry_price == 7.60
        assert decision.support_price == 7.25
        assert decision.recommended in ["tight", "normal", "wide"]

        # Tight stop should be above support
        assert decision.tight.stop_price > decision.support_price

        # All R:R ratios should be > 1.5:1
        assert decision.tight.rr_ratio >= 1.5
        assert decision.normal.rr_ratio >= 1.5
        assert decision.wide.rr_ratio >= 1.5

        # Risk should be <= 5%
        assert decision.tight.risk_pct <= 5.0
        assert decision.normal.risk_pct <= 5.0
        assert decision.wide.risk_pct <= 5.0

    def test_volatility_parameter(self):
        """Test that volatility parameter is stored (for future use)"""
        decision = calculate_optimal_levels(
            entry_price=100,
            atr=2,
            volatility_pct=0.08,  # 8% volatility
        )
        assert decision.volatility_pct == 0.08


class TestBackwardCompatibility:
    """Test that old code still works"""

    def test_legacy_function_exists(self):
        """Legacy function should still be available"""
        from stop_engine import calculate_optimal_levels_legacy

        levels = calculate_optimal_levels_legacy(entry_price=7.60, volatility_pct=0.05)

        # Should have tight, normal, wide
        assert "tight" in levels
        assert "normal" in levels
        assert "wide" in levels

        # Tight: 3% stop, 12% target, 4:1
        assert abs(levels["tight"]["stop"] - 7.60 * 0.97) < 0.01
        assert abs(levels["tight"]["rr"] - 4.0) < 0.01


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
