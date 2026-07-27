from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(__file__).resolve().parent / ".claude" / "skills" / "stock-analysis-pro" / "scripts"
if str(SKILL_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPTS))

from stock_analysis_pro import analyze
from stock_analysis_pro.models import AnalysisInput, TargetGain


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stock Analysis Pro decision-support CLI")
    sub = parser.add_subparsers(dest="command", required=True)
    analyze_parser = sub.add_parser("analyze", help="Analyze a symbol")
    analyze_parser.add_argument("symbol")
    analyze_parser.add_argument("--style", default="swing", choices=["day_trade", "swing", "position_trade", "long_term"])
    analyze_parser.add_argument("--holding-period", default="1-3 months")
    analyze_parser.add_argument("--account-size", type=float, default=25_000)
    analyze_parser.add_argument("--risk-percent", type=float, default=1.0)
    analyze_parser.add_argument("--target-min", type=float, default=5.0)
    analyze_parser.add_argument("--target-max", type=float, default=12.0)
    analyze_parser.add_argument("--has-position", action="store_true")
    analyze_parser.add_argument("--average-entry-price", type=float)
    analyze_parser.add_argument("--shares", type=int)
    analyze_parser.add_argument("--current-stop", type=float)
    analyze_parser.add_argument("--allow-event-risk", action="store_true")
    analyze_parser.add_argument("--json-only", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if args.command == "analyze":
        request = AnalysisInput(
            symbol=args.symbol,
            trading_style=args.style,
            holding_period=args.holding_period,
            account_size=args.account_size,
            risk_per_trade_percent=args.risk_percent,
            target_gain_percent=TargetGain(args.target_min, args.target_max),
            has_position=args.has_position,
            average_entry_price=args.average_entry_price,
            shares=args.shares,
            current_stop=args.current_stop,
            allow_event_risk=args.allow_event_risk,
        )
        output = analyze(request)
        if not args.json_only:
            print(output["human_response_he"])
            print("\nJSON:")
        print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
