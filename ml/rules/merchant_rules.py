"""
Merchant/channel rule format:
- Add uppercase keywords to RULES_BY_CATEGORY for text matching against description/merchant.
- Add startswith patterns to STARTSWITH_RULES for prefix-specific routing.
- Add entries to CHANNEL_RULES for normalized channel-based routing.
Rules are evaluated top-to-bottom; first match wins.
"""

from __future__ import annotations

from typing import Optional, Tuple


def _norm(value: Optional[str]) -> str:
    return (value or "").strip().upper()


# Order matters: specific before generic.
RULES_BY_CATEGORY = [
    ("Subscriptions", [
        "APPLE.COM/BILL",
        "YOUTUBE PREMIUM",
        "GOOGLE ONE",
        "AMAZON PRIME",
        "DISNEY+",
        "NETFLIX",
        "SPOTIFY",
        "SCRIBD",
    ]),
    ("Shopping", [
        "ALIEXPRESS",
        "DARAZ",
        "TEMU",
    ]),
    ("Food & Dining", [
        "FOOD PANDA",
        "FOODPANDA",
        "UBER EATS",
    ]),
    ("Entertainment", [
        "STEAMGAMES",
    ]),
    ("Fees & Charges", [
        "AMAZON WEB SERVICES",
        "AWS.AMAZON",
    ]),
    ("Government/Legal", [
        "NADRA",
        "FBR",
    ]),
    ("Transfers", [
        "INTRA BANK",
        "RAAST P2P",
        "1LINK",
        "MYABL INTER",
        "PAYFAST",
    ]),
    ("Cash Withdrawal", [
        "ATM CASH",
    ]),
    ("Bills", [
        "K-ELECTRIC",
        "KELECTRIC",
        "TELENOR",
        "UFONE",
        "JAZZ",
        "ZONG",
        "PTCL",
        "LESCO",
        "IESCO",
        "SSGC",
    ]),
    ("Charity", [
        "UNRWA",
        "EDHI",
        "JDC",
    ]),
]

STARTSWITH_RULES = [
    ("Transfers", ["ICT/", "OGT/", "CRF/"]),
    ("Cash Withdrawal", ["CWD/"]),
]

CHANNEL_RULES = {
    "cash_withdrawal": "Cash Withdrawal",
    "atm": "Cash Withdrawal",
    "raast_p2p": "Transfers",
    "p2p": "Transfers",
    "wallet_transfer": "Transfers",
    "wallet": "Transfers",
    "transfer": "Transfers",
    "bank_transfer": "Transfers",
    "ibft": "Transfers",
    "bill_payment": "Bills",
    "bill": "Bills",
    "card_purchase": "Shopping",
    "card": "Shopping",
}

INCOME_CREDIT_KEYWORDS = [
    "FIVERR",
    "SALARY",
    "PAYROLL",
]

ATM_GENERIC_KEYWORD = "ATM"


def apply_rules(
    description_raw: str,
    merchant: str,
    channel: str = None,
    direction: str = None,
) -> Tuple[Optional[str], Optional[float]]:
    haystack = f"{_norm(description_raw)} {_norm(merchant)}".strip()
    normalized_direction = _norm(direction)
    normalized_channel = "_".join((channel or "").strip().lower().split())
    if normalized_channel == "cash_withdrawal":
        normalized_channel = "atm"

    # Channel rules first when present and normalized.
    if normalized_channel in CHANNEL_RULES:
        return CHANNEL_RULES[normalized_channel], 1.0

    for category, prefixes in STARTSWITH_RULES:
        for prefix in prefixes:
            if haystack.startswith(prefix):
                return category, 1.0

    for category, keywords in RULES_BY_CATEGORY:
        for keyword in keywords:
            if keyword in haystack:
                return category, 1.0

    if normalized_direction == "CREDIT":
        for keyword in INCOME_CREDIT_KEYWORDS:
            if keyword in haystack:
                return "Income", 1.0

    # Generic ATM rule checked after specific cash-withdrawal patterns.
    if ATM_GENERIC_KEYWORD in haystack:
        return "Cash Withdrawal", 1.0

    return None, None
