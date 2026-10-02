import math
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import yfinance as yf


TICKER_PATTERN = re.compile(r"^[A-Z0-9.\-^]{1,15}$")


STATEMENT_CONFIG: Dict[str, Dict[str, Any]] = {
    "income": {
        "dataframe_attrs": ["income_stmt", "financials"],
        "metrics": [
            ("Revenue", [
                "Total Revenue",
                "Revenue",
                "Revenues",
                "Sales Revenue",
                "Operating Revenue",
            ]),
            ("Gross Profit", [
                "Gross Profit",
            ]),
            ("Operating Income", [
                "Operating Income",
                "Operating Income Loss",
            ]),
            ("Net Income", [
                "Net Income",
                "Net Income Common Stockholders",
                "Net Income Including Noncontrolling Interests",
            ]),
        ],
    },
    "balance": {
        "dataframe_attrs": ["balance_sheet", "balancesheet"],
        "metrics": [
            ("Total Assets", [
                "Total Assets",
            ]),
            ("Total Debt", [
                "Total Debt",
                "Long Term Debt",
                "Long Term Debt And Capital Lease Obligation",
                "Long Term Debt And Capital Lease Obligations",
            ]),
            ("Shareholders Equity", [
                "Stockholders Equity",
                "Total Equity Gross Minority Interest",
                "Total Stockholder Equity",
            ]),
            ("Cash", [
                "Cash And Cash Equivalents",
                "Cash Cash Equivalents And Short Term Investments",
                "Cash And Short Term Investments",
            ]),
        ],
    },
    "cashflow": {
        "dataframe_attrs": ["cashflow"],
        "metrics": [
            ("Operating Cash Flow", [
                "Operating Cash Flow",
                "Net Cash Provided By Operating Activities",
                "Net Cash From Operating Activities",
            ]),
            ("Investing Cash Flow", [
                "Investing Cash Flow",
                "Net Cash Provided By Investing Activities",
                "Net Cash From Investing Activities",
            ]),
            ("Financing Cash Flow", [
                "Financing Cash Flow",
                "Net Cash Provided By Financing Activities",
                "Net Cash From Financing Activities",
            ]),
            ("Net Cash Flow", [
                "Changes In Cash",
                "Cash And Cash Equivalents Changes",
                "Cash Cash Equivalents And Restricted Cash And Restricted Cash Equivalents Period Increase Decrease Including Exchange Rate Effect",
            ]),
        ],
    },
}


