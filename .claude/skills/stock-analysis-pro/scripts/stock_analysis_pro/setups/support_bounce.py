from __future__ import annotations

from .pullback import detect_pullback


def detect_support_bounce(technical: dict[str, object], confirmation_timeframe: str, target_min: float, target_max: float):
    setup = detect_pullback(technical, confirmation_timeframe, target_min, target_max)
    return setup.__class__(**{**setup.__dict__, "name": "SUPPORT_BOUNCE", "entry_type": "support_bounce"})
