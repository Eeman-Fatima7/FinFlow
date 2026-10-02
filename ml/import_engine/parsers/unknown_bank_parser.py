from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from typing import Dict, List

from .base_parser import BaseStatementParser, ParseResult


DATE_PATTERNS = [
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%d/%m/%y",
    "%m/%d/%y",
    "%d-%m-%y",
    "%d %b %Y",
    "%d %B %Y",
    "%d %b %y",
    "%d %B %y",
    "%b %d, %Y",
]

LINE_DATE_PATTERNS = [
    r"\b\d{4}-\d{2}-\d{2}\b",
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b",
]


def _to_text(value) -> str:
    if value is None:
        return ""

    if isinstance(value, (list, tuple)):
        return " ".join(str(item).strip() for item in value if item is not None).strip()

    return str(value).strip()


def _normalize_date(value: str) -> str | None:
    text = _to_text(value)
    if not text:
        return None

    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if iso_match:
        return iso_match.group(0)

    for fmt in DATE_PATTERNS:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def _parse_amount(value: str) -> float | None:
    if value is None:
        return None

    text = _to_text(value)
    if not text:
        return None

    cleaned = re.sub(r"[^0-9.\-+]", "", text)
    if not cleaned or cleaned in {"-", "+", ".", "-."}:
        return None

    try:
        return float(cleaned)
    except ValueError:
        return None


def _direction_from_text(raw_amount_text: str, line: str) -> str:
    lowered_line = _to_text(line).lower()
    amount_text = _to_text(raw_amount_text)

    if amount_text.startswith("-"):
        return "debit"
    if amount_text.startswith("+"):
        return "credit"

    if " credit " in f" {lowered_line} " or re.search(r"\bcr\b", lowered_line):
        return "credit"
    if " debit " in f" {lowered_line} " or re.search(r"\bdr\b", lowered_line):
        return "debit"

    return "debit"


def _extract_rows_from_text_lines(text: str) -> List[Dict]:
    rows: List[Dict] = []
    lines = [line.strip() for line in _to_text(text).splitlines() if line.strip()]

    for index, line in enumerate(lines):
        amount_matches = re.findall(r"[+-]?\d[\d,]*\.\d{1,2}", line)
        if not amount_matches:
            continue

        amount_token = amount_matches[-1]
        amount = _parse_amount(amount_token)
        if amount is None or amount == 0:
            continue

        date_token = ""
        for pattern in LINE_DATE_PATTERNS:
            match = re.search(pattern, line)
            if match:
                date_token = match.group(0)
                break

        normalized_date = _normalize_date(date_token) if date_token else None

        direction = _direction_from_text(amount_token, line)
        signed_amount = abs(amount)
        if direction == "debit":
            signed_amount = -abs(amount)

        description = line
        if date_token:
            description = description.replace(date_token, " ")
        description = description.replace(amount_token, " ")
        description = re.sub(r"\s+", " ", description).strip() or f"Imported row {index + 1}"

        rows.append(
            {
                "transaction_date": normalized_date,
                "description": description,
                "description_raw": line,
                "merchant": "",
                "counterparty": "",
                "amount_signed": signed_amount,
                "amount": abs(signed_amount),
                "debit": abs(signed_amount) if signed_amount < 0 else None,
                "credit": abs(signed_amount) if signed_amount > 0 else None,
                "direction": "credit" if signed_amount > 0 else "debit",
                "currency": "PKR",
                "reference_id": None,
                "channel": None,
                "warnings": ["Fallback text-line parsing used"],
                "extraction_confidence": 0.38,
                "needs_review": True,
            }
        )

    return rows


class UnknownBankParser(BaseStatementParser):
    name = "unknown_bank_parser"
    bank_name = "unknown"

    def score(self, text: str, file_name: str = "") -> float:
        lowered = (text or "").lower()
        score = 0.10

        if "date" in lowered and ("amount" in lowered or "debit" in lowered or "credit" in lowered):
            score += 0.25

        if "transaction" in lowered or "statement" in lowered:
            score += 0.15

        if re.search(r"\b\d{4}-\d{2}-\d{2}\b", lowered):
            score += 0.05

        if "," in lowered:
            score += 0.05

        return min(score, 0.60)

    def parse(self, text: str) -> ParseResult:
        warnings: List[str] = ["Using unknown-bank parser fallback"]
        rows: List[Dict] = []

        reader = csv.DictReader(io.StringIO(_to_text(text)))
        field_names = [str(name).lower().strip() for name in (reader.fieldnames or []) if name is not None]

        if field_names:
            for index, raw in enumerate(reader):
                normalized = {str(k).strip().lower(): _to_text(v) for k, v in raw.items() if k is not None}

                date_text = (
                    normalized.get("transaction_date")
                    or normalized.get("date")
                    or normalized.get("posting_date")
                    or normalized.get("value_date")
                    or ""
                )

                description = (
                    normalized.get("description")
                    or normalized.get("details")
                    or normalized.get("narration")
                    or normalized.get("merchant")
                    or normalized.get("counterparty")
                    or f"Imported row {index + 1}"
                )

                amount = _parse_amount(normalized.get("amount", ""))

                debit_amount = _parse_amount(normalized.get("debit", ""))
                credit_amount = _parse_amount(normalized.get("credit", ""))

                if amount is None and debit_amount is not None:
                    amount = -abs(debit_amount)
                elif amount is None and credit_amount is not None:
                    amount = abs(credit_amount)

                direction = _to_text(normalized.get("direction")).lower()
                if direction not in {"credit", "debit"}:
                    direction = "debit" if amount is None or amount <= 0 else "credit"

                if amount is None:
                    continue

                if direction == "debit" and amount > 0:
                    amount_signed = -abs(amount)
                elif direction == "credit" and amount < 0:
                    amount_signed = abs(amount)
                else:
                    amount_signed = amount

                rows.append(
                    {
                        "transaction_date": _normalize_date(date_text),
                        "description": description,
                        "description_raw": description,
                        "merchant": normalized.get("merchant") or normalized.get("counterparty") or "",
                        "counterparty": normalized.get("counterparty") or "",
                        "amount_signed": amount_signed,
                        "amount": abs(amount_signed),
                        "debit": abs(amount_signed) if amount_signed < 0 else None,
                        "credit": abs(amount_signed) if amount_signed > 0 else None,
                        "direction": "credit" if amount_signed > 0 else "debit",
                        "balance_after": _parse_amount(normalized.get("balance", ""))
                        or _parse_amount(normalized.get("balance_after", "")),
                        "currency": normalized.get("currency") or "PKR",
                        "reference_id": normalized.get("reference_id") or normalized.get("transaction_id") or None,
                        "channel": normalized.get("channel") or normalized.get("transaction_method") or None,
                        "warnings": ["Fallback CSV parser used"],
                        "extraction_confidence": 0.45,
                        "needs_review": True,
                    }
                )

        if not rows:
            line_rows = _extract_rows_from_text_lines(text)
            rows.extend(line_rows)
            if line_rows:
                warnings.append("No structured table detected; parsed from free-form text lines")

        if not rows:
            warnings.append("No rows extracted by fallback parser")

        return ParseResult(
            rows=rows,
            parser_name=self.name,
            source_bank=self.bank_name,
            detection_confidence=0.45,
            warnings=warnings,
        )
