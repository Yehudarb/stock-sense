from __future__ import annotations

import os
from datetime import date, datetime, timezone

from stock_analysis_pro.models import Bar, Quote

from .base import MarketDataProvider, ProviderError
from .http import cached_json


class PolygonProvider(MarketDataProvider):
    name = "polygon"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("POLYGON_API_KEY")

    def _require_key(self) -> str:
        if not self.api_key:
            raise ProviderError("POLYGON_API_KEY is not configured")
        return self.api_key

    def get_quote(self, symbol: str) -> Quote:
        key = self._require_key()
        url = f"https://api.polygon.io/v2/last/trade/{symbol.upper()}?apiKey={key}"
        data = cached_json(url, ttl_seconds=30)
        trade = data.get("results") or {}
        price = trade.get("p")
        ts = trade.get("t")
        if price is None or ts is None:
            raise ProviderError(f"Polygon quote missing price/timestamp for {symbol}")
        timestamp = datetime.fromtimestamp(int(ts) / 1_000_000_000, tz=timezone.utc)
        return Quote(symbol=symbol.upper(), price=float(price), timestamp=timestamp, provider=self.name, is_delayed=False)

    def get_bars(self, symbol: str, timeframe: str, start: date, end: date) -> list[Bar]:
        key = self._require_key()
        multiplier, span = _polygon_timespan(timeframe)
        url = (
            f"https://api.polygon.io/v2/aggs/ticker/{symbol.upper()}/range/"
            f"{multiplier}/{span}/{start.isoformat()}/{end.isoformat()}?adjusted=true&sort=asc&limit=50000&apiKey={key}"
        )
        data = cached_json(url, ttl_seconds=180)
        rows = data.get("results") or []
        return [
            Bar(
                timestamp=datetime.fromtimestamp(row["t"] / 1000, tz=timezone.utc),
                open=float(row["o"]),
                high=float(row["h"]),
                low=float(row["l"]),
                close=float(row["c"]),
                volume=float(row.get("v") or 0),
            )
            for row in rows
        ]


def _polygon_timespan(timeframe: str) -> tuple[int, str]:
    return {
        "5m": (5, "minute"),
        "15m": (15, "minute"),
        "1h": (1, "hour"),
        "4h": (4, "hour"),
        "1d": (1, "day"),
        "1wk": (1, "week"),
        "1mo": (1, "month"),
    }.get(timeframe, (1, "day"))
