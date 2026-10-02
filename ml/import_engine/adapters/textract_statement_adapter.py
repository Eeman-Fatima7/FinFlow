from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple, Match


DATE_FORMATS = [
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
    "%d %b, %Y",
    "%d %B, %Y",
]

DATE_TOKEN_PATTERNS = [
    r"\b\d{4}-\d{2}-\d{2}\b",
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b",
    r"\b\d{1,2}\s+[A-Za-z]{3,9},\s*\d{2,4}\b",
    r"\b[A-Za-z]{3,9}\s+\d{1,2},\s*\d{2,4}\b",
]

AMOUNT_TOKEN_PATTERN = re.compile(r"[-+]?\d[\d,]*(?:\.\d{1,2})?")
REFERENCE_FALLBACK_PATTERN = re.compile(r"\b[A-Za-z0-9-]{4,}\b")
DATE_ONLY_LINE_PATTERN = re.compile(
    r"^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{2,4})\s*$"
)
AMOUNT_WITH_DECIMAL_PATTERN = re.compile(r"[-+]?\d[\d,]*\.\d{1,2}")

HEADER_KEYWORDS = {
    "date": ["date", "posting date", "txn date", "value date", "transaction date"],
    "description": [
        "description",
        "details",
        "narration",
        "particulars",
        "remarks",
        "merchant",
        "transaction",
    ],
    "debit": ["debit", "withdrawal", "dr", "debits"],
    "credit": ["credit", "deposit", "cr", "credits"],
    "amount": ["amount", "transaction amount", "amt"],
    "balance": ["balance", "running balance", "available balance"],
    "reference": ["reference", "ref", "trx id", "transaction id", "id"],
}

SKIP_LINE_PATTERNS = [
    "opening balance",
    "closing balance",
    "available balance",
    "statement period",
    "total debit",
    "total credit",
    "page ",
]

CHANNEL_KEYWORDS = {
    "atm": ["atm", "cash withdrawal"],
    "card_purchase": ["visa", "mastercard", "card", "pos"],
    "wallet_transfer": ["wallet", "easypaisa", "sadapay"],
    "p2p": ["raast", "1link", "transfer"],
}

CURRENCY_PATTERN = re.compile(r"\b(PKR|USD|EUR|GBP|AED|SAR)\b", re.IGNORECASE)
REFERENCE_PATTERN = re.compile(
    r"(?:trx\s*id|txn\s*id|transaction\s*id|reference|ref)\s*[:#|\-]?\s*([A-Za-z0-9-]{4,})",
    re.IGNORECASE,
)
REFERENCE_FALLBACK_CONTEXT_PATTERN = re.compile(
    r"(?:trx\s*id|txn\s*id|transaction\s*id|reference|ref)\s*[:#|\-]?\s*([A-Za-z0-9-]{3,})",
    re.IGNORECASE,
)


@dataclass
class TextractAdapterResult:
    rows: List[Dict[str, Any]]
    warnings: List[str]
    average_confidence: float


@dataclass
class TableRow:
    table_id: str
    page: int
    row_index: int
    cells: List[str]
    confidences: List[float]


@dataclass
class LineRow:
    page: int
    text: str
    confidence: float
    top: float
    left: float
    order: int


@dataclass
class LineCandidate:
    page: int
    text: str
    confidence: float
    date_token: Optional[str]
    amount_token: Optional[str]
    amount_raw: Optional[float]
    order: int


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_header(text: str) -> str:
    lowered = _to_text(text).lower()
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", _to_text(text)).strip()


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(value, upper))


