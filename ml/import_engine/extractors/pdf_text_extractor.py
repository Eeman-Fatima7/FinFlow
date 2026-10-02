from __future__ import annotations

from io import BytesIO
from typing import List, Tuple

from pypdf import PdfReader


def extract_text_from_pdf(content: bytes, max_pages: int = 50) -> Tuple[str, List[str]]:
    warnings: List[str] = []

    try:
        reader = PdfReader(BytesIO(content))
    except Exception as exc:
        return "", [f"PDF text extraction failed: {exc}"]

    chunks: List[str] = []
    page_count = min(len(reader.pages), max_pages)

    for index in range(page_count):
        try:
            text = reader.pages[index].extract_text() or ""
        except Exception:
            text = ""

        if text.strip():
            chunks.append(text)

    if len(reader.pages) > max_pages:
        warnings.append(f"PDF has more than {max_pages} pages; only first {max_pages} were processed")

    extracted = "\n".join(chunks).strip()
    if not extracted:
        warnings.append("No embedded PDF text detected")

    return extracted, warnings
