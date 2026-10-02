from __future__ import annotations

from pathlib import Path


CSV_EXTENSIONS = {".csv"}
PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}


def detect_file_type(file_name: str, mime_type: str) -> str:
    extension = Path(file_name or "").suffix.lower()
    mime = (mime_type or "").strip().lower()

    if "csv" in mime or extension in CSV_EXTENSIONS:
        return "csv"
    if "pdf" in mime or extension in PDF_EXTENSIONS:
        return "pdf"
    if mime.startswith("image/") or extension in IMAGE_EXTENSIONS:
        return "image"
    return "unknown"
