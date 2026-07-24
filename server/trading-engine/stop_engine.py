"""
Trading Stop Loss & Target Calculator
ATR-based dynamic stops with support level detection
"""

from dataclasses import dataclass
from typing import Optional, Dict, Literal
from enum import Enum


class StopReason(str, Enum):
    """Reason codes for stop decision"""
    ATR_TIGHT = "atr_tight"
    ATR_NORMAL = "atr_normal"
    ATR_WIDE = "atr_wide"
    SUPPORT_OVERRIDE = "support_override"
    SUPPORT_WARNING = "support_warning"
    SUPPORT_BREAKOUT = "support_breakout"
    EDGE_CASE_ZERO_ATR = "edge_case_zero_atr"
    EDGE_CASE_SUPPORT_ABOVE = "edge_case_support_above"


@dataclass
class StopLevel:
    """Single stop/target level"""
    stop_price: float
    target_price: float
    risk_pct: float
    reward_pct: float
    rr_ratio: float
    reason: StopReason


@dataclass
class StopDecision:
    """Complete stop decision with all scenarios"""
    entry_price: float
    atr: float
    support_price: Optional[float]
    volatility_pct: float

    # Three scenarios
    tight: StopLevel
    normal: StopLevel
    wide: StopLevel

    # Recommended choice
    recommended: Literal["tight", "normal", "wide"]
    warning: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON response"""
        return {
            "entry_price": round(self.entry_price, 2),
            "atr": round(self.atr, 2),
            "support_price": round(self.support_price, 2) if self.support_price else None,
            "volatility_pct": round(self.volatility_pct * 100, 2),

            "tight": {
                "stop": round(self.tight.stop_price, 2),
                "target": round(self.tight.target_price, 2),
                "risk_pct": round(self.tight.risk_pct, 2),
                "reward_pct": round(self.tight.reward_pct, 2),
                "rr_ratio": round(self.tight.rr_ratio, 2),
                "reason": self.tight.reason.value,
            },
            "normal": {
                "stop": round(self.normal.stop_price, 2),
                "target": round(self.normal.target_price, 2),
                "risk_pct": round(self.normal.risk_pct, 2),
                "reward_pct": round(self.normal.reward_pct, 2),
                "rr_ratio": round(self.normal.rr_ratio, 2),
                "reason": self.normal.reason.value,
            },
            "wide": {
                "stop": round(self.wide.stop_price, 2),
                "target": round(self.wide.target_price, 2),
                "risk_pct": round(self.wide.risk_pct, 2),
                "reward_pct": round(self.wide.reward_pct, 2),
                "rr_ratio": round(self.wide.rr_ratio, 2),
                "reason": self.wide.reason.value,
            },

            "recommended": self.recommended,
            "warning": self.warning,
        }


def calculate_rr_ratio(entry: float, stop: float, target: float) -> float:
    """
    Calculate Risk:Reward ratio

    Args:
        entry: Entry price
        stop: Stop loss price
        target: Take profit price

    Returns:
        R:R ratio (reward per unit of risk)

    Raises:
        ValueError: If stop >= entry or target <= entry
    """
    if stop >= entry:
        raise ValueError(f"Stop ({stop}) must be below entry ({entry})")
    if target <= entry:
        raise ValueError(f"Target ({target}) must be above entry ({entry})")

    risk = entry - stop
    reward = target - entry
    return reward / risk


def calculate_risk_reward_pct(
    entry: float,
    stop: float,
    target: float
) -> tuple[float, float]:
    """
    Calculate risk and reward as percentage of entry

    Returns:
        (risk_pct, reward_pct)
    """
    risk_pct = ((entry - stop) / entry) * 100
    reward_pct = ((target - entry) / entry) * 100
    return risk_pct, reward_pct


def _calculate_atr_stops(
    entry_price: float,
    atr: float,
    support_price: Optional[float] = None,
) -> tuple[StopLevel, StopLevel, StopLevel]:
    """
    Calculate ATR-based stops and targets

    Scenarios:
    - Tight: 1.0×ATR below entry, 4×ATR above
    - Normal: 1.5×ATR below entry, 3×ATR above
    - Wide: 2.0×ATR below entry, 2×ATR above

    Max risk capped at 5% to prevent large losses
    """

    # Edge case: ATR is zero or negative
    if atr <= 0:
        # Fallback to fixed percentages
        return (
            _create_fixed_percentage_level(entry_price, 0.03, 0.12, StopReason.EDGE_CASE_ZERO_ATR),
            _create_fixed_percentage_level(entry_price, 0.04, 0.15, StopReason.EDGE_CASE_ZERO_ATR),
            _create_fixed_percentage_level(entry_price, 0.05, 0.25, StopReason.EDGE_CASE_ZERO_ATR),
        )

    # TIGHT: 1.0×ATR stop, 4×ATR target
    tight_stop = entry_price - (1.0 * atr)
    tight_target = entry_price + (4.0 * atr)
    tight_risk_pct, tight_reward_pct = calculate_risk_reward_pct(entry_price, tight_stop, tight_target)

    # Cap risk at 5%
    if tight_risk_pct > 5:
        tight_stop = entry_price * (1 - 0.05)
        tight_risk_pct = 5.0
        tight_reward_pct = ((tight_target - entry_price) / entry_price) * 100

    tight = StopLevel(
        stop_price=tight_stop,
        target_price=tight_target,
        risk_pct=tight_risk_pct,
        reward_pct=tight_reward_pct,
        rr_ratio=calculate_rr_ratio(entry_price, tight_stop, tight_target),
        reason=StopReason.ATR_TIGHT,
    )

    # NORMAL: 1.5×ATR stop, 3×ATR target
    normal_stop = entry_price - (1.5 * atr)
    normal_target = entry_price + (3.0 * atr)
    normal_risk_pct, normal_reward_pct = calculate_risk_reward_pct(entry_price, normal_stop, normal_target)

    # Cap risk at 5%
    if normal_risk_pct > 5:
        normal_stop = entry_price * (1 - 0.05)
        normal_risk_pct = 5.0
        normal_reward_pct = ((normal_target - entry_price) / entry_price) * 100

    normal = StopLevel(
        stop_price=normal_stop,
        target_price=normal_target,
        risk_pct=normal_risk_pct,
        reward_pct=normal_reward_pct,
        rr_ratio=calculate_rr_ratio(entry_price, normal_stop, normal_target),
        reason=StopReason.ATR_NORMAL,
    )

    # WIDE: 2.0×ATR stop, 2×ATR target (not recommended)
    wide_stop = entry_price - (2.0 * atr)
    wide_target = entry_price + (2.0 * atr)
    wide_risk_pct, wide_reward_pct = calculate_risk_reward_pct(entry_price, wide_stop, wide_target)

    # Cap risk at 5%
    if wide_risk_pct > 5:
        wide_stop = entry_price * (1 - 0.05)
        wide_risk_pct = 5.0
        wide_reward_pct = ((wide_target - entry_price) / entry_price) * 100

    wide = StopLevel(
        stop_price=wide_stop,
        target_price=wide_target,
        risk_pct=wide_risk_pct,
        reward_pct=wide_reward_pct,
        rr_ratio=calculate_rr_ratio(entry_price, wide_stop, wide_target),
        reason=StopReason.ATR_WIDE,
    )

    return tight, normal, wide


def _create_fixed_percentage_level(
    entry_price: float,
    risk_pct: float,
    reward_pct: float,
    reason: StopReason,
) -> StopLevel:
    """Helper: Create stop level from fixed percentages"""
    stop = entry_price * (1 - risk_pct)
    target = entry_price * (1 + reward_pct)
    return StopLevel(
        stop_price=stop,
        target_price=target,
        risk_pct=risk_pct * 100,
        reward_pct=reward_pct * 100,
        rr_ratio=calculate_rr_ratio(entry_price, stop, target),
        reason=reason,
    )


def _check_support_impact(
    entry_price: float,
    tight: StopLevel,
    normal: StopLevel,
    wide: StopLevel,
    support_price: Optional[float],
) -> tuple[str, Optional[str], StopLevel]:
    """
    Check if support level affects stop decision

    Returns:
        (recommended_level, warning_message, adjusted_level)
    """

    if not support_price:
        return "normal", None, normal

    # Edge case: support >= entry (invalid)
    if support_price >= entry_price:
        return "tight", "⚠️ Support is above entry — entry may be invalid", tight

    support_distance_pct = ((entry_price - support_price) / entry_price) * 100

    # Tight stop is below support → recommend normal or widen
    if tight.stop_price < support_price:
        if normal.stop_price >= support_price:
            # Normal is OK (above support)
            return "normal", f"⚠️ Tight stop below support ({support_distance_pct:.1f}%). Using normal.", normal
        else:
            # Both tight and normal below support → use wide
            return "wide", f"⚠️ Support very close ({support_distance_pct:.1f}%). Using wide stop.", wide

    # All stops above support (good scenario)
    if support_distance_pct > 3:
        return "tight", None, tight
    elif support_distance_pct > 1:
        return "normal", None, normal
    else:
        return "wide", f"ℹ️ Support very close ({support_distance_pct:.2f}%). Consider wide stop.", wide


def calculate_optimal_levels(
    entry_price: float,
    atr: float,
    support_price: Optional[float] = None,
    volatility_pct: float = 0.05,
) -> StopDecision:
    """
    Calculate optimal stop loss and target levels

    Combines:
    1. ATR-based dynamic stops
    2. Support level detection
    3. Risk:Reward validation
    4. Volatility awareness

    Args:
        entry_price: Entry price (e.g., 7.60)
        atr: Average True Range from technical analysis
        support_price: Nearest support level (optional)
        volatility_pct: Daily volatility percentage (default 5%)

    Returns:
        StopDecision with three scenarios (tight, normal, wide)

    Example:
        >>> levels = calculate_optimal_levels(7.60, 0.38, support_price=7.25)
        >>> levels.recommended
        'normal'
        >>> levels.normal.stop_price
        7.03
    """

    # Validate inputs
    if entry_price <= 0:
        raise ValueError(f"Entry price must be positive, got {entry_price}")
    if atr < 0:
        raise ValueError(f"ATR cannot be negative, got {atr}")
    if support_price is not None and support_price < 0:
        raise ValueError(f"Support price must be non-negative, got {support_price}")

    # Calculate ATR-based stops
    tight, normal, wide = _calculate_atr_stops(entry_price, atr, support_price)

    # Check support level impact
    recommended, warning, adjusted = _check_support_impact(
        entry_price, tight, normal, wide, support_price
    )

    return StopDecision(
        entry_price=entry_price,
        atr=atr,
        support_price=support_price,
        volatility_pct=volatility_pct,
        tight=tight,
        normal=normal,
        wide=wide,
        recommended=recommended,
        warning=warning,
    )


# Backward compatibility: Old function name
def calculate_optimal_levels_legacy(entry_price: float, volatility_pct: float) -> Dict:
    """
    Legacy function for fixed percentage calculation
    (for backward compatibility)
    """
    return {
        "tight": {
            "stop": entry_price * (1 - 0.03),
            "target": entry_price * (1 + 0.12),
            "rr": 4.0,
        },
        "normal": {
            "stop": entry_price * (1 - 0.04),
            "target": entry_price * (1 + 0.15),
            "rr": 3.75,
        },
        "wide": {
            "stop": entry_price * (1 - 0.10),
            "target": entry_price * (1 + 0.25),
            "rr": 1.75,
        },
    }
