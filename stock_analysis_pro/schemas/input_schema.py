from __future__ import annotations

from stock_analysis_pro.models import AnalysisInput, TargetGain


def make_input(**kwargs) -> AnalysisInput:
    target = kwargs.pop("target_gain_percent", None)
    if isinstance(target, dict):
        kwargs["target_gain_percent"] = TargetGain(**target)
    return AnalysisInput(**kwargs)