def _to_confidence(value: Any, default: float = 0.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default

    if numeric > 1.0:
        return _clamp(numeric / 100.0)

    return _clamp(numeric)


def _parse_date(value: Any) -> Optional[str]:
    text = _to_text(value)
    if not text:
        return None

    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if iso_match:
        return iso_match.group(0)

    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def _extract_date_token(text: str) -> Optional[str]:
    for pattern in DATE_TOKEN_PATTERNS:
        match = re.search(pattern, text)
        if match:
            token = _parse_date(match.group(0))
            if token:
                return token
    return None


def _extract_currency(cells: List[str]) -> str:
    for cell in cells:
        match = CURRENCY_PATTERN.search(cell)
        if match:
            return match.group(1).upper()
    return "PKR"


def _parse_amount(value: Any) -> Optional[float]:
    text = _to_text(value)
    if not text:
        return None

    # treat placeholders as empty
    if text in {"-", "--", "—", "N/A"}:
        return None

    sign_hint = None
    lowered = text.lower()
    if "debit" in lowered or re.search(r"\bdr\b", lowered):
        sign_hint = -1
    elif "credit" in lowered or re.search(r"\bcr\b", lowered):
        sign_hint = 1

    is_negative = "(" in text and ")" in text
    match_tokens = AMOUNT_TOKEN_PATTERN.findall(text)
    if not match_tokens:
        return None

    token = match_tokens[-1].replace(",", "")
    if token in {"", "-", "+", ".", "-."}:
        return None

    try:
        amount = float(token)
    except ValueError:
        return None

    if is_negative and amount > 0:
        amount *= -1

    if sign_hint == -1:
        amount = -abs(amount)
    elif sign_hint == 1:
        amount = abs(amount)

    return amount


def _extract_reference(text: str) -> Optional[str]:
    normalized_text = text or ""

    matched = REFERENCE_PATTERN.search(normalized_text)
    if matched:
        return _normalize_whitespace(matched.group(1))

    contextual = REFERENCE_FALLBACK_CONTEXT_PATTERN.search(normalized_text)
    if contextual:
        return _normalize_whitespace(contextual.group(1))

    token_match = REFERENCE_FALLBACK_PATTERN.search(normalized_text)
    if token_match:
        candidate = _normalize_whitespace(token_match.group(0))
        if any(char.isdigit() for char in candidate) and any(char.isalpha() for char in candidate):
            return candidate

    return None


def _direction_from_text(text: str, amount_value: Optional[float] = None) -> Optional[str]:
    lowered = _to_text(text).lower()

    credit_cues = [" credit", " cr", "deposit", "salary", "cashback", "cash in", "received"]
    debit_cues = [" debit", " dr", "withdrawal", "payment", "cash out", "purchase"]

    if amount_value is not None:
        if amount_value < 0:
            return "debit"
        if amount_value > 0 and any(token in lowered for token in debit_cues):
            return "debit"
        if amount_value > 0 and any(token in lowered for token in credit_cues):
            return "credit"

    if "transfer to" in lowered or ("wallet to wallet" in lowered and " to " in lowered):
        return "debit"
    if "transfer from" in lowered or ("wallet to wallet" in lowered and " from " in lowered):
        return "credit"

    if any(token in lowered for token in debit_cues):
        return "debit"
    if any(token in lowered for token in credit_cues):
        return "credit"

    return None


def _infer_channel(description: str) -> Optional[str]:
    lowered = _to_text(description).lower()
    if not lowered:
        return None

    for channel, patterns in CHANNEL_KEYWORDS.items():
        if any(pattern in lowered for pattern in patterns):
            return channel

    return None


def _derive_merchant(description: str) -> Optional[str]:
    text = _normalize_whitespace(description)
    if not text:
        return None

    lowered = text.lower()
    separators = [" to ", " from ", " at ", " via ", " - ", " | "]
    for sep in separators:
        if sep in lowered:
            _, right = lowered.split(sep, 1)
            candidate = _normalize_whitespace(right)
            if candidate and len(candidate) >= 3:
                return candidate[:120]

    words = text.split(" ")
    if not words:
        return None

    merchant = " ".join(words[:4])
    return merchant[:120] if merchant else None


def _collect_child_ids(block: Dict[str, Any], rel_type: str = "CHILD") -> List[str]:
    ids: List[str] = []
    for rel in block.get("Relationships", []) or []:
        if rel.get("Type") == rel_type:
            ids.extend(rel.get("Ids", []) or [])
    return ids


def _extract_block_text(block: Dict[str, Any], block_map: Dict[str, Dict[str, Any]]) -> Tuple[str, float]:
    block_type = block.get("BlockType")

    if block_type == "LINE":
        return _normalize_whitespace(block.get("Text", "")), _to_confidence(block.get("Confidence"), 0.0)

    if block_type == "WORD":
        return _normalize_whitespace(block.get("Text", "")), _to_confidence(block.get("Confidence"), 0.0)

    child_ids = _collect_child_ids(block)
    if not child_ids:
        return "", _to_confidence(block.get("Confidence"), 0.0)

    words: List[str] = []
    confidences: List[float] = []

    for child_id in child_ids:
        child = block_map.get(child_id)
        if not child:
            continue

        child_type = child.get("BlockType")
        if child_type == "WORD":
            text = _normalize_whitespace(child.get("Text", ""))
            if text:
                words.append(text)
                confidences.append(_to_confidence(child.get("Confidence"), 0.0))
            continue

        if child_type == "SELECTION_ELEMENT" and child.get("SelectionStatus") == "SELECTED":
            words.append("X")
            confidences.append(_to_confidence(child.get("Confidence"), 0.0))

    if not words:
        return "", _to_confidence(block.get("Confidence"), 0.0)

    confidence = mean(confidences) if confidences else _to_confidence(block.get("Confidence"), 0.0)
    return _normalize_whitespace(" ".join(words)), confidence


def _collect_table_rows(blocks: List[Dict[str, Any]]) -> List[TableRow]:
    block_map = {
        block.get("Id"): block
        for block in blocks
        if isinstance(block, dict) and block.get("Id")
    }

    table_rows: List[TableRow] = []

    table_blocks = [block for block in blocks if block.get("BlockType") == "TABLE"]
    for table in table_blocks:
        table_id = _to_text(table.get("Id")) or f"table_{len(table_rows)}"
        page = int(table.get("Page") or 1)

        row_map: Dict[int, Dict[int, Tuple[str, float]]] = {}
        for child_id in _collect_child_ids(table):
            cell = block_map.get(child_id)
            if not cell or cell.get("BlockType") != "CELL":
                continue

            row_idx = int(cell.get("RowIndex") or 0)
            col_idx = int(cell.get("ColumnIndex") or 0)
            if row_idx <= 0 or col_idx <= 0:
                continue

            cell_text, cell_conf = _extract_block_text(cell, block_map)
            row_map.setdefault(row_idx, {})[col_idx] = (cell_text, cell_conf)

        for row_idx in sorted(row_map.keys()):
            columns = row_map[row_idx]
            max_col = max(columns.keys()) if columns else 0
            if max_col == 0:
                continue

            cells: List[str] = []
            confidences: List[float] = []
            for col in range(1, max_col + 1):
                value, confidence = columns.get(col, ("", 0.0))
                cells.append(_normalize_whitespace(value))
                if value:
                    confidences.append(confidence)

            table_rows.append(
                TableRow(
                    table_id=table_id,
                    page=page,
                    row_index=row_idx,
                    cells=cells,
                    confidences=confidences,
                )
            )

    return table_rows


def _match_header_category(cell_text: str) -> Optional[str]:
    normalized = _normalize_header(cell_text)
    if not normalized:
        return None

    for category, keywords in HEADER_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return category

    return None


def _detect_header_mapping(rows: List[TableRow]) -> Tuple[Optional[int], Dict[str, int]]:
    best_row_idx: Optional[int] = None
    best_mapping: Dict[str, int] = {}
    best_score = 0

    for candidate in rows[:3]:
        mapping: Dict[str, int] = {}
        for col_idx, cell in enumerate(candidate.cells):
            category = _match_header_category(cell)
            if category and category not in mapping:
                mapping[category] = col_idx

        score = len(mapping)
        has_amount_signal = any(key in mapping for key in ["amount", "debit", "credit"])
        if score >= 2 and has_amount_signal and score > best_score:
            best_score = score
            best_row_idx = candidate.row_index
            best_mapping = mapping

    return best_row_idx, best_mapping


def _pick_cell(cells: List[str], index: Optional[int]) -> str:
    if index is None:
        return ""
    if index < 0 or index >= len(cells):
        return ""
    return _normalize_whitespace(cells[index])


def _compose_description(cells: List[str], mapping: Dict[str, int]) -> str:
    if "description" in mapping:
        text = _pick_cell(cells, mapping.get("description"))
        if text:
            return text

    ignore_indexes = {mapping.get(key) for key in ["date", "debit", "credit", "amount", "balance", "reference"]}
    fragments: List[str] = []
    for idx, cell in enumerate(cells):
        if idx in ignore_indexes:
            continue

        normalized = _normalize_whitespace(cell)
        if not normalized:
            continue

        if _parse_amount(normalized) is not None:
            continue

        fragments.append(normalized)

    return _normalize_whitespace(" ".join(fragments))


def _calculate_row_confidence(base_confidences: List[float], warnings: List[str], *, has_date: bool, has_amount: bool) -> float:
    base = mean(base_confidences) if base_confidences else 0.55
    confidence = _to_confidence(base)

    if not has_date:
        confidence -= 0.22
    if not has_amount:
        confidence -= 0.28

    confidence -= min(0.2, 0.03 * len(warnings))

    return round(_clamp(confidence, 0.05, 0.99), 4)


def _is_noise_row(description: str, transaction_date: Optional[str], amount: Optional[float]) -> bool:
    lowered = description.lower()

    if any(pattern in lowered for pattern in SKIP_LINE_PATTERNS) and not transaction_date:
        return True

    if "balance" in lowered and amount is None:
        return True

    return False


def _build_row_from_table(
    row: TableRow,
    mapping: Dict[str, int],
    *,
    source_type: str,
    source_bank: str,
) -> Optional[Dict[str, Any]]:
    cells = row.cells
    row_text = _normalize_whitespace(" ".join(cells))

    date_text = _pick_cell(cells, mapping.get("date"))
    transaction_date = _parse_date(date_text) or _extract_date_token(row_text)

    debit = _parse_amount(_pick_cell(cells, mapping.get("debit")))
    credit = _parse_amount(_pick_cell(cells, mapping.get("credit")))
    amount_raw = _parse_amount(_pick_cell(cells, mapping.get("amount")))
    balance_after = _parse_amount(_pick_cell(cells, mapping.get("balance")))

    warnings: List[str] = []

    if debit is not None and credit is not None and abs(debit) > 0 and abs(credit) > 0:
        warnings.append("Both debit and credit columns were populated")

    direction: Optional[str] = None
    amount_value: Optional[float] = None

    if debit is not None and abs(debit) > 0 and (credit is None or abs(credit) == 0):
        amount_value = abs(debit)
        direction = "debit"
    elif credit is not None and abs(credit) > 0 and (debit is None or abs(debit) == 0):
        amount_value = abs(credit)
        direction = "credit"
    elif amount_raw is not None:
        amount_value = abs(amount_raw)
        direction = _direction_from_text(row_text, amount_raw)
        if direction is None:
            direction = "debit" if amount_raw <= 0 else "credit"
    else:
        numeric_candidates = [
            value
            for value in (_parse_amount(cell) for cell in cells)
            if value is not None
        ]

        if numeric_candidates:
            fallback = numeric_candidates[0]
            amount_value = abs(fallback)
            direction = _direction_from_text(row_text, fallback) or ("debit" if fallback <= 0 else "credit")
            warnings.append("Amount inferred from non-mapped numeric column")

    if amount_value is None or amount_value <= 0:
        return None

    description = _compose_description(cells, mapping)
    if not description:
        description = row_text

    if _is_noise_row(description, transaction_date, amount_value):
        return None

    reference_text = _pick_cell(cells, mapping.get("reference")) or row_text
    reference_id = _extract_reference(reference_text)

    merchant = _derive_merchant(description)
    if not merchant:
        warnings.append("Merchant could not be confidently separated from description")

    if not transaction_date:
        warnings.append("Missing or invalid transaction date")

    channel = _infer_channel(description)
    currency = _extract_currency(cells)

    if direction == "debit":
        debit_value = amount_value
        credit_value = None
        amount_signed = -abs(amount_value)
    else:
        debit_value = None
        credit_value = amount_value
        amount_signed = abs(amount_value)

    extraction_confidence = _calculate_row_confidence(
        row.confidences,
        warnings,
        has_date=transaction_date is not None,
        has_amount=amount_value is not None,
    )

    needs_review = (
        extraction_confidence < 0.65
        or transaction_date is None
        or amount_value is None
        or bool(warnings)
    )

    return {
        "transaction_date": transaction_date,
        "transaction_time": None,
        "description_raw": row_text,
        "description": description,
        "merchant": merchant,
        "counterparty": merchant,
        "amount_signed": round(float(amount_signed), 2),
        "amount": round(float(abs(amount_value)), 2),
        "debit": round(float(debit_value), 2) if debit_value is not None else None,
        "credit": round(float(credit_value), 2) if credit_value is not None else None,
        "direction": direction,
        "balance_after": round(float(balance_after), 2) if balance_after is not None else None,
        "currency": currency,
        "reference_id": reference_id,
        "channel": channel,
        "source_type": source_type,
        "source_bank": source_bank,
        "statement_page": row.page,
        "warnings": warnings,
        "extraction_confidence": extraction_confidence,
        "needs_review": needs_review,
    }


def _collect_lines(blocks: List[Dict[str, Any]]) -> List[LineRow]:
    lines: List[LineRow] = []

    line_blocks = [block for block in blocks if block.get("BlockType") == "LINE"]
    for index, line in enumerate(line_blocks):
        text = _normalize_whitespace(line.get("Text", ""))
        if not text:
            continue

        page = int(line.get("Page") or 1)
        confidence = _to_confidence(line.get("Confidence"), 0.55)

        geometry = line.get("Geometry") or {}
        bbox = geometry.get("BoundingBox") or {}
        top = float(bbox.get("Top", 0.0) or 0.0)
        left = float(bbox.get("Left", 0.0) or 0.0)

        lines.append(
            LineRow(
                page=page,
                text=text,
                confidence=confidence,
                top=top,
                left=left,
                order=index,
            )
        )

    lines.sort(key=lambda item: (item.page, item.top, item.left, item.order))
    return lines


def _is_header_or_noise_line(text: str) -> bool:
    lowered = _normalize_whitespace(text).lower()
    if not lowered:
        return True

    if any(pattern in lowered for pattern in SKIP_LINE_PATTERNS):
        return True

    if "transaction id" in lowered and any(token in lowered for token in ["tax", "fees", "discount", "total"]):
        if not _extract_date_token(text):
            return True

    has_date_token = _extract_date_token(text) is not None
    decimal_count = len(AMOUNT_WITH_DECIMAL_PATTERN.findall(lowered))

    signal = {
        "date": any(token in lowered for token in ["date", "posting date", "value date", "txn date"]),
        "description": any(token in lowered for token in ["description", "details", "transaction detail", "narration", "particulars"]),
        "debit": "debit" in lowered,
        "credit": "credit" in lowered,
        "amount": "amount" in lowered or " amt" in lowered,
        "balance": "balance" in lowered,
        "reference": any(token in lowered for token in ["reference", " ref", "trx id", "transaction id"]),
        "movement": any(token in lowered for token in ["opening", "incoming", "outgoing", "closing"]),
    }

    matched = sum(1 for value in signal.values() if value)

    if has_date_token and decimal_count >= 1:
        return False

    if decimal_count >= 1 and signal["reference"] and not signal["date"]:
        return False

    if signal["date"] and (signal["description"] or signal["reference"]) and (
        signal["amount"] or signal["debit"] or signal["credit"] or signal["balance"]
    ):
        return True

    if matched >= 4 and decimal_count <= 1 and not has_date_token:
        return True

    if matched >= 5:
        return True

    return False


def _is_date_only_line(text: str) -> bool:
    normalized = _normalize_whitespace(text)
    if not normalized:
        return False
    if not DATE_ONLY_LINE_PATTERN.match(normalized):
        return False
    return _parse_date(normalized) is not None


def _extract_primary_amount_match(text: str) -> Optional[Match[str]]:
    matches = list(AMOUNT_WITH_DECIMAL_PATTERN.finditer(text))
    if not matches:
        return None

    if len(matches) == 1:
        parsed = _parse_amount(matches[0].group(0))
        return matches[0] if parsed is not None and parsed != 0 else None

    non_last = matches[:-1]
    for candidate in non_last:
        parsed = _parse_amount(candidate.group(0))
        if parsed is not None and abs(parsed) > 0:
            return candidate

    for candidate in reversed(matches):
        parsed = _parse_amount(candidate.group(0))
        if parsed is not None and abs(parsed) > 0:
            return candidate

    return None


def _infer_direction_from_amount_columns(text: str) -> Optional[str]:
    matches = list(AMOUNT_WITH_DECIMAL_PATTERN.finditer(text))
    if len(matches) < 2:
        return None

    parsed = [_parse_amount(match.group(0)) for match in matches]
    non_last = parsed[:-1]

    if len(non_last) >= 2:
        first = non_last[0] or 0.0
        second = non_last[1] or 0.0

        if abs(first) > 0 and abs(second) == 0:
            return "debit"
        if abs(second) > 0 and abs(first) == 0:
            return "credit"

    lowered = _normalize_whitespace(text).lower()
    if "transfer to" in lowered or "withdrawal" in lowered or "purchase" in lowered:
        return "debit"
    if "transfer from" in lowered or "salary" in lowered or "cash in" in lowered:
        return "credit"

    return None


def _looks_like_detail_line(text: str) -> bool:
    lowered = _normalize_whitespace(text).lower()
    if not lowered:
        return False

    if "statement" in lowered and "transaction" not in lowered and "trx" not in lowered:
        return False

    if " balance" in lowered and _extract_date_token(text) is None and len(AMOUNT_WITH_DECIMAL_PATTERN.findall(text)) <= 1:
        return False

    detail_markers = [
        "transaction",
        "trx",
        "ref",
        "raast",
        "wallet",
        "transfer",
        "visa",
        "atm",
        "bill",
        "payment",
        "purchase",
        "tax",
        "fees",
        "discount",
        "total",
        "cash",
        "branch",
        "salary",
        "credit",
        "debit",
    ]
    if any(marker in lowered for marker in detail_markers):
        return True

    words = lowered.split()
    return len(words) >= 3


def _extract_line_candidate(line: LineRow) -> Optional[LineCandidate]:
    text = _normalize_whitespace(line.text)
    if not text:
        return None

    if _is_header_or_noise_line(text):
        return None

    date_token = _extract_date_token(text)
    amount_match = _extract_primary_amount_match(text)

    amount_token: Optional[str] = None
    amount_raw: Optional[float] = None
    if amount_match is not None:
        amount_token = amount_match.group(0)
        amount_raw = _parse_amount(amount_token)

    if date_token is None and amount_match is None and not _looks_like_detail_line(text):
        return None

    return LineCandidate(
        page=line.page,
        text=text,
        confidence=line.confidence,
        date_token=date_token,
        amount_token=amount_token,
        amount_raw=amount_raw,
        order=line.order,
    )


def _merge_line_candidates(lines: List[LineRow]) -> List[LineCandidate]:
    candidates: List[LineCandidate] = []
    pending_date: Optional[str] = None

    for line in lines:
        candidate = _extract_line_candidate(line)
        if candidate is None:
            continue

        if _is_date_only_line(candidate.text):
            pending_date = candidate.date_token
            continue

        if not candidate.date_token and pending_date:
            candidate.date_token = pending_date

        candidates.append(candidate)

    merged: List[LineCandidate] = []
    detail_window_size = 3

    for idx, candidate in enumerate(candidates):
        if candidate.amount_raw is None or candidate.amount_raw == 0:
            continue

        if not candidate.date_token:
            for back in range(idx - 1, max(-1, idx - detail_window_size - 1), -1):
                previous = candidates[back]
                if previous.page != candidate.page:
                    break
                if previous.date_token:
                    candidate.date_token = previous.date_token
                    break

        prefix_segments: List[str] = []
        for back in range(idx - 1, max(-1, idx - detail_window_size - 1), -1):
            previous = candidates[back]
            if previous.page != candidate.page:
                break
            if previous.amount_raw is not None and previous.amount_raw != 0:
                break
            if previous.date_token and candidate.date_token and previous.date_token != candidate.date_token:
                break
            prefix_segments.append(previous.text)

        prefix_segments.reverse()

        suffix_segments: List[str] = []
        for offset in range(1, detail_window_size + 1):
            if idx + offset >= len(candidates):
                break
            nxt = candidates[idx + offset]
            if nxt.page != candidate.page:
                break
            if nxt.amount_raw is not None and nxt.amount_raw != 0:
                break
            if nxt.date_token and candidate.date_token and nxt.date_token != candidate.date_token:
                break
            suffix_segments.append(nxt.text)

        combined_text_parts = [*prefix_segments, candidate.text, *suffix_segments]
        candidate.text = _normalize_whitespace(" ".join(part for part in combined_text_parts if part))

        merged.append(candidate)

    return merged


def _build_row_from_line_candidate(
    candidate: LineCandidate,
    *,
    source_type: str,
    source_bank: str,
) -> Optional[Dict[str, Any]]:
    text = candidate.text
    date_token = candidate.date_token
    amount_raw = candidate.amount_raw

    if amount_raw is None or amount_raw == 0:
        return None

    direction = _direction_from_text(text, amount_raw)
    if direction is None:
        direction = _infer_direction_from_amount_columns(text)
    if direction is None:
        direction = "debit" if amount_raw <= 0 else "credit"

    amount_value = abs(amount_raw)

    amount_match = _extract_primary_amount_match(text)
    amount_anchor = amount_match.start() if amount_match is not None else len(text)
    before_amount = text[:amount_anchor]

    reference_match = REFERENCE_PATTERN.search(text)
    reference_id = _normalize_whitespace(reference_match.group(1)) if reference_match else _extract_reference(text)

    description = before_amount
    if date_token:
        description = description.replace(date_token, " ")
    description = _normalize_whitespace(description)

    if not description:
        description = _normalize_whitespace(text)

    merchant = _derive_merchant(description)
    channel = _infer_channel(description)

    warnings: List[str] = ["Textract line fallback reconstruction used"]
    if not date_token:
        warnings.append("Missing or invalid transaction date")
    if not merchant:
        warnings.append("Merchant could not be confidently separated from description")

    confidence = candidate.confidence
    confidence -= 0.1
    if not date_token:
        confidence -= 0.18
    if not merchant:
        confidence -= 0.06
    confidence = round(_clamp(confidence, 0.05, 0.88), 4)

    if direction == "debit":
        debit_value = amount_value
        credit_value = None
        amount_signed = -amount_value
    else:
        debit_value = None
        credit_value = amount_value
        amount_signed = amount_value

    return {
        "transaction_date": date_token,
        "transaction_time": None,
        "description_raw": text,
        "description": description,
        "merchant": merchant,
        "counterparty": merchant,
        "amount_signed": round(float(amount_signed), 2),
        "amount": round(float(amount_value), 2),
        "debit": round(float(debit_value), 2) if debit_value is not None else None,
        "credit": round(float(credit_value), 2) if credit_value is not None else None,
        "direction": direction,
        "balance_after": None,
        "currency": _extract_currency([text]),
        "reference_id": reference_id,
        "channel": channel,
        "source_type": source_type,
        "source_bank": source_bank,
        "statement_page": candidate.page,
        "warnings": warnings,
        "extraction_confidence": confidence,
        "needs_review": True,
    }


def adapt_textract_blocks_to_rows(
    *,
    blocks: List[Dict[str, Any]],
    source_type: str,
    source_bank: str = "unknown",
) -> TextractAdapterResult:
    warnings: List[str] = []

    table_rows = _collect_table_rows(blocks)
    parsed_rows: List[Dict[str, Any]] = []

    if table_rows:
        grouped: Dict[str, List[TableRow]] = {}
        for row in table_rows:
            grouped.setdefault(row.table_id, []).append(row)

        for table_id in sorted(grouped.keys()):
            rows = sorted(grouped[table_id], key=lambda item: item.row_index)
            header_row_idx, mapping = _detect_header_mapping(rows)

            if header_row_idx is None:
                warnings.append(f"Table {table_id}: header row not confidently detected")

            for row in rows:
                if header_row_idx is not None and row.row_index <= header_row_idx:
                    continue

                built = _build_row_from_table(
                    row,
                    mapping,
                    source_type=source_type,
                    source_bank=source_bank,
                )
                if built:
                    parsed_rows.append(built)

    if not parsed_rows:
        line_rows = _collect_lines(blocks)
        merged_candidates = _merge_line_candidates(line_rows)
        fallback_rows: List[Dict[str, Any]] = []
        for candidate in merged_candidates:
            built = _build_row_from_line_candidate(
                candidate,
                source_type=source_type,
                source_bank=source_bank,
            )
            if built:
                fallback_rows.append(built)

        if fallback_rows:
            warnings.append("No reliable transaction table detected; line-level fallback was used")
            parsed_rows.extend(fallback_rows)

    if not parsed_rows:
        warnings.append("Textract adapter could not reconstruct transaction rows")

    confidences = [
        _to_confidence(row.get("extraction_confidence"), 0.0)
        for row in parsed_rows
        if row.get("extraction_confidence") is not None
    ]
    average_confidence = round(mean(confidences), 4) if confidences else 0.0

    return TextractAdapterResult(
        rows=parsed_rows,
        warnings=warnings,
        average_confidence=average_confidence,
    )
