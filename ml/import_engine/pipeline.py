from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any, Dict, List, Optional, Tuple

from .adapters import adapt_textract_blocks_to_rows
from .detectors.bank_detector import detect_bank
from .detectors.file_type_detector import detect_file_type
from .extractors.ocr_extractor import extract_text_from_image, extract_text_from_pdf_via_ocr
from .extractors.pdf_text_extractor import extract_text_from_pdf
from .extractors.textract_extractor import extract_with_textract
from .parsers.unknown_bank_parser import UnknownBankParser
from .registry import get_parsers


TEXTRACT_ADAPTER_NAME = "textract_statement_adapter"
DOCUMENT_PROVIDER = (os.getenv("IMPORT_DOCUMENT_PROVIDER", "textract") or "textract").strip().lower()
LEGACY_DOCUMENT_FALLBACK_ENABLED = (
    (os.getenv("IMPORT_DOCUMENT_LEGACY_FALLBACK_ENABLED", "false") or "false").strip().lower()
    in {"1", "true", "yes", "on"}
)


@dataclass
class ExtractionResult:
    rows: List[Dict[str, Any]]
    source_type: str
    source_bank: str
    parser_name: str
    detection_confidence: float
    used_ocr: bool
    warnings: List[str]
    extraction_provider: Optional[str] = None
    pages_processed: Optional[int] = None


