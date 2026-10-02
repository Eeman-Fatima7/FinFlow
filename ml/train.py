"""
Train hybrid transaction categorization model.
Run: python train.py
Outputs:
- models/categorizer.pkl
- models/feature_meta.pkl
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from sklearn.svm import LinearSVC

from category_map import (
    TAXONOMY,
    map_category,
    validate_pakistani_label_mapping,
)

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

DATA_DIR = Path("data")
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

PAKISTANI_FILE = "pakistani.csv"
TRANSACTIONS_FILE = "transactions.csv"
BUSINESS_FILE = "business.csv"
CORRECTIONS_FEEDBACK_FILE = "corrections_feedback.csv"

NUMERIC_COLUMNS = [
    "has_fees",
    "has_tax",
    "is_credit_origin",
    "recurring_flag",
]

CATEGORICAL_COLUMNS = [
    "amount_bucket",
    "direction",
    "source_bank",
    "channel",
]

TEXT_COLUMN = "text"

ALLOWED_DIRECTIONS = {"debit", "credit"}
ALLOWED_SOURCE_BANKS = {"easypaisa", "sadapay", "myabl", "unknown"}
ALLOWED_CHANNELS = {
    "p2p",
    "wallet_transfer",
    "atm",
    "card_purchase",
    "bill_payment",
    "cash_deposit",
    "unknown",
}

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


@dataclass
class DatasetBundle:
    name: str
    frame: pd.DataFrame


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train hybrid transaction categorization model")
    parser.add_argument(
        "--feedback-file",
        type=str,
        default=None,
        help="Optional path to exported feedback CSV rows",
    )
    parser.add_argument(
        "--model-version",
        type=str,
        default=None,
        help="Optional model version tag persisted in metadata",
    )
    return parser.parse_args()


def _read_csv(path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="latin-1")


def load_source_datasets(feedback_path: Optional[Path] = None) -> List[DatasetBundle]:
    bundles: List[DatasetBundle] = []

    for filename in [PAKISTANI_FILE, TRANSACTIONS_FILE, BUSINESS_FILE]:
        path = DATA_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing dataset: {path}")

        frame = _read_csv(path)
        frame.columns = [str(column).strip().lower() for column in frame.columns]

        required = {"description", "category"}
        missing = [column for column in required if column not in frame.columns]
        if missing:
            raise ValueError(f"{filename} missing required columns: {missing}")

        if "merchant" not in frame.columns:
            frame["merchant"] = ""

        if "amount" not in frame.columns:
            frame["amount"] = 0.0

        frame = frame[["description", "merchant", "amount", "category"]].copy()
        frame["source_dataset"] = filename

        bundles.append(DatasetBundle(name=filename, frame=frame))

    if feedback_path is not None:
        feedback_file = Path(feedback_path)
        if not feedback_file.exists():
            raise FileNotFoundError(f"Feedback dataset not found: {feedback_file}")

        feedback_frame = _read_csv(feedback_file)
        feedback_frame.columns = [str(column).strip().lower() for column in feedback_frame.columns]

        required_feedback = {"description", "category"}
        missing_feedback = [column for column in required_feedback if column not in feedback_frame.columns]
        if missing_feedback:
            raise ValueError(f"{feedback_file.name} missing required columns: {missing_feedback}")

        if "merchant" not in feedback_frame.columns:
            feedback_frame["merchant"] = ""

        if "amount" not in feedback_frame.columns:
            feedback_frame["amount"] = 0.0

        feedback_frame = feedback_frame[["description", "merchant", "amount", "category"]].copy()
        feedback_frame["source_dataset"] = feedback_file.name

        if len(feedback_frame.index) > 0:
            bundles.append(DatasetBundle(name=feedback_file.name, frame=feedback_frame))
        else:
            print(f"Feedback dataset {feedback_file.name} has 0 rows; skipping feedback merge")

    return bundles


def normalize_amount_bucket(amount: float) -> str:
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


def normalize_direction(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in ALLOWED_DIRECTIONS else "unknown"


def normalize_source_bank(value: str) -> str:
    normalized = re.sub(r"\s+", "_", str(value or "").strip().lower())
    mapped = SOURCE_BANK_ALIASES.get(normalized, "unknown")
    return mapped if mapped in ALLOWED_SOURCE_BANKS else "unknown"


def normalize_channel(value: str) -> str:
    normalized = re.sub(r"\s+", "_", str(value or "").strip().lower())
    mapped = CHANNEL_ALIASES.get(normalized, "unknown")
    return mapped if mapped in ALLOWED_CHANNELS else "unknown"


def _clean_text(value: str) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""

    text = NOISY_IDENTIFIER_RE.sub(" ", text)
    text = ACCOUNT_FRAGMENT_RE.sub(" ", text)
    text = LONG_NUMBER_RE.sub(" ", text)
    text = re.sub(r"[^a-z0-9/&+\-\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def prepare_feature_frame(raw: pd.DataFrame) -> pd.DataFrame:
    frame = raw.copy()

    frame["description"] = frame["description"].fillna("").astype(str)
    frame["merchant"] = frame["merchant"].fillna("").astype(str)
    counterparty_tokens = (
        frame["counterparty_tokens"]
        if "counterparty_tokens" in frame.columns
        else pd.Series("", index=frame.index)
    )
    frame["counterparty_tokens"] = counterparty_tokens.fillna("").astype(str)

    amount_values = frame["amount"] if "amount" in frame.columns else pd.Series(0.0, index=frame.index)
    frame["amount"] = pd.to_numeric(amount_values, errors="coerce").fillna(0.0)

    direction_values = frame["direction"] if "direction" in frame.columns else pd.Series("unknown", index=frame.index)
    source_bank_values = frame["source_bank"] if "source_bank" in frame.columns else pd.Series("unknown", index=frame.index)
    channel_values = frame["channel"] if "channel" in frame.columns else pd.Series("unknown", index=frame.index)

    frame["direction"] = direction_values.apply(normalize_direction)
    frame["source_bank"] = source_bank_values.apply(normalize_source_bank)
    frame["channel"] = channel_values.apply(normalize_channel)

    for numeric_column in NUMERIC_COLUMNS:
        numeric_values = frame[numeric_column] if numeric_column in frame.columns else pd.Series(0.0, index=frame.index)
        frame[numeric_column] = pd.to_numeric(numeric_values, errors="coerce").fillna(0.0)

    frame["amount_bucket"] = frame["amount"].apply(normalize_amount_bucket)

    frame[TEXT_COLUMN] = (
        frame["description"].fillna("").astype(str).map(_clean_text)
        + " "
        + frame["merchant"].fillna("").astype(str).map(_clean_text)
        + " "
        + frame["counterparty_tokens"].fillna("").astype(str).map(_clean_text)
    ).str.strip()

    frame.loc[frame[TEXT_COLUMN] == "", TEXT_COLUMN] = "unknown transaction"

    return frame


def map_labels_and_weight(bundles: List[DatasetBundle]) -> pd.DataFrame:
    pakistani_labels: List[str] = []
    mapped_frames: List[pd.DataFrame] = []

    for bundle in bundles:
        source_name = bundle.name
        df = bundle.frame.copy()

        if source_name in {PAKISTANI_FILE, TRANSACTIONS_FILE}:
            pakistani_labels.extend(df["category"].dropna().astype(str).str.strip().tolist())

        df["final_category"] = df["category"].apply(lambda label: map_category(label, source_name))
        mapped_frames.append(df)

    validate_pakistani_label_mapping(sorted(set(pakistani_labels)))

    merged = pd.concat(mapped_frames, ignore_index=True)

    # Pakistani dataset rows are weighted 2x by duplication.
    pakistani_rows = merged[merged["source_dataset"] == PAKISTANI_FILE]
    merged = pd.concat([merged, pakistani_rows.copy()], ignore_index=True)

    return merged


def print_distribution_report(mapped: pd.DataFrame) -> None:
    print("\n=== Distribution Report ===")

    for source in [PAKISTANI_FILE, TRANSACTIONS_FILE, BUSINESS_FILE]:
        subset = mapped[mapped["source_dataset"] == source]
        counts = subset["final_category"].value_counts().reindex(TAXONOMY, fill_value=0)
        print(f"\nSource dataset: {source}")
        for category, count in counts.items():
            print(f"  {category:<18} {int(count):>6}")

    combined = mapped["final_category"].value_counts().reindex(TAXONOMY, fill_value=0)
    print("\nCombined weighted distribution (pakistani.csv weighted 2x):")
    for category, count in combined.items():
        marker = "  <-- data-poor" if count < 200 else ""
        print(f"  {category:<18} {int(count):>6}{marker}")


def rebalance_categories(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()

    # Oversample categories below 300 to 300.
    oversampled_frames: List[pd.DataFrame] = []
    for category in TAXONOMY:
        group = working[working["final_category"] == category]
        count = len(group)

        if count == 0:
            continue

        if count < 300:
            sampled = group.sample(n=300, replace=True, random_state=RANDOM_SEED)
            oversampled_frames.append(sampled)
        else:
            oversampled_frames.append(group)

    working = pd.concat(oversampled_frames, ignore_index=True)

    # Merge categories still below 50 into Other.
    counts_after_oversample = working["final_category"].value_counts()
    small_categories = [category for category, count in counts_after_oversample.items() if count < 50]
    for category in small_categories:
        print(f"WARNING: Category '{category}' remains below 50 samples after oversampling and is merged into Other")
        working.loc[working["final_category"] == category, "final_category"] = "Other"

    # Cap any category at 6000.
    capped_frames: List[pd.DataFrame] = []
    for category, group in working.groupby("final_category"):
        if len(group) > 6000:
            capped = group.sample(n=6000, replace=False, random_state=RANDOM_SEED)
            capped_frames.append(capped)
        else:
            capped_frames.append(group)

    balanced = pd.concat(capped_frames, ignore_index=True)
    balanced = balanced.sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)

    return balanced


def build_preprocessor() -> ColumnTransformer:
    text_transformer = TfidfVectorizer(sublinear_tf=True, max_features=50000)

    categorical_transformer = OneHotEncoder(handle_unknown="ignore")

    preprocessor = ColumnTransformer(
        transformers=[
            ("text", text_transformer, TEXT_COLUMN),
            ("categorical", categorical_transformer, CATEGORICAL_COLUMNS),
            ("numeric", "passthrough", NUMERIC_COLUMNS),
        ],
        remainder="drop",
    )

    return preprocessor


def build_linear_svc_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            (
                "classifier",
                CalibratedClassifierCV(
                    LinearSVC(max_iter=2000, random_state=RANDOM_SEED),
                    cv=3,
                ),
            ),
        ]
    )


def build_logistic_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    solver="lbfgs",
                    random_state=RANDOM_SEED,
                ),
            ),
        ]
    )


def evaluate_model(name: str, pipeline: Pipeline, X: pd.DataFrame, y: np.ndarray) -> Tuple[float, Dict[str, dict], float]:
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)

    y_pred = cross_val_predict(pipeline, X, y, cv=splitter, method="predict", n_jobs=1)

    report = classification_report(y, y_pred, output_dict=True, zero_division=0)
    macro_f1 = float(report["macro avg"]["f1-score"])
    accuracy = float(accuracy_score(y, y_pred))

    print(f"\n{name} evaluation:")
    print(f"  Accuracy: {accuracy:.4f}")
    print(f"  Macro F1: {macro_f1:.4f}")

    return macro_f1, report, accuracy


def print_per_class_metrics(report: Dict[str, dict]) -> List[str]:
    print("\nPer-class metrics (5-fold CV):")
    print("Category, F1, Precision, Recall, Support")

    below_threshold: List[str] = []

    for category in TAXONOMY:
        metrics = report.get(category)
        if not metrics:
            print(f"{category}, 0.0000, 0.0000, 0.0000, 0")
            below_threshold.append(category)
            continue

        f1 = float(metrics.get("f1-score", 0.0))
        precision = float(metrics.get("precision", 0.0))
        recall = float(metrics.get("recall", 0.0))
        support = int(metrics.get("support", 0))

        print(f"{category}, {f1:.4f}, {precision:.4f}, {recall:.4f}, {support}")

        if f1 < 0.70:
            below_threshold.append(category)

    return below_threshold


def main() -> None:
    args = parse_args()

    print("=== Phase 4 Hybrid Categorization Training ===")

    feedback_path = Path(args.feedback_file) if args.feedback_file else None
    bundles = load_source_datasets(feedback_path=feedback_path)
    feedback_rows_used = 0
    if feedback_path and feedback_path.exists():
        try:
            feedback_df = _read_csv(feedback_path)
            feedback_rows_used = int(len(feedback_df.index))
        except Exception:
            feedback_rows_used = 0

    model_version = args.model_version or f"model-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    mapped = map_labels_and_weight(bundles)

    print_distribution_report(mapped)

    prepared = prepare_feature_frame(mapped)
    prepared["final_category"] = mapped["final_category"].values

    before_rebalance_counts = prepared["final_category"].value_counts().reindex(TAXONOMY, fill_value=0)
    print("\nDataset sizes before rebalancing:")
    for category, count in before_rebalance_counts.items():
        print(f"  {category:<18} {int(count):>6}")

    balanced = rebalance_categories(prepared)
    after_rebalance_counts = balanced["final_category"].value_counts().reindex(TAXONOMY, fill_value=0)

    print("\nDataset sizes after rebalancing:")
    for category, count in after_rebalance_counts.items():
        print(f"  {category:<18} {int(count):>6}")

    X = balanced[[TEXT_COLUMN, *CATEGORICAL_COLUMNS, *NUMERIC_COLUMNS]].copy()

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(balanced["final_category"].values)

    linear_pipeline = build_linear_svc_pipeline()
    logistic_pipeline = build_logistic_pipeline()

    linear_macro_f1, linear_report, linear_accuracy = evaluate_model("Calibrated LinearSVC", linear_pipeline, X, y)
    logistic_macro_f1, logistic_report, logistic_accuracy = evaluate_model("LogisticRegression", logistic_pipeline, X, y)

    if logistic_macro_f1 > linear_macro_f1 + 0.02:
        selected_name = "LogisticRegression"
        selected_pipeline = logistic_pipeline
        selected_report = logistic_report
        selected_accuracy = logistic_accuracy
        selected_macro_f1 = logistic_macro_f1
        print("\nSelected classifier: LogisticRegression")
        print(
            f"Reason: LogisticRegression macro F1 ({logistic_macro_f1:.4f}) exceeded "
            f"Calibrated LinearSVC ({linear_macro_f1:.4f}) by more than 0.02"
        )
    else:
        selected_name = "CalibratedClassifierCV(LinearSVC)"
        selected_pipeline = linear_pipeline
        selected_report = linear_report
        selected_accuracy = linear_accuracy
        selected_macro_f1 = linear_macro_f1
        print("\nSelected classifier: CalibratedClassifierCV(LinearSVC)")
        print(
            f"Reason: LogisticRegression macro F1 improvement ({logistic_macro_f1 - linear_macro_f1:.4f}) "
            "did not exceed 0.02 threshold"
        )

    print("\nFitting selected model on full balanced dataset...")
    selected_pipeline.fit(X, y)

    model_path = MODELS_DIR / "categorizer.pkl"
    feature_meta_path = MODELS_DIR / "feature_meta.pkl"
    candidate_model_path = MODELS_DIR / "categorizer_candidate.pkl"
    candidate_feature_meta_path = MODELS_DIR / "feature_meta_candidate.pkl"

    feature_meta = {
        "label_encoder": label_encoder,
        "feature_columns": [TEXT_COLUMN, *CATEGORICAL_COLUMNS, *NUMERIC_COLUMNS],
        "selected_classifier": selected_name,
        "taxonomy": TAXONOMY,
        "model_version": model_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "feedback_rows_used": feedback_rows_used,
        "training_samples": int(len(X.index)),
        "accuracy": selected_accuracy,
        "macro_f1": selected_macro_f1,
    }

    candidate_metrics_path = MODELS_DIR / "training_metrics_candidate.json"
    active_metrics_path = MODELS_DIR / "training_metrics.json"

    try:
        joblib.dump(selected_pipeline, candidate_model_path)
        joblib.dump(feature_meta, candidate_feature_meta_path)
    except Exception:
        if candidate_model_path.exists():
            candidate_model_path.unlink(missing_ok=True)
        if candidate_feature_meta_path.exists():
            candidate_feature_meta_path.unlink(missing_ok=True)
        raise

    # Convert report keys back to category labels for readable output.
    decoded_report: Dict[str, dict] = {}
    for key, value in selected_report.items():
        if key in {"accuracy", "macro avg", "weighted avg"}:
            decoded_report[key] = value
            continue

        try:
            decoded_label = label_encoder.inverse_transform([int(float(key))])[0]
            decoded_report[decoded_label] = value
        except Exception:
            decoded_report[key] = value

    below_threshold = print_per_class_metrics(decoded_report)

    metrics_report = {
        "model_version": model_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "selected_classifier": selected_name,
        "accuracy": selected_accuracy,
        "macro_f1": selected_macro_f1,
        "feedback_rows_used": feedback_rows_used,
        "training_samples": int(len(X.index)),
        "below_threshold_categories": below_threshold,
    }

    candidate_metrics_path.write_text(
        json.dumps(metrics_report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    candidate_model_path.replace(model_path)
    candidate_feature_meta_path.replace(feature_meta_path)
    candidate_metrics_path.replace(active_metrics_path)

    print("\nOverall metrics:")
    print(f"  Accuracy: {selected_accuracy:.4f}")
    print(f"  Macro F1: {selected_macro_f1:.4f}")

    print("\nCategories below 0.70 F1:")
    if below_threshold:
        for category in below_threshold:
            print(f"  - {category}")
    else:
        print("  - None")

    print("\nSaved artifacts:")
    print(f"  - {model_path}")
    print(f"  - {feature_meta_path}")
    print(f"  - {active_metrics_path}")
    print(f"  - model_version={model_version}")
    print(f"  - feedback_rows_used={feedback_rows_used}")


if __name__ == "__main__":
    main()
