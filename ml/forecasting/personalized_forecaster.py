from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Iterable, List, Optional, Tuple

ALLOWED_HORIZONS = {1, 3, 6}


@dataclass
class MonthlyPoint:
    year: int
    month: int
    expense_total: float
    income_total_from_transactions: float
    effective_income: float
    savings: float
    savings_rate: float
    transaction_count: int
    expense_count: int
    income_count: int
    transfer_total: float
    used_profile_income_fallback: bool
    has_observed_activity: bool


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        numeric = float(value)
        if numeric != numeric:
            return default
        return numeric
    except Exception:
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        numeric = int(value)
        return numeric
    except Exception:
        return default


def _normalize_monthly_series(raw_rows: Iterable[Dict[str, Any]]) -> List[MonthlyPoint]:
    rows: List[MonthlyPoint] = []
    for row in raw_rows or []:
        year = _to_int(row.get("year"))
        month = _to_int(row.get("month"))
        if year < 2000 or month < 1 or month > 12:
            continue

        rows.append(
            MonthlyPoint(
                year=year,
                month=month,
                expense_total=round(max(0.0, _to_float(row.get("expense_total"))), 2),
                income_total_from_transactions=round(max(0.0, _to_float(row.get("income_total_from_transactions"))), 2),
                effective_income=round(max(0.0, _to_float(row.get("effective_income"))), 2),
                savings=round(_to_float(row.get("savings")), 2),
                savings_rate=round(_to_float(row.get("savings_rate")), 2),
                transaction_count=max(0, _to_int(row.get("transaction_count"))),
                expense_count=max(0, _to_int(row.get("expense_count"))),
                income_count=max(0, _to_int(row.get("income_count"))),
                transfer_total=round(max(0.0, _to_float(row.get("transfer_total"))), 2),
                used_profile_income_fallback=bool(row.get("used_profile_income_fallback")),
                has_observed_activity=bool(row.get("has_observed_activity")),
            )
        )

    rows.sort(key=lambda item: (item.year, item.month))
    return rows


def _advance_month(year: int, month: int, step: int = 1) -> Tuple[int, int]:
    next_month_idx = (year * 12 + (month - 1)) + step
    next_year = next_month_idx // 12
    next_month = (next_month_idx % 12) + 1
    return next_year, next_month


def _weighted_average(values: List[float], weights: List[float]) -> float:
    if not values:
        return 0.0
    if len(values) != len(weights):
        weights = [1.0] * len(values)
    denominator = sum(weights)
    if denominator <= 0:
        return float(sum(values) / len(values))
    return float(sum(v * w for v, w in zip(values, weights)) / denominator)


def _compute_trend(values: List[float]) -> float:
    if len(values) < 3:
        return 0.0
    recent = values[-1]
    older = values[0]
    if older <= 0:
        return 0.0
    growth = (recent - older) / older
    # damp trend to stay stable on noisy user-level histories
    return max(-0.2, min(0.2, growth / max(1, len(values) - 1)))


def _project_series(
    observed: List[float],
    horizon: int,
    profile_income: float,
    is_income_track: bool,
    sparse_mode: str,
) -> List[float]:
    if horizon <= 0:
        return []

    if not observed:
        if is_income_track:
            baseline = max(0.0, profile_income)
        else:
            baseline = max(0.0, profile_income * 0.75)
        return [round(baseline, 2) for _ in range(horizon)]

    if sparse_mode == "one_or_two_months":
        baseline = _weighted_average(observed[-2:], [0.65, 0.35][: len(observed[-2:])])
        return [round(max(0.0, baseline), 2) for _ in range(horizon)]

    window = observed[-6:] if len(observed) >= 6 else observed
    weights = [float(index + 1) for index in range(len(window))]
    baseline = _weighted_average(window, weights)
    trend = _compute_trend(window)

    projections: List[float] = []
    for idx in range(1, horizon + 1):
        trended = baseline * (1.0 + trend * idx)
        projections.append(round(max(0.0, trended), 2))
    return projections


def _determine_fallback_mode(observed_months: int) -> str:
    if observed_months <= 0:
        return "no_history_profile_default"
    if observed_months <= 2:
        return "one_or_two_months"
    if observed_months <= 5:
        return "limited_history_weighted"
    return "none"


