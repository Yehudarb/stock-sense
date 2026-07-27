from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from stock_analysis_pro.models import Action, AnalysisInput
from stock_analysis_pro.risk.position_size import calculate_position_size, risk_reward
from stock_analysis_pro.risk.targets import build_targets, stop_management
from stock_analysis_pro.setups.base import Setup

from .rules import automatic_blocks, decide_action
from .scenarios import build_entry_scenarios
from .scoring import score_trade


def make_decision(
    *,
    request: AnalysisInput,
    technical: dict[str, Any],
    market_regime: dict[str, Any],
    fundamentals: dict[str, Any],
    news: dict[str, Any],
    data_quality: dict[str, Any],
    setups: list[Setup],
    leveraged: dict[str, Any],
) -> dict[str, Any]:
    viable = [s for s in setups if s.valid and s.entry_zone and s.stop]
    setup = viable[0] if viable else next((s for s in setups if s.entry_zone and s.stop), None)
    score = score_trade(setup=setup, technical=technical, market_regime=market_regime, fundamentals=fundamentals, news=news, style=request.trading_style)
    blocks = automatic_blocks(request=request, data_quality=data_quality, technical=technical, news=news, setup=setup)
    if leveraged.get("is_leveraged_etf"):
        blocks.append("LEVERAGED_ETF_RISK_REDUCED")
    action = decide_action(request=request, blocks=blocks, setup=setup, score=int(score["trade_score"]), technical=technical)

    entry_zone = list(setup.entry_zone) if setup and setup.entry_zone else None
    stop_price = setup.stop if setup else None
    targets = [{"price": p, "action": a} for p, a in zip((setup.targets if setup else []), ["sell_30_percent", "sell_40_percent", "trail_remaining_position"])]
    if setup and setup.entry_zone and stop_price and not targets:
        targets = build_targets(setup.entry_zone[0], stop_price, request.target_gain_percent.min, request.target_gain_percent.max)
    risk_percent = request.risk_per_trade_percent * (float(leveraged.get("recommended_risk_multiplier", 1)) if leveraged.get("is_leveraged_etf") else 1)
    sizing = calculate_position_size(
        account_size=request.account_size,
        risk_percent=risk_percent,
        entry_price=entry_zone[0] if entry_zone else float(technical["price"]),
        stop_price=stop_price or float(technical["price"]),
    ) if stop_price else {"error": "NO_STOP_AVAILABLE", "shares": 0}
    rr = risk_reward(entry_zone[0], stop_price, targets[0]["price"]) if entry_zone and stop_price and targets else None
    position = _position_state(request, float(technical["price"]), stop_price, targets)

    decision_summary = _summary(action, blocks, setup)
    return {
        "symbol": request.symbol.upper(),
        "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        "market_status": data_quality.get("market_status", "unknown"),
        "trading_style": request.trading_style,
        "current_price": technical.get("price"),
        "current_action": action.value,
        "decision_summary": decision_summary,
        **score,
        "risk_reward": rr,
        "market_regime": market_regime,
        "technical_analysis": technical,
        "fundamental_analysis": fundamentals,
        "news_analysis": news,
        "entry_scenarios": build_entry_scenarios(setups, technical.get("support")),
        "entry_plan": {
            "entry_zone": entry_zone,
            "trigger": setup.trigger if setup else None,
            "confirmation_timeframe": setup.confirmation_timeframe if setup else None,
            "entry_type": setup.entry_type if setup else None,
            "max_chase_price": round(entry_zone[1] * 1.02, 2) if entry_zone else None,
        },
        "stop_loss": {
            "price": stop_price,
            "type": "structure_and_atr" if stop_price else "unavailable",
            "distance_percent": round((entry_zone[0] - stop_price) / entry_zone[0] * 100, 2) if entry_zone and stop_price else None,
            "reason": "Below structure support and ATR invalidation" if stop_price else "No clear invalidation point",
            "hard_stop": True,
        },
        "stop_management": stop_management(entry_zone[0], stop_price, targets) if entry_zone and stop_price and targets else {},
        "targets": targets,
        "position_sizing": sizing,
        "position_analysis": position,
        "invalidation_conditions": setup.invalidation_conditions if setup else ["No valid setup"],
        "reason_codes": sorted(set([*blocks, *(setup.reason_codes if setup else [])])),
        "warnings": [*data_quality.get("warnings", []), *leveraged.get("warnings", [])],
        "data_quality": data_quality,
        "next_review_conditions": ["After daily close", "After material news", "After breakout or breakdown", "Before earnings or high-impact events"],
        "alerts": _alerts(setup, targets, stop_price),
        "model_version": "stock-analysis-pro-python-1.0",
        "strategy_version": "decision-engine-1.0",
        "human_response_he": _human_response(action, setup, stop_price, targets, blocks, request.has_position),
        "safety_note": "Decision-support only. This does not guarantee profit and does not execute trades.",
    }


