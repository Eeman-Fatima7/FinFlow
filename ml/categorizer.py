from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

from config import AMBIGUITY_MARGIN, CONFIDENCE_HIGH
from rules import apply_rules

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "categorizer.pkl")
FEATURE_META_PATH = os.path.join(BASE_DIR, "models", "feature_meta.pkl")

SOURCE_BANK_ALIASES = {
    "easypaisa": "easypaisa",
    "telenor_microfinance_bank": "easypaisa",
    "telenor": "easypaisa",
    "sadapay": "sadapay",
    "myabl": "myabl",
    "abl": "myabl",
    "allied_bank": "myabl",
    "unknown": "unknown",
}

CHANNEL_ALIASES = {
    "p2p": "p2p",
    "raast_p2p": "p2p",
    "wallet_transfer": "wallet_transfer",
    "wallet": "wallet_transfer",
    "transfer": "p2p",
    "bank_transfer": "p2p",
    "ibft": "p2p",
    "atm": "atm",
    "cash_withdrawal": "atm",
    "withdrawal": "atm",
    "card_purchase": "card_purchase",
    "card": "card_purchase",
    "pos": "card_purchase",
    "bill_payment": "bill_payment",
    "bill": "bill_payment",
    "cash_deposit": "cash_deposit",
    "deposit": "cash_deposit",
}

NOISY_IDENTIFIER_RE = re.compile(
    r"\b(?:txn|trx|tx|id|ref|reference|rrn|trace|auth)\s*[:#-]?\s*[a-z0-9-]{4,}\b",
    re.IGNORECASE,
)
ACCOUNT_FRAGMENT_RE = re.compile(
    r"\b(?:a/?c|account|iban|acc|cnic|phone|mobile)\s*[:#-]?\s*[0-9*x-]{4,}\b",
    re.IGNORECASE,
)
LONG_NUMBER_RE = re.compile(r"\b\d{6,}\b")

_pipeline = None
_feature_meta = None


@dataclass
class PredictionResult:
    category: Optional[str]
    confidence: float
    source: str
    top_predictions: List[Dict[str, float]]


def load_model() -> None:
    global _pipeline, _feature_meta

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run 'python train.py' first."
        )

    if not os.path.exists(FEATURE_META_PATH):
        raise FileNotFoundError(
            f"Feature metadata not found at {FEATURE_META_PATH}. Run 'python train.py' first."
        )

    _pipeline = joblib.load(MODEL_PATH)
    _feature_meta = joblib.load(FEATURE_META_PATH)
    model_version = (
        str(_feature_meta.get("model_version"))
        if isinstance(_feature_meta, dict) and _feature_meta.get("model_version")
        else "unknown"
    )
    print(f"Model loaded from {MODEL_PATH} (version={model_version})")


def _ensure_loaded() -> None:
    if _pipeline is None or _feature_meta is None:
        load_model()


def _norm(value: Optional[str]) -> str:
    return str(value or "").strip()


def _normalize_direction(value: Optional[str]) -> str:
    normalized = _norm(value).lower()
    return normalized if normalized in {"debit", "credit"} else "unknown"


def _normalize_source_bank(value: Optional[str]) -> str:
    normalized = re.sub(r"\s+", "_", _norm(value).lower())
    return SOURCE_BANK_ALIASES.get(normalized, "unknown")


def _normalize_channel(value: Optional[str]) -> str:
    normalized = re.sub(r"\s+", "_", _norm(value).lower())
    return CHANNEL_ALIASES.get(normalized, "unknown")