def _determine_confidence(observed_months: int, quality_flags: List[str]) -> str:
    if observed_months <= 2:
        return "low"
    if "pending_heavy_dataset" in quality_flags:
        return "low"
    if observed_months <= 5:
        return "medium"
    return "high"


def build_personalized_forecast(
    *,
    user_id: int,
    history_payload: Dict[str, Any],
    horizon_months: int,
) -> Dict[str, Any]:
    if horizon_months not in ALLOWED_HORIZONS:
        raise ValueError(f"horizon_months must be one of {sorted(ALLOWED_HORIZONS)}")

    monthly_series = _normalize_monthly_series(history_payload.get("monthly_series", []))
    profile_income = max(0.0, _to_float(history_payload.get("profile_monthly_income"), 0.0))

    observed_rows = [row for row in monthly_series if row.has_observed_activity]
    observed_expense = [row.expense_total for row in observed_rows]
    observed_income = [row.effective_income for row in observed_rows]

    fallback_mode = _determine_fallback_mode(len(observed_rows))
    quality_flags = list(history_payload.get("history", {}).get("quality_flags", []) or [])
    confidence_level = _determine_confidence(len(observed_rows), quality_flags)

    expense_projections = _project_series(
        observed=observed_expense,
        horizon=horizon_months,
        profile_income=profile_income,
        is_income_track=False,
        sparse_mode=fallback_mode,
    )

    income_projections = _project_series(
        observed=observed_income,
        horizon=horizon_months,
        profile_income=profile_income,
        is_income_track=True,
        sparse_mode=fallback_mode,
    )

    anchor_year: int
    anchor_month: int
    if monthly_series:
        anchor_year, anchor_month = monthly_series[-1].year, monthly_series[-1].month
    else:
        today = date.today()
        anchor_year, anchor_month = today.year, today.month

    projections: List[Dict[str, Any]] = []
    for idx in range(horizon_months):
        year, month = _advance_month(anchor_year, anchor_month, idx + 1)
        expense = round(max(0.0, expense_projections[idx]), 2)
        income = round(max(0.0, income_projections[idx]), 2)
        savings = round(income - expense, 2)
        savings_rate = round((savings / income) * 100, 2) if income > 0 else 0.0
        projections.append(
            {
                "year": year,
                "month": month,
                "predicted_total_expenses": expense,
                "predicted_total_income": income,
                "predicted_total_savings": savings,
                "savings_rate": savings_rate,
            }
        )

    top_projection = projections[0] if projections else {
        "year": _advance_month(anchor_year, anchor_month, 1)[0],
        "month": _advance_month(anchor_year, anchor_month, 1)[1],
        "predicted_total_expenses": 0.0,
        "predicted_total_income": 0.0,
        "predicted_total_savings": 0.0,
        "savings_rate": 0.0,
    }

    months_with_income_fallback = history_payload.get("history", {}).get("months_with_profile_income_fallback", [])

    method_variant = "personalized_weighted_trend"
    if fallback_mode == "one_or_two_months":
        method_variant = "personalized_sparse_weighted_average"
    if fallback_mode == "no_history_profile_default":
        method_variant = "profile_income_default"

    category_totals = list(history_payload.get("category_totals", []) or [])
    category_outlook = [
        {
            "category": item.get("category"),
            "predicted_monthly_spend": round(max(0.0, _to_float(item.get("total"), 0.0) / max(1, len(observed_rows))), 2),
        }
        for item in category_totals[:5]
        if isinstance(item, dict) and item.get("category")
    ]

    return {
        # backward-compatible top-level fields
        "user_id": int(user_id),
        "month": int(top_projection["month"]),
        "year": int(top_projection["year"]),
        "predicted_total_expenses": float(top_projection["predicted_total_expenses"]),
        "predicted_total_savings": float(top_projection["predicted_total_savings"]),
        "savings_rate": float(top_projection["savings_rate"]),
        "method": method_variant,
        "based_on_records": int(sum(row.transaction_count for row in observed_rows)),

        # enriched payload
        "horizon_months": int(horizon_months),
        "projections": projections,
        "reliability": {
            "history_months_available": int(len(observed_rows)),
            "history_months_used": int(min(len(observed_rows), 6)),
            "used_profile_income_fallback": bool(len(months_with_income_fallback) > 0),
            "fallback_mode": fallback_mode,
            "confidence_level": confidence_level,
            "quality_flags": quality_flags,
        },
        "category_outlook": category_outlook,
    }
