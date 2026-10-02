from __future__ import annotations

from typing import Any, Dict

from .base_parser import BaseStatementParser
from .unknown_bank_parser import UnknownBankParser


class MyABLParser(BaseStatementParser):
    name = "myabl_parser"
    bank_name = "myabl"

    def __init__(self) -> None:
        self._fallback = UnknownBankParser()

    def score(self, text: str, file_name: str = "") -> float:
        lowered = f"{text or ''} {file_name or ''}".lower()
        score = 0.0

        if "myabl" in lowered or "allied bank" in lowered:
            score += 0.60
        if "raast" in lowered or "1link" in lowered:
            score += 0.10
        if "visa" in lowered or "atm withdrawal" in lowered:
            score += 0.10
        if "balance" in lowered and "debit" in lowered and "credit" in lowered:
            score += 0.10

        return min(score, 0.95)

    def parse(self, text: str):
        result = self._fallback.parse(text)
        rows = []

        for row in result.rows:
            normalized: Dict[str, Any] = dict(row)
            normalized["source_bank"] = self.bank_name

            description = (normalized.get("description") or "").lower()
            warnings = list(normalized.get("warnings") or [])

            if "atm withdrawal" in description:
                normalized["channel"] = normalized.get("channel") or "atm"

            if "visa" in description:
                normalized["channel"] = normalized.get("channel") or "card_purchase"

            if "raast" in description or "1link" in description:
                normalized["channel"] = normalized.get("channel") or "p2p"

            if not normalized.get("balance_after") and "balance" in description:
                warnings.append("Balance reference present but numeric balance not extracted")
                normalized["needs_review"] = True

            normalized["warnings"] = warnings
            rows.append(normalized)

        result.rows = rows
        result.parser_name = self.name
        result.source_bank = self.bank_name
        result.detection_confidence = max(result.detection_confidence, 0.71)
        return result