def _decode_bytes_to_text(content: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return content.decode(encoding)
        except Exception:
            continue
    return content.decode("utf-8", errors="ignore")


def _choose_parser(parser_name: str):
    parsers = get_parsers()
    by_name = {parser.name: parser for parser in parsers}
    if parser_name in by_name:
        return by_name[parser_name]
    return UnknownBankParser()


def _score_text_quality(text: str) -> float:
    if not text:
        return 0.0

    chars = len(text)
    lines = len([line for line in text.splitlines() if line.strip()])
    alpha_ratio = sum(ch.isalpha() for ch in text) / max(chars, 1)

    score = 0.0
    if chars > 200:
        score += 0.35
    if lines > 3:
        score += 0.25
    score += min(alpha_ratio, 0.4)

    return min(score, 1.0)


def _collect_preview_text_from_blocks(blocks: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for block in blocks:
        if block.get("BlockType") != "LINE":
            continue

        text = str(block.get("Text") or "").strip()
        if text:
            lines.append(text)

        if len(lines) >= 200:
            break

    return "\n".join(lines)


def _extract_legacy_document_rows(
    *,
    file_name: str,
    mime_type: str,
    content_bytes: bytes,
    source_type: str,
    bank_hint: Optional[str],
    inherited_warnings: Optional[List[str]] = None,
) -> ExtractionResult:
    warnings: List[str] = []
    seen_warnings = set()
    used_ocr = False

    def push_warning(text: str):
        message = (text or "").strip()
        if not message or message in seen_warnings:
            return
        seen_warnings.add(message)
        warnings.append(message)

    for warning in inherited_warnings or []:
        push_warning(warning)

    text = ""

    if source_type == "csv":
        text = _decode_bytes_to_text(content_bytes)
    elif source_type == "pdf":
        text, pdf_warnings = extract_text_from_pdf(content_bytes)
        for warning in pdf_warnings:
            push_warning(warning)

        text_quality = _score_text_quality(text)
        if text_quality < 0.35:
            ocr_text, ocr_warnings = extract_text_from_pdf_via_ocr(content_bytes)
            for warning in ocr_warnings:
                push_warning(warning)
            if ocr_text:
                text = ocr_text
                used_ocr = True
                push_warning("PDF OCR fallback used due to low text quality")
    elif source_type == "image":
        text, ocr_warnings = extract_text_from_image(content_bytes)
        for warning in ocr_warnings:
            push_warning(warning)
        used_ocr = True

    if not text.strip():
        warning_summary = "; ".join(warnings) if warnings else "no extractor output"
        raise ValueError(f"No readable text could be extracted from uploaded file ({warning_summary})")

    detection = detect_bank(text=text, file_name=file_name, bank_hint=bank_hint)
    parser = _choose_parser(parser_name=detection.parser_name)
    parsed = parser.parse(text)

    final_rows = []
    for row in parsed.rows:
        normalized_row = dict(row)
        row_warnings = list(normalized_row.get("warnings") or [])

        if used_ocr:
            confidence = normalized_row.get("extraction_confidence")
            numeric_confidence = float(confidence) if confidence is not None else 0.5
            normalized_row["extraction_confidence"] = min(numeric_confidence, 0.60)
            normalized_row["needs_review"] = True
            row_warnings.append("OCR-derived row; review recommended")

        normalized_row["warnings"] = row_warnings
        final_rows.append(normalized_row)

    for warning in parsed.warnings or []:
        push_warning(warning)

    return ExtractionResult(
        rows=final_rows,
        source_type=source_type,
        source_bank=parsed.source_bank or detection.source_bank or "unknown",
        parser_name=parsed.parser_name or detection.parser_name,
        detection_confidence=max(parsed.detection_confidence, detection.confidence),
        used_ocr=used_ocr,
        warnings=warnings,
        extraction_provider="legacy",
        pages_processed=None,
    )


def _extract_with_textract_document_path(
    *,
    file_name: str,
    mime_type: str,
    content_bytes: bytes,
    source_type: str,
    bank_hint: Optional[str],
    user_id: Optional[int],
    import_session_id: Optional[str],
) -> ExtractionResult:
    textract_result = extract_with_textract(
        file_name=file_name,
        mime_type=mime_type,
        content_bytes=content_bytes,
        source_type=source_type,
        user_id=user_id,
        session_id=import_session_id,
    )

    preview_text = _collect_preview_text_from_blocks(textract_result.blocks)
    detected = detect_bank(text=preview_text, file_name=file_name, bank_hint=bank_hint)

    source_bank = (bank_hint or "").strip().lower() or detected.source_bank or "unknown"

    adapted = adapt_textract_blocks_to_rows(
        blocks=textract_result.blocks,
        source_type=source_type,
        source_bank=source_bank,
    )

    combined_warnings: List[str] = []
    seen = set()
    for warning in [
        *list(textract_result.warnings or []),
        *list(adapted.warnings or []),
    ]:
        normalized = str(warning).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        combined_warnings.append(normalized)

    if textract_result.mode_used == "async":
        combined_warnings.append(f"Textract async analysis processed {textract_result.pages_processed} page(s)")

    if not adapted.rows:
        raise ValueError("Textract analysis completed but no transaction rows were reconstructed")

    detection_confidence = max(adapted.average_confidence, detected.confidence)

    return ExtractionResult(
        rows=adapted.rows,
        source_type=source_type,
        source_bank=source_bank,
        parser_name=TEXTRACT_ADAPTER_NAME,
        detection_confidence=detection_confidence,
        used_ocr=False,
        warnings=combined_warnings,
        extraction_provider="textract",
        pages_processed=textract_result.pages_processed,
    )


def _should_use_textract_for_documents() -> bool:
    return DOCUMENT_PROVIDER in {"textract", "auto"}


def extract_statement(
    *,
    file_name: str,
    mime_type: str,
    content_bytes: bytes,
    bank_hint: Optional[str] = None,
    user_id: Optional[int] = None,
    import_session_id: Optional[str] = None,
) -> ExtractionResult:
    source_type = detect_file_type(file_name=file_name, mime_type=mime_type)
    if source_type == "unknown":
        raise ValueError("Unsupported file type")

    if source_type == "csv":
        return _extract_legacy_document_rows(
            file_name=file_name,
            mime_type=mime_type,
            content_bytes=content_bytes,
            source_type=source_type,
            bank_hint=bank_hint,
        )

    if _should_use_textract_for_documents():
        try:
            return _extract_with_textract_document_path(
                file_name=file_name,
                mime_type=mime_type,
                content_bytes=content_bytes,
                source_type=source_type,
                bank_hint=bank_hint,
                user_id=user_id,
                import_session_id=import_session_id,
            )
        except Exception as textract_err:
            if not LEGACY_DOCUMENT_FALLBACK_ENABLED:
                raise

            inherited_warnings = [
                f"Textract extraction failed and legacy fallback was used: {textract_err}",
            ]

            return _extract_legacy_document_rows(
                file_name=file_name,
                mime_type=mime_type,
                content_bytes=content_bytes,
                source_type=source_type,
                bank_hint=bank_hint,
                inherited_warnings=inherited_warnings,
            )

    return _extract_legacy_document_rows(
        file_name=file_name,
        mime_type=mime_type,
        content_bytes=content_bytes,
        source_type=source_type,
        bank_hint=bank_hint,
    )