def to_trimmed_string(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def normalize_ticker(value: Any) -> str:
    return to_trimmed_string(value).upper()


def assert_ticker(value: Any) -> str:
    ticker = normalize_ticker(value)
    if not ticker or not TICKER_PATTERN.fullmatch(ticker):
        raise ValueError("ticker must be a valid symbol")
    return ticker


def assert_statement(value: Any) -> str:
    statement = to_trimmed_string(value).lower()
    if statement not in STATEMENT_CONFIG:
        raise ValueError("statement must be one of: income, balance, cashflow")
    return statement


def to_number_or_none(value: Any) -> Optional[float]:
    if value is None:
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(numeric):
        return None

    return numeric


def to_rounded_or_none(value: Any, digits: int = 4) -> Optional[float]:
    numeric = to_number_or_none(value)
    if numeric is None:
        return None
    return round(numeric, digits)


def format_compact_number(value: Any) -> Optional[str]:
    numeric = to_number_or_none(value)
    if numeric is None:
        return None

    absolute = abs(numeric)
    if absolute >= 1_000_000_000_000:
        return f"{(numeric / 1_000_000_000_000):.2f}T"
    if absolute >= 1_000_000_000:
        return f"{(numeric / 1_000_000_000):.2f}B"
    if absolute >= 1_000_000:
        return f"{(numeric / 1_000_000):.2f}M"
    if absolute >= 1_000:
        return f"{(numeric / 1_000):.2f}K"

    if numeric.is_integer():
        return str(int(numeric))

    return str(numeric)


def normalize_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", to_trimmed_string(str(value)).lower())


def pick_first_non_empty(data: Dict[str, Any], keys: List[str]) -> Optional[str]:
    for key in keys:
        value = to_trimmed_string(data.get(key))
        if value:
            return value
    return None


def pick_first_numeric(data: Dict[str, Any], keys: List[str]) -> Optional[float]:
    for key in keys:
        numeric = to_number_or_none(data.get(key))
        if numeric is not None:
            return numeric
    return None


def extract_ceo_name(info: Dict[str, Any]) -> Optional[str]:
    direct = pick_first_non_empty(info, ["ceo", "CEO", "companyCEO", "chiefExecutiveOfficer"])
    if direct:
        return direct

    officers = info.get("companyOfficers")
    if not isinstance(officers, list):
        return None

    normalized_officers = []
    for officer in officers:
        if not isinstance(officer, dict):
            continue

        name = to_trimmed_string(officer.get("name"))
        if not name:
            continue

        title = to_trimmed_string(officer.get("title")).lower()
        normalized_officers.append((name, title))

    if not normalized_officers:
        return None

    for name, title in normalized_officers:
        if "ceo" in title or "chief executive" in title:
            return name

    return normalized_officers[0][0]


def normalize_dividend_yield(info: Dict[str, Any]) -> Optional[float]:
    dividend = pick_first_numeric(info, [
        "trailingAnnualDividendYield",
        "dividendYield",
        "yield",
    ])
    if dividend is None:
        return None

    if dividend > 1 and dividend <= 100:
        dividend = dividend / 100

    return to_rounded_or_none(dividend, 6)


def get_info_payload(ticker_obj: Any) -> Dict[str, Any]:
    try:
        if hasattr(ticker_obj, "get_info") and callable(ticker_obj.get_info):
            info = ticker_obj.get_info()
        else:
            info = getattr(ticker_obj, "info", None)
    except Exception:
        return {}

    if not isinstance(info, dict):
        return {}

    return info


def get_profile_enrichment(ticker: str) -> Dict[str, Any]:
    validated_ticker = assert_ticker(ticker)
    ticker_obj = yf.Ticker(validated_ticker)
    info = get_info_payload(ticker_obj)

    symbol = normalize_ticker(info.get("symbol") or validated_ticker)
    company_name = pick_first_non_empty(info, ["longName", "shortName", "displayName", "name"]) or symbol

    return {
        "symbol": symbol,
        "company_name": company_name,
        "sector": pick_first_non_empty(info, ["sector", "industry"]),
        "description": pick_first_non_empty(info, ["longBusinessSummary", "description"]),
        "ceo": extract_ceo_name(info),
        "market_cap": pick_first_numeric(info, ["marketCap"]),
        "pe": to_rounded_or_none(pick_first_numeric(info, ["trailingPE", "forwardPE"]), 4),
        "eps": to_rounded_or_none(pick_first_numeric(info, ["trailingEps", "epsTrailingTwelveMonths"]), 4),
        "dividend_yield": normalize_dividend_yield(info),
    }


def get_statement_dataframe(ticker_obj: Any, statement: str) -> pd.DataFrame:
    config = STATEMENT_CONFIG[statement]

    for attr in config["dataframe_attrs"]:
        try:
            frame = getattr(ticker_obj, attr)
        except Exception:
            continue

        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame.copy()

    return pd.DataFrame()


def extract_year(column: Any) -> Optional[int]:
    try:
        timestamp = pd.to_datetime(column, errors="coerce")
    except Exception:
        return None

    if pd.isna(timestamp):
        return None

    year = int(timestamp.year)
    if year < 1900 or year > 3000:
        return None

    return year


def select_fiscal_periods(frame: pd.DataFrame, max_periods: int = 3) -> List[Tuple[int, Any]]:
    sortable: List[Tuple[int, int, Any]] = []

    for column in frame.columns:
        year = extract_year(column)
        if year is None:
            continue

        try:
            timestamp = pd.to_datetime(column, errors="coerce")
            sort_key = int(timestamp.value) if not pd.isna(timestamp) else year
        except Exception:
            sort_key = year

        sortable.append((year, sort_key, column))

    sortable.sort(key=lambda item: item[1], reverse=True)

    selected: List[Tuple[int, Any]] = []
    seen_years = set()

    for year, _, column in sortable:
        if year in seen_years:
            continue

        selected.append((year, column))
        seen_years.add(year)

        if len(selected) >= max_periods:
            break

    fallback_year = datetime.utcnow().year
    while len(selected) < max_periods:
        while fallback_year in seen_years:
            fallback_year -= 1
        selected.append((fallback_year, None))
        seen_years.add(fallback_year)

    return selected


def build_index_lookup(frame: pd.DataFrame) -> Dict[str, Any]:
    lookup: Dict[str, Any] = {}

    for row_name in frame.index:
        normalized = normalize_key(row_name)
        if normalized and normalized not in lookup:
            lookup[normalized] = row_name

    return lookup


def resolve_metric_raw(
    frame: pd.DataFrame,
    index_lookup: Dict[str, Any],
    column: Any,
    candidates: List[str],
) -> Optional[float]:
    if column is None:
        return None

    for candidate in candidates:
        index_name = index_lookup.get(normalize_key(candidate))
        if index_name is None:
            continue

        try:
            raw = frame.loc[index_name, column]
        except Exception:
            continue

        if isinstance(raw, pd.Series):
            numeric = None
            for item in raw.tolist():
                numeric = to_number_or_none(item)
                if numeric is not None:
                    break
        else:
            numeric = to_number_or_none(raw)

        if numeric is not None:
            return numeric

    return None


def compute_growth_pct(latest_raw: Optional[float], oldest_raw: Optional[float]) -> Optional[float]:
    if latest_raw is None or oldest_raw is None:
        return None
    if oldest_raw == 0:
        return None

    return to_rounded_or_none(((latest_raw - oldest_raw) / oldest_raw) * 100, 4)


def get_fundamentals_enrichment(ticker: str, statement: str) -> List[Dict[str, Any]]:
    validated_ticker = assert_ticker(ticker)
    validated_statement = assert_statement(statement)

    ticker_obj = yf.Ticker(validated_ticker)
    frame = get_statement_dataframe(ticker_obj, validated_statement)
    if frame.empty:
        return []

    fiscal_periods = select_fiscal_periods(frame, max_periods=3)
    (latest_year, latest_col), (previous_year, previous_col), (oldest_year, oldest_col) = fiscal_periods

    index_lookup = build_index_lookup(frame)
    rows: List[Dict[str, Any]] = []

    for metric_label, candidates in STATEMENT_CONFIG[validated_statement]["metrics"]:
        latest_raw = resolve_metric_raw(frame, index_lookup, latest_col, candidates)
        previous_raw = resolve_metric_raw(frame, index_lookup, previous_col, candidates)
        oldest_raw = resolve_metric_raw(frame, index_lookup, oldest_col, candidates)

        rows.append({
            "metric": metric_label,
            f"fy_{latest_year}": format_compact_number(latest_raw),
            f"fy_{previous_year}": format_compact_number(previous_raw),
            f"fy_{oldest_year}": format_compact_number(oldest_raw),
            "growth_pct": compute_growth_pct(latest_raw, oldest_raw),
        })

    return rows
