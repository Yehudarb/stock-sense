from __future__ import annotations

from stock_analysis_pro.models import Action, AnalysisInput
from stock_analysis_pro.risk.position_size import risk_reward
from stock_analysis_pro.setups.base import Setup


def automatic_blocks(
    *,
    request: AnalysisInput,
    data_quality: dict[str, object],
    technical: dict[str, object],
    news: dict[str, object],
    setup: Setup | None,
) -> list[str]:
    blocks: list[str] = []
    if data_quality.get("status") == "invalid":
        blocks.append("DATA_QUALITY_INVALID")
    if "LOW_LIQUIDITY" in data_quality.get("warnings", []):
        blocks.append("LOW_AVERAGE_VOLUME")
    if news.get("earnings_soon") and not request.allow_event_risk:
        blocks.append("EARNINGS_EVENT_RISK_NOT_APPROVED")
    if not setup or not setup.stop:
        blocks.append("NO_CLEAR_INVALIDATION")
    if setup and setup.entry_zone and setup.stop and setup.targets:
        rr = risk_reward(setup.entry_zone[0], setup.stop, setup.targets[0])
        if rr is None or rr < 2:
            blocks.append("RISK_REWARD_BELOW_1_TO_2")
        price = float(technical["price"])
        if setup.entry_zone[1] and price > setup.entry_zone[1] * 1.02:
            blocks.append("CHASE_RISK")
        if setup.stop and ((setup.entry_zone[0] - setup.stop) / setup.entry_zone[0]) > 0.12:
            blocks.append("STOP_TOO_FAR")
    return blocks


def decide_action(*, request: AnalysisInput, blocks: list[str], setup: Setup | None, score: int, technical: dict[str, object]) -> Action:
    if "DATA_QUALITY_INVALID" in blocks:
        return Action.INSUFFICIENT_DATA
    price = float(technical["price"])
    if request.has_position:
        stop = request.current_stop
        if stop and price <= stop:
            return Action.EXIT_POSITION
        if setup and setup.targets and price >= setup.targets[0]:
            return Action.TAKE_PARTIAL_PROFIT
        if stop and setup and setup.stop and setup.stop > stop:
            return Action.MOVE_STOP
        if score >= 70:
            return Action.HOLD
        return Action.AVOID
    if any(code in blocks for code in ["LOW_AVERAGE_VOLUME", "EARNINGS_EVENT_RISK_NOT_APPROVED", "STOP_TOO_FAR", "RISK_REWARD_BELOW_1_TO_2", "NO_CLEAR_INVALIDATION"]):
        return Action.AVOID if setup and setup.name in {"FAILED_BREAKOUT", "BREAKDOWN"} else Action.WAIT_FOR_BREAKOUT
    if setup and setup.name == "BREAKOUT" and setup.valid and score >= 75:
        return Action.BUY_NOW
    if setup and setup.entry_type == "pullback":
        return Action.WAIT_FOR_PULLBACK
    return Action.WAIT_FOR_BREAKOUT
