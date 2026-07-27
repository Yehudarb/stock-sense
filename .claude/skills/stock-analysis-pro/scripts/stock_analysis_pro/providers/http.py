from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base import ProviderError, RateLimitError

LOG = logging.getLogger(__name__)
CACHE_DIR = Path(".cache/stock_analysis_pro")


def cached_json(url: str, *, headers: dict[str, str] | None = None, ttl_seconds: int = 300, retries: int = 3) -> Any:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = "".join(ch if ch.isalnum() else "_" for ch in url)[:180]
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists() and time.time() - cache_file.stat().st_mtime < ttl_seconds:
        return json.loads(cache_file.read_text(encoding="utf-8"))

    delay = 0.5
    request = Request(url, headers=headers or {"User-Agent": "stock-analysis-pro/1.0"})
    for attempt in range(retries):
        try:
            with urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            cache_file.write_text(json.dumps(payload), encoding="utf-8")
            return payload
        except HTTPError as exc:
            if exc.code == 429:
                raise RateLimitError(f"Rate limited fetching {url}") from exc
            last = exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
        LOG.warning("Provider request failed attempt=%s url=%s error=%s", attempt + 1, url, last)
        time.sleep(delay)
        delay *= 2
    raise ProviderError(f"Failed fetching {url}: {last}") from last
