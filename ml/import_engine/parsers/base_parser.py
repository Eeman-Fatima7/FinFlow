from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class ParseResult:
    rows: List[Dict[str, Any]]
    parser_name: str
    source_bank: str
    detection_confidence: float
    warnings: List[str]


class BaseStatementParser:
    name = "base"
    bank_name = "unknown"

    def score(self, text: str, file_name: str = "") -> float:
        raise NotImplementedError

    def parse(self, text: str) -> ParseResult:
        raise NotImplementedError
