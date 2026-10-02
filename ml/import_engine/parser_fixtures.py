from __future__ import annotations

from typing import Dict, List


CSV_FIXTURES: List[Dict[str, str]] = [
    {
        "id": "easypaisa_csv",
        "file_name": "easypaisa_march_statement.csv",
        "mime_type": "text/csv",
        "text": """transaction_date,description,amount,direction,currency\n2026-03-01,Easypaisa wallet transfer to Ali,1500.00,debit,PKR\n2026-03-02,Tax fee deduction,35.00,debit,PKR\n2026-03-03,Cashback reward,120.00,credit,PKR\n""",
        "expected_parser": "easypaisa_parser",
        "expected_bank": "easypaisa",
    },
    {
        "id": "sadapay_csv",
        "file_name": "sadapay_wallet_statement.csv",
        "mime_type": "text/csv",
        "text": """date,description,amount,direction,currency\n2026-03-04,SadaPay wallet transfer to Hamza,2200.00,debit,PKR\n2026-03-05,Card chargeback reversal,750.00,credit,PKR\n""",
        "expected_parser": "sadapay_parser",
        "expected_bank": "sadapay",
    },
    {
        "id": "myabl_csv",
        "file_name": "myabl_activity_march.csv",
        "mime_type": "text/csv",
        "text": """transaction_date,description,amount,direction,currency\n2026-03-06,ATM Withdrawal - Main Branch,5000.00,debit,PKR\n2026-03-07,Visa POS Grocery,1800.00,debit,PKR\n2026-03-08,RAAST transfer payroll,95000.00,credit,PKR\n2026-03-09,Balance inquiry note,15.00,debit,PKR\n""",
        "expected_parser": "myabl_parser",
        "expected_bank": "myabl",
    },
    {
        "id": "unknown_csv",
        "file_name": "generic_statement.csv",
        "mime_type": "text/csv",
        "text": """date,details,debit,credit,currency\n2026-03-10,Generic utility bill,900.00,,PKR\n2026-03-11,Salary payment,,55000.00,PKR\n""",
        "expected_parser": "unknown_bank_parser",
        "expected_bank": "unknown",
    },
]


PDF_TEXT_FIXTURES: List[Dict[str, str]] = [
    {
        "id": "easypaisa_pdf_text",
        "file_name": "easypaisa_statement.pdf",
        "mime_type": "application/pdf",
        "text": """Easypaisa account statement\nTelenor Microfinance Bank\n01/03/2026 trx id 12345 wallet payment 700.00 debit\n02/03/2026 service fee tax deduction 40.00 debit\n03/03/2026 cash in from friend 1500.00 credit\n""",
        "expected_parser": "easypaisa_parser",
        "expected_bank": "easypaisa",
    },
    {
        "id": "myabl_pdf_text",
        "file_name": "allied_bank_monthly.pdf",
        "mime_type": "application/pdf",
        "text": """Allied Bank Limited MyABL digital statement for March 2026\nGenerated for customer 998877 and includes debit and credit activity with balance references.\n01/03/2026 ATM Withdrawal Gulberg branch 5000.00 debit\n02/03/2026 Visa POS Super Store 1800.00 debit\n03/03/2026 RAAST transfer payroll 95000.00 credit\n04/03/2026 1LINK transfer to savings 12000.00 debit\n05/03/2026 Balance adjustment note 15.00 debit\nStatement continues with additional transaction narratives and account activity metadata for validation.\n""",
        "expected_parser": "myabl_parser",
        "expected_bank": "myabl",
    },
    {
        "id": "unknown_pdf_text",
        "file_name": "legacy_export.pdf",
        "mime_type": "application/pdf",
        "text": """Monthly statement export\n01/03/2026 grocery mart 1200.00 debit\n02/03/2026 internet bill 3500.00 debit\n03/03/2026 salary 70000.00 credit\nReference section and reconciliation notes included for audit.\n""",
        "expected_parser": "unknown_bank_parser",
        "expected_bank": "unknown",
    },
]


PDF_OCR_FIXTURES: List[Dict[str, str]] = [
    {
        "id": "sadapay_pdf_ocr",
        "file_name": "sadapay_scan.pdf",
        "mime_type": "application/pdf",
        "pdf_text": "12345 67890 11121",
        "ocr_text": """SadaPay wallet statement\n01/03/2026 wallet transfer to Ahmad 1200.00 debit\n02/03/2026 chargeback reversal 450.00 credit\n""",
        "expected_parser": "sadapay_parser",
        "expected_bank": "sadapay",
    }
]


IMAGE_OCR_FIXTURES: List[Dict[str, str]] = [
    {
        "id": "easypaisa_image_ocr",
        "file_name": "easypaisa_receipt.png",
        "mime_type": "image/png",
        "ocr_text": """Easypaisa payment receipt\n2026-03-12 trx id 8881 wallet transfer 600.00 debit\n2026-03-13 tax fee deduction 20.00 debit\n""",
        "expected_parser": "easypaisa_parser",
        "expected_bank": "easypaisa",
    }
]


def get_fixture(fixture_id: str) -> Dict[str, str]:
    all_fixtures = CSV_FIXTURES + PDF_TEXT_FIXTURES + PDF_OCR_FIXTURES + IMAGE_OCR_FIXTURES
    for fixture in all_fixtures:
        if fixture["id"] == fixture_id:
            return fixture
    raise KeyError(f"Unknown fixture id: {fixture_id}")
