"""Trading Engine Module - ATR-based stop loss calculator"""

from .stop_engine import (
    calculate_optimal_levels,
    StopDecision,
    StopReason,
    StopLevel,
)

__version__ = "1.0.0"
__all__ = [
    "calculate_optimal_levels",
    "StopDecision",
    "StopReason",
    "StopLevel",
]
