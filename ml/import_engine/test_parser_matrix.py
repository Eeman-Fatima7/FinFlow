from __future__ import annotations

import unittest
import os
from unittest.mock import patch

from import_engine.detectors.bank_detector import detect_bank
from import_engine.detectors.file_type_detector import detect_file_type
from import_engine.parser_fixtures import (
    CSV_FIXTURES,
    IMAGE_OCR_FIXTURES,
    PDF_OCR_FIXTURES,
    PDF_TEXT_FIXTURES,
)
from import_engine.pipeline import extract_statement, TEXTRACT_ADAPTER_NAME, ExtractionResult


REQUIRED_ROW_KEYS = {
    "transaction_date",
    "description",
    "description_raw",
    "amount_signed",
    "amount",
    "debit",
    "credit",
    "direction",
    "currency",
    "reference_id",
    "channel",
    "warnings",
    "extraction_confidence",
    "needs_review",
}


class DetectorMatrixTests(unittest.TestCase):
    def test_file_type_detection_matrix(self):
        cases = [
            ("statement.csv", "text/csv", "csv"),
            ("statement.csv", "application/octet-stream", "csv"),
            ("statement.pdf", "application/pdf", "pdf"),
            ("statement.pdf", "application/octet-stream", "pdf"),
            ("receipt.png", "image/png", "image"),
            ("receipt.jpeg", "application/octet-stream", "image"),
            ("notes.txt", "text/plain", "unknown"),
        ]

        for file_name, mime_type, expected in cases:
            with self.subTest(file_name=file_name, mime_type=mime_type):
                self.assertEqual(detect_file_type(file_name=file_name, mime_type=mime_type), expected)

    def test_bank_detection_for_fixture_matrix(self):
        fixtures = CSV_FIXTURES + PDF_TEXT_FIXTURES + PDF_OCR_FIXTURES + IMAGE_OCR_FIXTURES

        for fixture in fixtures:
            text = fixture.get("text") or fixture.get("ocr_text") or fixture.get("pdf_text") or ""
            with self.subTest(fixture=fixture["id"]):
                detection = detect_bank(text=text, file_name=fixture["file_name"])
                self.assertEqual(detection.parser_name, fixture["expected_parser"])
                self.assertEqual(detection.source_bank, fixture["expected_bank"])
                self.assertGreater(detection.confidence, 0.0)

    def test_bank_hint_biases_parser_selection(self):
        plain_text = "monthly statement with debit and credit rows"
        detection = detect_bank(text=plain_text, file_name="statement.pdf", bank_hint="myabl")
        self.assertEqual(detection.parser_name, "myabl_parser")
        self.assertEqual(detection.source_bank, "myabl")
        self.assertGreaterEqual(detection.confidence, 0.85)


class PipelineMatrixTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("IMPORT_DOCUMENT_PROVIDER", None)
        os.environ.pop("IMPORT_DOCUMENT_LEGACY_FALLBACK_ENABLED", None)
        self.provider_patcher = patch("import_engine.pipeline.DOCUMENT_PROVIDER", "textract")
        self.provider_patcher.start()

    def tearDown(self):
        self.provider_patcher.stop()

    def test_csv_fixture_matrix(self):
        for fixture in CSV_FIXTURES:
            with self.subTest(fixture=fixture["id"]):
                extraction = extract_statement(
                    file_name=fixture["file_name"],
                    mime_type=fixture["mime_type"],
                    content_bytes=fixture["text"].encode("utf-8"),
                )

                self.assertEqual(extraction.source_type, "csv")
                self.assertEqual(extraction.parser_name, fixture["expected_parser"])
                self.assertEqual(extraction.source_bank, fixture["expected_bank"])
                self.assertFalse(extraction.used_ocr)
                self.assertEqual(extraction.extraction_provider, "legacy")
                self.assertIsNone(extraction.pages_processed)
                self.assertGreaterEqual(extraction.detection_confidence, 0.1)
                self.assertGreater(len(extraction.rows), 0)

                for row in extraction.rows:
                    self.assertTrue(REQUIRED_ROW_KEYS.issubset(row.keys()))
                    self.assertIsInstance(row["warnings"], list)

    @patch("import_engine.pipeline._extract_with_textract_document_path")
    def test_pdf_text_fixture_matrix(self, mock_textract_document_path):
        for fixture in PDF_TEXT_FIXTURES:
            with self.subTest(fixture=fixture["id"]):
                mock_textract_document_path.return_value = ExtractionResult(
                    rows=[
                        {
                            "transaction_date": "2026-03-01",
                            "description": "Textract extracted description",
                            "description_raw": fixture["text"],
                            "amount_signed": -1500.0,
                            "amount": 1500.0,
                            "debit": 1500.0,
                            "credit": None,
                            "direction": "debit",
                            "currency": "PKR",
                            "reference_id": "TXN1001",
                            "channel": "wallet_transfer",
                            "warnings": [],
                            "extraction_confidence": 0.84,
                            "needs_review": False,
                        }
                    ],
                    source_type="pdf",
                    source_bank=fixture["expected_bank"],
                    parser_name=TEXTRACT_ADAPTER_NAME,
                    detection_confidence=0.84,
                    used_ocr=False,
                    warnings=["fixture textract extraction"],
                    extraction_provider="textract",
                    pages_processed=1,
                )

                extraction = extract_statement(
                    file_name=fixture["file_name"],
                    mime_type=fixture["mime_type"],
                    content_bytes=b"%PDF-1.4 fixture content",
                    user_id=88,
                    import_session_id="sess-fixture",
                )

                self.assertEqual(extraction.source_type, "pdf")
                self.assertEqual(extraction.parser_name, TEXTRACT_ADAPTER_NAME)
                self.assertEqual(extraction.source_bank, fixture["expected_bank"])
                self.assertFalse(extraction.used_ocr)
                self.assertEqual(extraction.extraction_provider, "textract")
                self.assertEqual(extraction.pages_processed, 1)
                self.assertGreater(len(extraction.rows), 0)

    @patch("import_engine.pipeline._extract_with_textract_document_path")
    def test_pdf_ocr_fallback_matrix(self, mock_textract_document_path):
        for fixture in PDF_OCR_FIXTURES:
            with self.subTest(fixture=fixture["id"]):
                mock_textract_document_path.return_value = ExtractionResult(
                    rows=[
                        {
                            "transaction_date": "2026-03-01",
                            "description": "Scanned statement tx",
                            "description_raw": fixture["ocr_text"],
                            "amount_signed": -1200.0,
                            "amount": 1200.0,
                            "debit": 1200.0,
                            "credit": None,
                            "direction": "debit",
                            "currency": "PKR",
                            "reference_id": "SP9981",
                            "channel": "wallet_transfer",
                            "warnings": ["Textract line fallback reconstruction used"],
                            "extraction_confidence": 0.58,
                            "needs_review": True,
                        }
                    ],
                    source_type="pdf",
                    source_bank=fixture["expected_bank"],
                    parser_name=TEXTRACT_ADAPTER_NAME,
                    detection_confidence=0.58,
                    used_ocr=False,
                    warnings=["Textract async analysis processed 2 page(s)"],
                    extraction_provider="textract",
                    pages_processed=2,
                )

                extraction = extract_statement(
                    file_name=fixture["file_name"],
                    mime_type=fixture["mime_type"],
                    content_bytes=b"%PDF-1.4 scanned fixture",
                )

                self.assertEqual(extraction.source_type, "pdf")
                self.assertFalse(extraction.used_ocr)
                self.assertEqual(extraction.parser_name, TEXTRACT_ADAPTER_NAME)
                self.assertEqual(extraction.source_bank, fixture["expected_bank"])
                self.assertEqual(extraction.extraction_provider, "textract")
                self.assertEqual(extraction.pages_processed, 2)
                self.assertIn("Textract async analysis processed 2 page(s)", extraction.warnings)
                self.assertGreater(len(extraction.rows), 0)

    @patch("import_engine.pipeline._extract_with_textract_document_path")
    def test_image_ocr_matrix(self, mock_textract_document_path):
        for fixture in IMAGE_OCR_FIXTURES:
            with self.subTest(fixture=fixture["id"]):
                mock_textract_document_path.return_value = ExtractionResult(
                    rows=[
                        {
                            "transaction_date": "2026-03-12",
                            "description": "Easypaisa payment",
                            "description_raw": fixture["ocr_text"],
                            "amount_signed": -600.0,
                            "amount": 600.0,
                            "debit": 600.0,
                            "credit": None,
                            "direction": "debit",
                            "currency": "PKR",
                            "reference_id": "8881",
                            "channel": "wallet_transfer",
                            "warnings": [],
                            "extraction_confidence": 0.79,
                            "needs_review": False,
                        }
                    ],
                    source_type="image",
                    source_bank=fixture["expected_bank"],
                    parser_name=TEXTRACT_ADAPTER_NAME,
                    detection_confidence=0.79,
                    used_ocr=False,
                    warnings=["fixture textract image extraction"],
                    extraction_provider="textract",
                    pages_processed=1,
                )

                extraction = extract_statement(
                    file_name=fixture["file_name"],
                    mime_type=fixture["mime_type"],
                    content_bytes=b"fake-image-bytes",
                )

                self.assertEqual(extraction.source_type, "image")
                self.assertFalse(extraction.used_ocr)
                self.assertEqual(extraction.parser_name, TEXTRACT_ADAPTER_NAME)
                self.assertEqual(extraction.source_bank, fixture["expected_bank"])
                self.assertEqual(extraction.extraction_provider, "textract")
                self.assertEqual(extraction.pages_processed, 1)
                self.assertGreater(len(extraction.rows), 0)

    def test_unsupported_file_type_is_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            extract_statement(
                file_name="notes.txt",
                mime_type="text/plain",
                content_bytes=b"plain text",
            )

        self.assertIn("Unsupported file type", str(ctx.exception))

    @patch("import_engine.pipeline._extract_with_textract_document_path")
    def test_empty_extraction_after_textract_raises(self, mock_textract_document_path):
        mock_textract_document_path.side_effect = ValueError(
            "Textract analysis completed but no transaction rows were reconstructed"
        )

        with self.assertRaises(ValueError) as ctx:
            extract_statement(
                file_name="scan.pdf",
                mime_type="application/pdf",
                content_bytes=b"%PDF-1.4 blank scan",
            )

        self.assertIn("no transaction rows", str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()
