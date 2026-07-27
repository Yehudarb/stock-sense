from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal


class Action(str, Enum):
    BUY_NOW = "BUY_NOW"
    WAIT_FOR_BREAKOUT = "WAIT_FOR_BREAKOUT"
    WAIT_FOR_PULLBACK = "WAIT_FOR_PULLBACK"
    HOLD = "HOLD"
    ADD_ONLY_IF_CONFIRMED = "ADD_ONLY_IF_CONFIRMED"
    TAKE_PARTIAL_PROFIT = "TAKE_PARTIAL_PROFIT"
    MOVE_STOP = "MOVE_STOP"
    EXIT_POSITION = "EXIT_POSITION"
    AVOID = "AVOID"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


TradingStyle = Literal["day_trade", "swing", "position_trade", "long_term"]


@dataclass(frozen=True)
class TargetGain:
    min: float = 5.0
    max: float = 12.0


@dataclass(frozen=True)
class AnalysisInput:
    symbol: str
    trading_style: TradingStyle = "swing"
    holding_period: str = "1-3 months"
    account_size: float = 25_000.0
    risk_per_trade_percent: float = 1.0
    target_gain_percent: TargetGain = field(default_factory=TargetGain)
    has_position: bool = False
    average_entry_price: float | None = None
    shares: int | None = None
    current_stop: float | None = None
    allow_event_risk: bool = False


@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(frozen=True)
class Quote:
    symbol: str
    price: float
    timestamp: datetime
    bid: float | None = None
    ask: float | None = None
    provider: str = "unknown"
    is_delayed: bool = True


@dataclass(frozen=True)
class ProviderResult:
    provider: str
    quote: Quote | None
    bars: dict[str, list[Bar]]
    financials: dict[str, Any] = field(default_factory=dict)
    news: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
