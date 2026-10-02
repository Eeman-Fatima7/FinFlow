from __future__ import annotations

from typing import Any, Dict

from .base_parser import BaseStatementParser
from .unknown_bank_parser import UnknownBankParser


class SadaPayParser(BaseStatementParser):
    name = "sadapay_parser"
    bank_name = "sadapay"

    def __init__(self) -> None:
        self._fallback = UnknownBankParser()

    def score(self, text: str, file_name: str = "") -> float:
        lowered = f"{text or ''} {file_name or ''}".lower()
        score = 0.0

        if "sadapay" in lowered:
            score += 0.60
        if "wallet" in lowered or "wallet transfer" in lowered:
            score += 0.10
        if "debit" in lowered and "credit" in lowered:
            score += 0.10
        if "sar" in lowered or "pkr" in lowered:
            score += 0.05

        return min(score, 0.95)

    def parse(self, text: str):
        result = self._fallback.parse(text)
        rows = []

        for row in result.rows:
            normalized: Dict[str, Any] = dict(row)
            normalized["source_bank"] = self.bank_name

            description = (normalized.get("description") or "").lower()
            warnings = list(normalized.get("warnings") or [])

            if any(token in description for token in ["wallet transfer", "wallet topup", "plus", "minus"]):
                normalized["channel"] = normalized.get("channel") or "wallet_transfer"

            if "reversal" in description or "chargeback" in description:
                warnings.append("Potential reversal/chargeback transaction")
                normalized["needs_review"] = True

            normalized["warnings"] = warnings
            rows.append(normalized)

        result.rows = rows
        result.parser_name = self.name
        result.source_bank = self.bank_name
        result.detection_confidence = max(result.detection_confidence, 0.70)
        return result