def _clean_text(value: Optional[str]) -> str:
    text = _norm(value).lower()
    if not text:
        return ""

    text = NOISY_IDENTIFIER_RE.sub(" ", text)
    text = ACCOUNT_FRAGMENT_RE.sub(" ", text)
    text = LONG_NUMBER_RE.sub(" ", text)
    text = re.sub(r"[^a-z0-9/&+\-\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _amount_bucket(amount: float) -> str:
    numeric = float(abs(amount)) if np.isfinite(amount) else 0.0

    if numeric < 100:
        return "micro"
    if numeric < 1000:
        return "small"
    if numeric < 10000:
        return "medium"
    if numeric < 100000:
        return "large"
    return "very_large"


def _build_feature_frame(
    *,
    description: str,
    merchant: str,
    amount: float,
    direction: str,
    source_bank: str,
    channel: str,
    has_fees: float,
    has_tax: float,
    is_credit_origin: float,
    counterparty: str,
    recurring_flag: float,
) -> pd.DataFrame:
    text_description = _clean_text(description)
    text_merchant = _clean_text(merchant)
    text_counterparty = _clean_text(counterparty)

    model_text = f"{text_description} {text_merchant} {text_counterparty}".strip()
    if not model_text:
        model_text = "unknown transaction"

    row = {
        "text": model_text,
        "amount_bucket": _amount_bucket(amount),
        "direction": _normalize_direction(direction),
        "source_bank": _normalize_source_bank(source_bank),
        "channel": _normalize_channel(channel),
        "has_fees": float(has_fees or 0.0),
        "has_tax": float(has_tax or 0.0),
        "is_credit_origin": float(is_credit_origin or 0.0),
        "recurring_flag": float(recurring_flag or 0.0),
    }

    expected_columns = _feature_meta.get("feature_columns") if isinstance(_feature_meta, dict) else None
    if expected_columns:
        for column in expected_columns:
            row.setdefault(column, 0.0 if column in {"has_fees", "has_tax", "is_credit_origin", "recurring_flag"} else "unknown")

    ordered_columns = expected_columns or list(row.keys())
    return pd.DataFrame([{column: row[column] for column in ordered_columns}])


def _decode_class_labels(classes: np.ndarray) -> List[str]:
    labels = [str(item) for item in classes]
    if not isinstance(_feature_meta, dict):
        return labels

    label_encoder = _feature_meta.get("label_encoder")
    if label_encoder is None:
        return labels

    try:
        encoded = np.array(classes, dtype=int)
    except Exception:
        return labels

    try:
        decoded = label_encoder.inverse_transform(encoded)
        return [str(item) for item in decoded]
    except Exception:
        return labels


def _format_top_predictions(categories: List[str], probabilities: np.ndarray, k: int = 3) -> List[Dict[str, float]]:
    top_indices = np.argsort(probabilities)[::-1][:k]
    return [
        {
            "category": str(categories[index]),
            "confidence": round(float(probabilities[index]), 4),
        }
        for index in top_indices
    ]


def predict(
    description: str,
    merchant: str = "",
    amount: float = 0.0,
    direction: str = "unknown",
    source_bank: str = "unknown",
    channel: str = "unknown",
    has_fees: float = 0.0,
    has_tax: float = 0.0,
    is_credit_origin: float = 0.0,
    counterparty: str = "",
    recurring_flag: float = 0.0,
) -> Dict[str, Any]:
    _ensure_loaded()

    rule_category, rule_confidence = apply_rules(
        description_raw=description,
        merchant=merchant,
        channel=channel,
        direction=direction,
    )

    model_version = (
        str(_feature_meta.get("model_version"))
        if isinstance(_feature_meta, dict) and _feature_meta.get("model_version")
        else "unknown"
    )

    if rule_category:
        return {
            "category": rule_category,
            "confidence": round(float(rule_confidence or CONFIDENCE_HIGH), 4),
            "source": "rule",
            "top_predictions": [
                {
                    "category": rule_category,
                    "confidence": 1.0,
                }
            ],
            "model_version": model_version,
        }

    amount_numeric = float(amount) if np.isfinite(amount) else 0.0

    features = _build_feature_frame(
        description=description,
        merchant=merchant,
        amount=amount_numeric,
        direction=direction,
        source_bank=source_bank,
        channel=channel,
        has_fees=has_fees,
        has_tax=has_tax,
        is_credit_origin=is_credit_origin,
        counterparty=counterparty,
        recurring_flag=recurring_flag,
    )

    probabilities = _pipeline.predict_proba(features)[0]
    categories = _decode_class_labels(_pipeline.classes_)

    top_predictions = _format_top_predictions(categories, probabilities, k=3)
    best = top_predictions[0] if top_predictions else {"category": "Other", "confidence": 0.0}
    second_confidence = top_predictions[1]["confidence"] if len(top_predictions) > 1 else 0.0
    margin = round(float(best["confidence"] - second_confidence), 4)

    return {
        "category": best["category"],
        "confidence": round(float(best["confidence"]), 4),
        "source": "model",
        "top_predictions": top_predictions,
        "margin": margin,
        "ambiguous": margin < AMBIGUITY_MARGIN,
        "model_version": model_version,
    }
