from __future__ import annotations

import json
import pathlib
import unittest

from import_engine.adapters import adapt_textract_blocks_to_rows


FIXTURE_ROOT = pathlib.Path(__file__).resolve().parent / "fixtures" / "textract"


def _load_fixture(name: str):
    fixture_path = FIXTURE_ROOT / name
    with fixture_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    return payload.get("Blocks", [])


class TextractAdapterTests(unittest.TestCase):
    def test_table_based_reconstruction_extracts_rows(self):
        blocks = _load_fixture("myabl_table.json")

        result = adapt_textract_blocks_to_rows(
            blocks=blocks,
            source_type="pdf",
            source_bank="myabl",
        )

        self.assertGreaterEqual(len(result.rows), 2)

        first = result.rows[0]
        second = result.rows[1]

        self.assertEqual(first["transaction_date"], "2026-03-01")
        self.assertEqual(first["direction"], "debit")
        self.assertEqual(first["debit"], 1250.0)
        self.assertIsNone(first["credit"])
        self.assertEqual(first["reference_id"], "TRX12345")
        self.assertEqual(first["source_type"], "pdf")
        self.assertEqual(first["source_bank"], "myabl")
        self.assertIn("description", first)
        self.assertIn("merchant", first)

        self.assertEqual(second["transaction_date"], "2026-03-02")
        self.assertEqual(second["direction"], "credit")
        self.assertEqual(second["credit"], 95000.0)
        self.assertIsNone(second["debit"])
        self.assertEqual(second["reference_id"], "TRX12346")

        self.assertGreater(result.average_confidence, 0.65)

    def test_line_fallback_reconstruction_marks_review(self):
        blocks = _load_fixture("line_fallback.json")

        result = adapt_textract_blocks_to_rows(
            blocks=blocks,
            source_type="image",
            source_bank="sadapay",
        )

        self.assertGreaterEqual(len(result.rows), 2)

        first = result.rows[0]
        second = result.rows[1]

        self.assertEqual(first["transaction_date"], "2026-03-01")
        self.assertEqual(first["amount"], 2200.0)
        self.assertEqual(first["direction"], "debit")
        self.assertIsNotNone(first["reference_id"])
        self.assertIn("wallet", first["description"].lower())
        self.assertTrue(first["needs_review"])
        self.assertTrue(any("fallback" in item.lower() for item in first["warnings"]))

        self.assertEqual(second["transaction_date"], "2026-03-02")
        self.assertEqual(second["direction"], "credit")
        self.assertEqual(second["amount"], 150.0)

        self.assertTrue(
            any("line-level fallback" in warning.lower() for warning in result.warnings),
            "adapter should emit line fallback warning",
        )

    def test_line_fallback_carry_forwards_date_only_lines(self):
        blocks = [
            {
                "BlockType": "LINE",
                "Id": "d1",
                "Page": 1,
                "Text": "22 Oct, 2025",
                "Confidence": 95.0,
                "Geometry": {"BoundingBox": {"Top": 0.20, "Left": 0.10}},
            },
            {
                "BlockType": "LINE",
                "Id": "d2",
                "Page": 1,
                "Text": "RAAST P2P MUHAMMAD BILAL",
                "Confidence": 92.0,
                "Geometry": {"BoundingBox": {"Top": 0.24, "Left": 0.12}},
            },
            {
                "BlockType": "LINE",
                "Id": "d3",
                "Page": 1,
                "Text": "Transaction ID TRX123ABC Amount 2,750.00",
                "Confidence": 91.0,
                "Geometry": {"BoundingBox": {"Top": 0.28, "Left": 0.12}},
            },
        ]

        result = adapt_textract_blocks_to_rows(
            blocks=blocks,
            source_type="pdf",
            source_bank="myabl",
        )

        self.assertEqual(len(result.rows), 1)
        row = result.rows[0]
        self.assertEqual(row["transaction_date"], "2025-10-22")
        self.assertEqual(row["amount"], 2750.0)
        self.assertEqual(row["direction"], "credit")
        self.assertIn("raast", row["description"].lower())

    def test_line_fallback_handles_debit_credit_balance_layout(self):
        blocks = [
            {
                "BlockType": "LINE",
                "Id": "m1",
                "Page": 1,
                "Text": "Date Description Debit Credit Balance",
                "Confidence": 98.0,
                "Geometry": {"BoundingBox": {"Top": 0.10, "Left": 0.08}},
            },
            {
                "BlockType": "LINE",
                "Id": "m2",
                "Page": 1,
                "Text": "22/10/2025 RAAST P2P MUHAMMAD BILAL 2,750.00 0.00 125,000.00",
                "Confidence": 94.0,
                "Geometry": {"BoundingBox": {"Top": 0.20, "Left": 0.08}},
            },
            {
                "BlockType": "LINE",
                "Id": "m3",
                "Page": 1,
                "Text": "23/10/2025 Salary Credit ACME 0.00 95,000.00 220,000.00",
                "Confidence": 94.0,
                "Geometry": {"BoundingBox": {"Top": 0.25, "Left": 0.08}},
            },
        ]

        result = adapt_textract_blocks_to_rows(
            blocks=blocks,
            source_type="pdf",
            source_bank="myabl",
        )

        self.assertEqual(len(result.rows), 2)
        self.assertEqual(result.rows[0]["direction"], "debit")
        self.assertEqual(result.rows[0]["amount"], 2750.0)
        self.assertEqual(result.rows[1]["direction"], "credit")
        self.assertEqual(result.rows[1]["amount"], 95000.0)


if __name__ == "__main__":
    unittest.main()
