from __future__ import annotations

from .conditions import condition_met


def evaluate_alerts(alerts: list[dict[str, object]], snapshot: dict[str, float | bool]) -> list[dict[str, object]]:
    fired = []
    for alert in alerts:
        conditions = list(alert.get("conditions", []))
        if conditions and all(condition_met(str(condition), snapshot) for condition in conditions):
            fired.append(alert)
    return fired
