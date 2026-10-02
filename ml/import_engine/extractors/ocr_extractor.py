from __future__ import annotations

from io import BytesIO
from typing import List, Tuple


def _load_tesseract_modules():
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
    except Exception:
        return None, None

    return pytesseract, Image


def extract_text_from_image(content: bytes) -> Tuple[str, List[str]]:
    warnings: List[str] = []
    pytesseract, image_module = _load_tesseract_modules()

    if pytesseract is None or image_module is None:
        return "", ["OCR dependencies missing (install pytesseract and pillow)"]

    try:
        image = image_module.open(BytesIO(content))
        text = pytesseract.image_to_string(image) or ""
        text = text.strip()
        if not text:
            warnings.append("OCR produced empty text for image")
        return text, warnings
    except Exception as exc:
        return "", [f"Image OCR failed: {exc}"]


def extract_text_from_pdf_via_ocr(content: bytes, max_pages: int = 10) -> Tuple[str, List[str]]:
    warnings: List[str] = []

    pytesseract, _ = _load_tesseract_modules()
    if pytesseract is None:
        return "", ["OCR dependencies missing (install pytesseract and pillow)"]

    try:
        from pdf2image import convert_from_bytes  # type: ignore
    except Exception:
        return "", ["PDF OCR requires pdf2image (and Poppler runtime)"]

    try:
        pages = convert_from_bytes(content, first_page=1, last_page=max_pages)
    except Exception as exc:
        return "", [f"PDF to image conversion failed for OCR: {exc}"]

    chunks: List[str] = []
    for page in pages:
        try:
            text = pytesseract.image_to_string(page) or ""
            if text.strip():
                chunks.append(text.strip())
        except Exception:
            continue

    if not chunks:
        warnings.append("PDF OCR produced no readable text")

    return "\n".join(chunks).strip(), warnings
