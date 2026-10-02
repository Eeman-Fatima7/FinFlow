from __future__ import annotations

from typing import Any, Dict

from .base_parser import BaseStatementParser
from .unknown_bank_parser import UnknownBankParser


class EasypaisaParser(BaseStatementParser):
    name = "easypaisa_parser"
    bank_name = "easypaisa"

    def __init__(self) -> None:
        self._fallback = UnknownBankParser()

    def score(self, text: str, file_name: str = "") -> float:
        lowered = f"{text or ''} {file_name or ''}".lower()
        score = 0.0

        if "easypaisa" in lowered:
            score += 0.60
        if "telenor microfinance bank" in lowered:
            score += 0.20
        if "trx id" in lowered or "transaction id" in lowered:
            score += 0.10
        if "fee" in lowered or "tax" in lowered:
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

            if any(token in description for token in ["fee", "wht", "tax", "deduction"]):
                normalized["fees"] = normalized.get("amount")
                warnings.append("Potential fee/tax line detected")
                normalized["needs_review"] = True

            normalized["warnings"] = warnings
            rows.append(normalized)

        result.rows = rows
        result.parser_name = self.name
        result.source_bank = self.bank_name
        result.detection_confidence = max(result.detection_confidence, 0.72)
        return result
