from __future__ import annotations


LEVERAGED_ETFS = {
    "TSLL": {"leverage": 2, "underlying": "TSLA"},
    "TQQQ": {"leverage": 3, "underlying": "QQQ"},
    "SOXL": {"leverage": 3, "underlying": "SOXX"},
    "LABU": {"leverage": 3, "underlying": "XBI"},
    "NVDL": {"leverage": 2, "underlying": "NVDA"},
}


def leveraged_profile(symbol: str) -> dict[str, object]:
    item = LEVERAGED_ETFS.get(symbol.upper())
    if not item:
        return {"is_leveraged_etf": False}
    return {
        "is_leveraged_etf": True,
        **item,
        "recommended_risk_multiplier": 0.5,
        "warnings": [
            "Leveraged ETF detected; reduce risk per trade.",
            "Daily reset and volatility decay make long holding periods risky.",
            "Analyze the underlying asset before acting.",
        ],
    }
