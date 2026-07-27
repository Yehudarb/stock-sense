from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import Any

from stock_analysis_pro.models import Bar, Quote


class ProviderError(RuntimeError):
    pass


class RateLimitError(ProviderError):
    pass


class MarketDataProvider(ABC):
    name: str

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        raise NotImplementedError

    @abstractmethod
    def get_bars(self, symbol: str, timeframe: str, start: date, end: date) -> list[Bar]:
        raise NotImplementedError

    def get_company_financials(self, symbol: str) -> dict[str, Any]:
        return {}

    def get_news(self, symbol: str) -> list[dict[str, Any]]:
        return []

    def get_corporate_events(self, symbol: str) -> list[dict[str, Any]]:
        return []
