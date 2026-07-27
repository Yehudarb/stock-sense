from __future__ import annotations

from typing import Any

from .http import cached_json


class SECProvider:
    name = "sec_edgar"

    def get_company_facts_by_cik(self, cik: str) -> dict[str, Any]:
        normalized = str(cik).zfill(10)
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{normalized}.json"
        return cached_json(url, headers={"User-Agent": "stock-analysis-pro contact@example.com"}, ttl_seconds=86_400)
