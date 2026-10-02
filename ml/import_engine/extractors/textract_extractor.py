from __future__ import annotations

from dataclasses import dataclass
import os
import re
import time
from typing import Any, Dict, List, Optional, Sequence

import boto3
from botocore.exceptions import BotoCoreError, ClientError


SUPPORTED_IMAGE_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/bmp",
    "image/tiff",
}

PDF_MIME = "application/pdf"


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    return value or default


def _to_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _sanitize_filename(file_name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", file_name or "statement")
    safe = safe.strip("._")
    return safe or "statement"


def _coerce_feature_types(raw: Optional[str]) -> List[str]:
    value = raw or "TABLES,FORMS"
    parts = [item.strip().upper() for item in value.split(",") if item.strip()]
    unique: List[str] = []
    for part in parts:
        if part in {"TABLES", "FORMS", "QUERIES", "SIGNATURES", "LAYOUT"} and part not in unique:
            unique.append(part)
    if not unique:
        return ["TABLES", "FORMS"]
    return unique


@dataclass
class TextractExtractionResult:
    blocks: List[Dict[str, Any]]
    pages_processed: int
    mode_used: str
    job_id: Optional[str]
    warnings: List[str]


class TextractExtractor:
    def __init__(self) -> None:
        self.region = _env("AWS_REGION") or _env("AWS_DEFAULT_REGION")
        if not self.region:
            raise ValueError("AWS_REGION is required for Textract extraction")

        self.bucket = _env("TEXTRACT_S3_BUCKET")
        self.prefix = (_env("TEXTRACT_S3_PREFIX", "statements") or "statements").strip("/")
        self.mode = (_env("TEXTRACT_MODE", "async_pdf_sync_image") or "async_pdf_sync_image").lower()
        self.feature_types = _coerce_feature_types(_env("TEXTRACT_FEATURE_TYPES", "TABLES,FORMS"))

        self.poll_interval_seconds = max(float(_env("TEXTRACT_POLL_INTERVAL_MS", "1500") or 1500) / 1000.0, 0.25)
        self.max_poll_attempts = max(int(_env("TEXTRACT_MAX_POLL_ATTEMPTS", "80") or 80), 1)
        self.delete_staged_objects = _to_bool(_env("TEXTRACT_DELETE_STAGED_OBJECT", "true"), True)

        session = boto3.session.Session(region_name=self.region)
        self.textract = session.client("textract")
        self.s3 = session.client("s3")

    def extract_document(
        self,
        *,
        file_name: str,
        mime_type: str,
        content_bytes: bytes,
        source_type: str,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> TextractExtractionResult:
        warnings: List[str] = []

        if source_type not in {"pdf", "image"}:
            raise ValueError("Textract extraction supports only pdf/image source types")

        if source_type == "image" and self.mode == "sync_only":
            return self._analyze_sync(content_bytes=content_bytes, warnings=warnings)

        should_use_sync_image = source_type == "image" and self.mode in {"async_pdf_sync_image", "sync_image"}
        if should_use_sync_image and self._supports_sync_image(mime_type):
            try:
                return self._analyze_sync(content_bytes=content_bytes, warnings=warnings)
            except (ClientError, BotoCoreError) as err:
                warnings.append(f"Textract sync image path failed; retrying async mode: {err}")

        if source_type == "pdf" and self.mode == "sync_only":
            warnings.append("Sync-only mode cannot process multi-page PDFs safely; switching to async mode")

        return self._analyze_async_via_s3(
            file_name=file_name,
            mime_type=mime_type,
            content_bytes=content_bytes,
            warnings=warnings,
            user_id=user_id,
            session_id=session_id,
        )

    def _supports_sync_image(self, mime_type: str) -> bool:
        return (mime_type or "").strip().lower() in SUPPORTED_IMAGE_MIME_TYPES

    def _analyze_sync(self, *, content_bytes: bytes, warnings: List[str]) -> TextractExtractionResult:
        response = self.textract.analyze_document(
            Document={"Bytes": content_bytes},
            FeatureTypes=self.feature_types,
        )

        blocks = response.get("Blocks", []) or []
        pages_processed = len({int(block.get("Page") or 1) for block in blocks})

        return TextractExtractionResult(
            blocks=blocks,
            pages_processed=max(pages_processed, 1 if blocks else 0),
            mode_used="sync",
            job_id=None,
            warnings=warnings,
        )

    def _build_s3_key(self, *, file_name: str, user_id: Optional[int], session_id: Optional[str]) -> str:
        safe_file = _sanitize_filename(file_name)
        ts = int(time.time() * 1000)
        user_part = str(user_id) if user_id is not None else "unknown_user"
        session_part = session_id or f"session_{ts}"
        return f"{self.prefix}/{user_part}/{session_part}/{ts}_{safe_file}"

    def _analyze_async_via_s3(
        self,
        *,
        file_name: str,
        mime_type: str,
        content_bytes: bytes,
        warnings: List[str],
        user_id: Optional[int],
        session_id: Optional[str],
    ) -> TextractExtractionResult:
        if not self.bucket:
            raise ValueError("TEXTRACT_S3_BUCKET is required for async Textract document analysis")

        key = self._build_s3_key(file_name=file_name, user_id=user_id, session_id=session_id)

        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content_bytes,
                ContentType=mime_type or None,
            )

            start_resp = self.textract.start_document_analysis(
                DocumentLocation={"S3Object": {"Bucket": self.bucket, "Name": key}},
                FeatureTypes=self.feature_types,
            )
            job_id = start_resp.get("JobId")
            if not job_id:
                raise ValueError("Textract did not return a JobId for async analysis")

            blocks = self._poll_document_analysis(job_id)
            pages_processed = len({int(block.get("Page") or 1) for block in blocks})

            return TextractExtractionResult(
                blocks=blocks,
                pages_processed=max(pages_processed, 1 if blocks else 0),
                mode_used="async",
                job_id=job_id,
                warnings=warnings,
            )
        finally:
            if self.delete_staged_objects:
                try:
                    self.s3.delete_object(Bucket=self.bucket, Key=key)
                except Exception:
                    # cleanup failure should not fail extraction result
                    pass

    def _poll_document_analysis(self, job_id: str) -> List[Dict[str, Any]]:
        attempts = 0
        next_token: Optional[str] = None
        blocks: List[Dict[str, Any]] = []
        finished = False

        while not finished and attempts < self.max_poll_attempts:
            attempts += 1

            params = {"JobId": job_id}
            if next_token:
                params["NextToken"] = next_token

            response = self.textract.get_document_analysis(**params)
            status = (response.get("JobStatus") or "").upper()

            if status == "FAILED":
                message = response.get("StatusMessage") or "Textract document analysis failed"
                raise ValueError(message)

            if status == "PARTIAL_SUCCESS":
                # collect what is available and continue pagination
                pass

            current_blocks = response.get("Blocks", []) or []
            if current_blocks:
                blocks.extend(current_blocks)

            next_token = response.get("NextToken")

            if status == "SUCCEEDED" and not next_token:
                finished = True
                break

            if status in {"IN_PROGRESS", "SUCCEEDED", "PARTIAL_SUCCESS"}:
                time.sleep(self.poll_interval_seconds)
                continue

            time.sleep(self.poll_interval_seconds)

        if not finished:
            raise TimeoutError("Textract analysis polling timed out before completion")

        return blocks


def extract_with_textract(
    *,
    file_name: str,
    mime_type: str,
    content_bytes: bytes,
    source_type: str,
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
) -> TextractExtractionResult:
    extractor = TextractExtractor()
    return extractor.extract_document(
        file_name=file_name,
        mime_type=mime_type,
        content_bytes=content_bytes,
        source_type=source_type,
        user_id=user_id,
        session_id=session_id,
    )
