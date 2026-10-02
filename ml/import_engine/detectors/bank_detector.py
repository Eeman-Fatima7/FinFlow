from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..registry import get_parsers


@dataclass
class BankDetection:
    parser_name: str
    source_bank: str
    confidence: float


def detect_bank(text: str, file_name: str = "", bank_hint: str | None = None) -> BankDetection:
    hint = (bank_hint or "").strip().lower()
    parsers = get_parsers()

    scored: List[tuple[float, str, str]] = []
    for parser in parsers:
        score = float(parser.score(text or "", file_name or ""))

        if hint and hint in {parser.bank_name.lower(), parser.name.lower()}:
            score = max(score, 0.85)

        scored.append((score, parser.name, parser.bank_name))

    scored.sort(key=lambda item: item[0], reverse=True)
    best = scored[0] if scored else (0.0, "unknown_bank_parser", "unknown")

    return BankDetection(
      parser_name=best[1],
      source_bank=best[2],
      confidence=max(0.0, min(best[0], 1.0)),
    )
