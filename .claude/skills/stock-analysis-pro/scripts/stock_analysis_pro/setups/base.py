from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Setup:
    name: str
    valid: bool
    entry_type: str
    entry_zone: tuple[float, float] | None
    trigger: str
    confirmation_timeframe: str
    stop: float | None
    targets: list[float]
    confidence: int
    risk_score: int
    required_conditions: list[str] = field(default_factory=list)
    strengthening_conditions: list[str] = field(default_factory=list)
    invalidation_conditions: list[str] = field(default_factory=list)
    reason_codes: list[str] = field(default_factory=list)
