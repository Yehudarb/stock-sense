from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


PAPER_FILE = Path("paper_trades.jsonl")


def record_paper_trade(decision: dict[str, object], outcome: dict[str, object] | None = None) -> None:
    row = {"timestamp": datetime.now(timezone.utc).isoformat(), "decision": decision, "outcome": outcome}
    with PAPER_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")
