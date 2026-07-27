from __future__ import annotations

from datetime import date, datetime, timezone

from stock_analysis_pro.models import Bar, Quote

from .base import MarketDataProvider, ProviderError
from .http import cached_json


INTERVALS = {
    "1d": "1d",
    "1wk": "1wk",
    "1mo": "1mo",
    "1h": "60m",
    "4h": "60m",
    "15m": "15m",
    "5m": "5m",
}


class YahooProvider(MarketDataProvider):
    name = "yahoo"

    def get_quote(self, symbol: str) -> Quote:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5d&interval=1d"
        data = cached_json(url, ttl_seconds=120)
        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            raise ProviderError(f"Yahoo returned no quote for {symbol}")
        meta = result.get("meta", {})
        price = meta.get("regularMarketPrice") or meta.get("previousClose")
        timestamp = meta.get("regularMarketTime") or max(result.get("timestamp") or [0])
        if price is None or not timestamp:
            raise ProviderError(f"Yahoo quote missing price/timestamp for {symbol}")
        return Quote(
            symbol=symbol.upper(),
            price=float(price),
            timestamp=datetime.fromtimestamp(int(timestamp), tz=timezone.utc),
            bid=meta.get("bid"),
            ask=meta.get("ask"),
            provider=self.name,
            is_delayed=True,
        )

    def get_bars(self, symbol: str, timeframe: str, start: date, end: date) -> list[Bar]:
        interval = INTERVALS.get(timeframe, timeframe)
        range_value = {
            "5m": "30d",
            "15m": "60d",
            "1h": "730d",
            "4h": "730d",
            "1d": "2y",
            "1wk": "5y",
            "1mo": "10y",
        }.get(timeframe, "2y")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range_value}&interval={interval}"
        data = cached_json(url, ttl_seconds=300)
        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            raise ProviderError(f"Yahoo returned no bars for {symbol}")
        timestamps = result.get("timestamp") or []
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        bars: list[Bar] = []
        for i, ts in enumerate(timestamps):
            values = {k: (quote.get(k) or [None] * len(timestamps))[i] for k in ["open", "high", "low", "close", "volume"]}
            if any(values[k] is None for k in ["open", "high", "low", "close"]):
                continue
            bars.append(Bar(
                timestamp=datetime.fromtimestamp(int(ts), tz=timezone.utc),
                open=float(values["open"]),
                high=float(values["high"]),
                low=float(values["low"]),
                close=float(values["close"]),
                volume=float(values["volume"] or 0),
            ))
        if timeframe == "4h" and bars:
            bars = _resample_hourly_to_4h(bars)
        return bars


def _resample_hourly_to_4h(bars: list[Bar]) -> list[Bar]:
    out: list[Bar] = []
    bucket: list[Bar] = []
    for bar in bars:
        bucket.append(bar)
        if len(bucket) == 4:
            out.append(Bar(bucket[-1].timestamp, bucket[0].open, max(b.high for b in bucket), min(b.low for b in bucket), bucket[-1].close, sum(b.volume for b in bucket)))
            bucket = []
    return out
