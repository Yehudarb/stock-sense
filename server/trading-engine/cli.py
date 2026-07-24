#!/usr/bin/env python3
"""
CLI Entry Point for Trading Engine
Called by Express route with command-line arguments
Outputs JSON to stdout
"""

import json
import argparse
import sys
from stop_engine import calculate_optimal_levels


def main():
    """Parse CLI arguments and output JSON result"""
    parser = argparse.ArgumentParser(
        description="Calculate ATR-based stop loss and targets"
    )

    parser.add_argument("--entry", type=float, required=True, help="Entry price")
    parser.add_argument("--atr", type=float, required=True, help="Average True Range")
    parser.add_argument(
        "--support", type=float, default=None, help="Support price (optional)"
    )
    parser.add_argument(
        "--volatility", type=float, default=0.05, help="Volatility % (default 5%)"
    )

    args = parser.parse_args()

    try:
        # Calculate stops
        decision = calculate_optimal_levels(
            entry_price=args.entry,
            atr=args.atr,
            support_price=args.support,
            volatility_pct=args.volatility,
        )

        # Convert to dict and output JSON
        result = decision.to_dict()
        print(json.dumps(result))
        sys.exit(0)

    except ValueError as e:
        # Validation error
        error_result = {"error": str(e), "code": "VALIDATION_ERROR"}
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

    except Exception as e:
        # Unexpected error
        error_result = {"error": str(e), "code": "INTERNAL_ERROR"}
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
