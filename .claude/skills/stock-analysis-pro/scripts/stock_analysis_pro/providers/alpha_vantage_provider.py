from __future__ import annotations

import os
from datetime import date

from stock_analysis_pro.models import Bar, Quote

from .base import MarketDataProvider, ProviderError
from .http import cached_json


class AlphaVantageProvider(MarketDataProvider):
    name = "alpha_vantage"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("ALPHA_VANTAGE_API_KEY")

    def _require_key(self) -> str:
        if not self.api_key:
            raise ProviderError("ALPHA_VANTAGE_API_KEY is not configured")
        return self.api_key

    def get_quote(self, symbol: str) -> Quote:
        raise ProviderError("Alpha Vantage quote provider is not enabled in offline-safe CLI mode")

    def get_bars(self, symbol: str, timeframe: str, start: date, end: date) -> list[Bar]:
        raise ProviderError("Alpha Vantage bars fallback is reserved for API-key deployments")
