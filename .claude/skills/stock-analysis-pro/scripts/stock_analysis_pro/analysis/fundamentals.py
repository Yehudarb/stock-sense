from __future__ import annotations


def analyze_fundamentals(financials: dict[str, object]) -> dict[str, object]:
    return {
        "status": "available" if financials else "unavailable",
        "revenue_growth": financials.get("revenue_growth") if financials else None,
        "gross_margin": financials.get("gross_margin") if financials else None,
        "operating_margin": financials.get("operating_margin") if financials else None,
        "net_income": financials.get("net_income") if financials else None,
        "eps": financials.get("eps") if financials else None,
        "free_cash_flow": financials.get("free_cash_flow") if financials else None,
        "cash": financials.get("cash") if financials else None,
        "debt": financials.get("debt") if financials else None,
        "valuation_context": financials.get("valuation_context") if financials else "Not available from configured providers",
        "comparison": financials.get("comparison") if financials else "Unavailable",
    }
