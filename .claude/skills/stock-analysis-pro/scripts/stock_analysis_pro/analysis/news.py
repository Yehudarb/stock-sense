from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def analyze_news(news: list[dict[str, Any]], events: list[dict[str, Any]]) -> dict[str, object]:
    parsed = [_normalize_event(item) for item in [*news, *events]]
    high_impact = [item for item in parsed if item["impact"] == "high"]
    earnings_soon = any(item["event_type"] == "earnings" and _days_until(item["published_at"]) is not None and abs(_days_until(item["published_at"])) <= 7 for item in parsed)
    return {
        "events": parsed,
        "high_impact_events": high_impact,
        "earnings_soon": earnings_soon,
        "status": "available" if parsed else "unavailable",
    }


def _normalize_event(item: dict[str, Any]) -> dict[str, Any]:
    headline = str(item.get("headline") or item.get("title") or "")
    lowered = headline.lower()
    event_type = "earnings" if "earnings" in lowered else "offering" if "offering" in lowered else "analyst" if "analyst" in lowered or "rating" in lowered else "news"
    impact = "high" if event_type in {"earnings", "offering"} else "medium" if event_type == "analyst" else "low"
    return {
        "headline": headline,
        "source": item.get("source") or "unknown",
        "published_at": item.get("published_at") or item.get("datetime") or datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "sentiment": item.get("sentiment") or "neutral",
        "impact": impact,
        "is_confirmed": item.get("is_confirmed", item.get("source_type") in {"company", "sec"}),
        "source_type": item.get("source_type", "media"),
    }


def _days_until(value: object) -> int | None:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return int((dt - datetime.now(timezone.utc)).total_seconds() / 86_400)
