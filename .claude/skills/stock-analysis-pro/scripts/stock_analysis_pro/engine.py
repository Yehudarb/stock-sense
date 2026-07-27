from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from stock_analysis_pro.analysis.data_quality import validate_data
from stock_analysis_pro.analysis.fundamentals import analyze_fundamentals
from stock_analysis_pro.analysis.market_regime import detect_market_regime
from stock_analysis_pro.analysis.multi_timeframe import TIMEFRAMES, analyze_timeframes
from stock_analysis_pro.analysis.news import analyze_news
from stock_analysis_pro.decision_engine.decision import make_decision
from stock_analysis_pro.models import AnalysisInput, ProviderResult
from stock_analysis_pro.providers import MarketDataProvider, PolygonProvider, ProviderError, YahooProvider
from stock_analysis_pro.risk.leveraged_etf import leveraged_profile
from stock_analysis_pro.setups.registry import detect_all_setups

LOG = logging.getLogger(__name__)


def analyze(request: AnalysisInput, providers: list[MarketDataProvider] | None = None) -> dict[str, Any]:
    providers = providers or [PolygonProvider(), YahooProvider()]
    result, backup_quote = _load_symbol_data(request.symbol, request.trading_style, providers)
    daily = result.bars.get("1d") or next(iter(result.bars.values()), [])
    technicals = analyze_timeframes(result.bars, request.trading_style)
    primary_tf = "1h" if request.trading_style in {"day_trade", "swing"} and result.bars.get("1h") else "1d"
    primary_technical = technicals["frames"].get(primary_tf) or technicals["frames"].get("1d") or {"available": False}
    data_quality = validate_data(
        primary_provider=result.provider,
        backup_provider=backup_quote.provider if backup_quote else None,
        quote=result.quote,
        backup_quote=backup_quote,
        bars=daily,
    )
    financials = analyze_fundamentals(result.financials)
    news = analyze_news(result.news, result.events)
    market_regime = _load_market_regime(providers)
    leveraged = leveraged_profile(request.symbol)
    confirmation_tf = "1H" if request.trading_style in {"day_trade", "swing"} else "Daily"
    setups = detect_all_setups(primary_technical, confirmation_tf, request.target_gain_percent.min, request.target_gain_percent.max, news)
    output = make_decision(
        request=request,
        technical={**primary_technical, "multi_timeframe": technicals},
        market_regime=market_regime,
        fundamentals=financials,
        news=news,
        data_quality=data_quality,
        setups=setups,
        leveraged=leveraged,
    )
    _persist_analysis(output)
    return output


def _load_symbol_data(symbol: str, style: str, providers: list[MarketDataProvider]) -> tuple[ProviderResult, Any]:
    start = date.today() - timedelta(days=730)
    end = date.today()
    wanted = TIMEFRAMES.get(style, TIMEFRAMES["swing"])
    errors: list[str] = []
    backup_quote = None
    for provider in providers:
        try:
            quote = provider.get_quote(symbol)
            bars = {tf: provider.get_bars(symbol, tf, start, end) for tf in wanted}
            if "1d" not in bars:
                bars["1d"] = provider.get_bars(symbol, "1d", start, end)
            for backup in providers:
                if backup.name != provider.name:
                    try:
                        backup_quote = backup.get_quote(symbol)
                        break
                    except Exception:
                        pass
            return ProviderResult(provider.name, quote, bars, provider.get_company_financials(symbol), provider.get_news(symbol), provider.get_corporate_events(symbol)), backup_quote
        except Exception as exc:
            errors.append(f"{provider.name}: {exc}")
            LOG.warning("Provider failed provider=%s symbol=%s error=%s", provider.name, symbol, exc)
    raise ProviderError("; ".join(errors))


def _load_market_regime(providers: list[MarketDataProvider]) -> dict[str, Any]:
    provider = next((p for p in providers if p.name == "yahoo"), providers[-1])
    start = date.today() - timedelta(days=365)
    end = date.today()
    bars = {}
    for symbol in ["SPY", "QQQ", "IWM"]:
        try:
            bars[symbol] = provider.get_bars(symbol, "1d", start, end)
        except Exception as exc:
            LOG.info("Market regime fetch failed symbol=%s error=%s", symbol, exc)
    return detect_market_regime(bars)


def _persist_analysis(output: dict[str, Any]) -> None:
    try:
        from pathlib import Path
        import json
        path = Path("stock_analysis_history.jsonl")
        snapshot = {
            "symbol": output.get("symbol"),
            "timestamp": output.get("analysis_timestamp"),
            "decision": output.get("current_action"),
            "reason_codes": output.get("reason_codes"),
            "model_version": output.get("model_version"),
            "strategy_version": output.get("strategy_version"),
            "provider": output.get("data_quality", {}).get("primary_provider"),
            "entry_plan": output.get("entry_plan"),
            "stop": output.get("stop_loss"),
            "targets": output.get("targets"),
            "outcome": None,
        }
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(snapshot) + "\n")
    except Exception as exc:
        LOG.warning("Failed persisting analysis history: %s", exc)