def _position_state(request: AnalysisInput, price: float, stop: float | None, targets: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not request.has_position or not request.average_entry_price or not request.shares:
        return None
    pnl = (price - request.average_entry_price) * request.shares
    pnl_pct = (price - request.average_entry_price) / request.average_entry_price * 100
    return {
        "average_entry_price": request.average_entry_price,
        "shares": request.shares,
        "current_stop": request.current_stop,
        "unrealized_pnl": round(pnl, 2),
        "unrealized_pnl_percent": round(pnl_pct, 2),
        "average_down_allowed": False,
        "add_only_if_confirmed": "Only after breakout confirmation and only if total risk remains within plan",
        "stop_action": "raise_stop" if stop and request.current_stop and stop > request.current_stop else "keep_or_review",
        "partial_profit": targets[0] if targets and price >= targets[0]["price"] else None,
    }


def _summary(action: Action, blocks: list[str], setup: Setup | None) -> str:
    if action == Action.INSUFFICIENT_DATA:
        return "Do not enter. Data quality is insufficient for an execution decision."
    if action == Action.BUY_NOW:
        return "Entry is allowed only because breakout conditions are currently confirmed."
    if action == Action.WAIT_FOR_PULLBACK:
        return "Do not chase. Wait for a pullback into the defined entry zone."
    if action == Action.HOLD:
        return "Hold while price remains above the invalidation level."
    if action == Action.EXIT_POSITION:
        return "Exit because the stop or invalidation condition has been reached."
    if blocks:
        return "Do not enter yet. Wait for confirmation and risk/reward improvement."
    return f"Wait for {setup.name.lower() if setup else 'a valid setup'} confirmation."


def _human_response(action: Action, setup: Setup | None, stop: float | None, targets: list[dict[str, Any]], blocks: list[str], has_position: bool) -> str:
    entry = f"{setup.entry_zone[0]:.2f}-{setup.entry_zone[1]:.2f} דולר" if setup and setup.entry_zone else "אין אזור כניסה תקף"
    target_text = " / ".join(f"{t['price']:.2f}" for t in targets) if targets else "אין יעדים תקפים"
    trigger = setup.trigger if setup else "נדרש setup ברור לפני פעולה"
    stop_text = f"{stop:.2f} דולר" if stop else "אין סטופ תקף"
    holder = "להחזיק רק מעל רמת הביטול, לא לבצע Average Down, ולממש חלקית ביעד הראשון אם המחיר מגיע אליו." if has_position else "אם כבר מחזיקים: להחזיק רק מעל התמיכה, לממש חלקית ביעד הראשון ולהעלות סטופ לאחר אישור."
    why = " / ".join(blocks[:3]) if blocks else "התנאים המרכזיים מוגדרים ומחושבים, אך עדיין תלויים באישור הטריגר."
    return (
        f"החלטה כרגע:\n{_he_action(action)}\n\n"
        f"למה:\n{why}\n\n"
        f"כניסה אפשרית:\n{entry}\n\n"
        f"תנאי כניסה:\n{trigger}\n\n"
        f"סטופ:\n{stop_text}\n\n"
        f"יעדים:\n{target_text}\n\n"
        f"ביטול תרחיש:\n{setup.invalidation_conditions[0] if setup and setup.invalidation_conditions else 'אין נקודת ביטול ברורה'}\n\n"
        f"מה לעשות אם כבר מחזיקים:\n{holder}\n\n"
        "הערת בטיחות: זה כלי תמיכה בהחלטות בלבד, לא הבטחת רווח ולא ביצוע מסחר אוטומטי."
    )


def _he_action(action: Action) -> str:
    return {
        Action.BUY_NOW: "אפשר להיכנס עכשיו רק לפי גודל הפוזיציה והסטופ המחושבים.",
        Action.WAIT_FOR_BREAKOUT: "להמתין לפריצה. אין כניסה במחיר הנוכחי.",
        Action.WAIT_FOR_PULLBACK: "להמתין לתיקון לאזור הכניסה. לא לרדוף אחרי המחיר.",
        Action.HOLD: "להחזיק כל עוד רמת הביטול נשמרת.",
        Action.ADD_ONLY_IF_CONFIRMED: "להוסיף רק אם מתקבל אישור מלא.",
        Action.TAKE_PARTIAL_PROFIT: "לממש חלקית לפי יעד הרווח הראשון.",
        Action.MOVE_STOP: "להזיז סטופ לפי המבנה החדש.",
        Action.EXIT_POSITION: "לצאת מהפוזיציה.",
        Action.AVOID: "להימנע מעסקה חדשה כרגע.",
        Action.INSUFFICIENT_DATA: "אין מספיק נתונים להחלטת כניסה.",
    }[action]


def _alerts(setup: Setup | None, targets: list[dict[str, Any]], stop: float | None) -> list[dict[str, object]]:
    alerts = []
    if setup and setup.entry_zone:
        alerts.append({"alert_type": "ENTRY_CONFIRMED", "conditions": [f"price_above_{setup.entry_zone[0]:.2f}", f"{setup.confirmation_timeframe}_candle_closed", "relative_volume_above_1.4"]})
    if stop:
        alerts.append({"alert_type": "STOP_HIT", "conditions": [f"price_below_{stop:.2f}", "candle_closed_or_hard_stop_triggered"]})
    for i, target in enumerate(targets[:2], start=1):
        alerts.append({"alert_type": f"TP{i}_HIT", "conditions": [f"price_above_{target['price']:.2f}"]})
    return alerts
