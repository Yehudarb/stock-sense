from __future__ import annotations

from stock_analysis_pro.setups.base import Setup


def scenario_from_setup(setup: Setup) -> dict[str, object]:
    scenario = {
        "name": setup.name.lower(),
        "action": "BUY_IF_CONFIRMED" if setup.entry_type in {"breakout", "pullback", "support_bounce"} else "AVOID_OR_EXIT",
        "entry_zone": list(setup.entry_zone) if setup.entry_zone else None,
        "trigger": setup.trigger,
        "confirmation_timeframe": setup.confirmation_timeframe,
        "entry_type": setup.entry_type,
        "max_chase_price": round(setup.entry_zone[1] * 1.02, 2) if setup.entry_zone else None,
        "stop": setup.stop,
        "targets": setup.targets,
        "confidence": setup.confidence,
        "risk_score": setup.risk_score,
        "required_conditions": setup.required_conditions,
        "strengthening_conditions": setup.strengthening_conditions,
        "invalidation_conditions": setup.invalidation_conditions,
    }
    return {k: v for k, v in scenario.items() if v is not None}


def build_entry_scenarios(setups: list[Setup], support: float | None) -> list[dict[str, object]]:
    scenarios = [scenario_from_setup(s) for s in setups if s.name != "NO_TRADE" and (s.entry_zone or s.valid)]
    if support:
        scenarios.append({
            "name": "breakdown",
            "action": "AVOID_OR_EXIT",
            "trigger": f"Daily close below {support:.2f}",
            "reason": "Bullish structure invalidated",
        })
    return scenarios
