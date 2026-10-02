TAXONOMY = [
    "Income",
    "Transfers",
    "Bills",
    "Groceries",
    "Food & Dining",
    "Transport",
    "Shopping",
    "Subscriptions",
    "Entertainment",
    "Healthcare",
    "Education",
    "Charity",
    "Fees & Charges",
    "Cash Withdrawal",
    "Government/Legal",
    "Other",
]

# Exact mapping for all 36 labels used in pakistani.csv and transactions.csv
PAKISTANI_LABEL_MAP = {
    "Bills": "Bills",
    "Car Maintenance": "Transport",
    "Cash Withdrawal": "Cash Withdrawal",
    "Charity & Donations": "Charity",
    "Coffee & Snacks": "Food & Dining",
    "Education / Tuition": "Education",
    "Electricity / Water / Gas": "Bills",
    "Entertainment & Recreation": "Entertainment",
    "Entertainment (Movies / Games / Events)": "Entertainment",
    "Fees": "Fees & Charges",
    "Financial Services": "Fees & Charges",
    "Food & Dining": "Food & Dining",
    "Fuel / Gas": "Transport",
    "Gifts & Celebrations": "Shopping",
    "Government & Legal": "Government/Legal",
    "Groceries": "Groceries",
    "Healthcare & Medical": "Healthcare",
    "Home Supplies / Household Items": "Shopping",
    "Housing / Rent": "Bills",
    "Income": "Income",
    "Insurance": "Bills",
    "Medical / Pharmacy": "Healthcare",
    "Mobile & Internet": "Bills",
    "Public Transport": "Transport",
    "Restaurants / Eating Out": "Food & Dining",
    "Ride Sharing / Taxi": "Transport",
    "Savings / Investments": "Transfers",
    "Shopping": "Shopping",
    "Shopping & Retail": "Shopping",
    "Shopping (Clothes / Electronics)": "Shopping",
    "Subscriptions": "Subscriptions",
    "Subscriptions (Streaming / Apps)": "Subscriptions",
    "Transfers": "Transfers",
    "Transportation": "Transport",
    "Travel (Flights / Hotels)": "Transport",
    "Utilities & Services": "Bills",
}

# Business dataset hierarchical labels are mapped by top-level prefix.
BUSINESS_PREFIX_MAP = {
    "Retail": "Shopping",
    "Dining and Drinking": "Food & Dining",
    "Business and Professional Services": "Fees & Charges",
    "Community and Government": "Government/Legal",
    "Travel and Transportation": "Transport",
    "Health and Medicine": "Healthcare",
    "Sports and Recreation": "Entertainment",
    "Arts and Entertainment": "Entertainment",
    "Event": "Entertainment",
    "Landmarks and Outdoors": "Other",
}

PAKISTANI_SOURCES = {"pakistani", "pakistani.csv", "transactions", "transactions.csv"}
BUSINESS_SOURCES = {"business", "business.csv"}


def _normalize_text(value: str) -> str:
    return value.strip() if isinstance(value, str) else ""


def _source_key(source_dataset: str | None) -> str:
    if not source_dataset:
        return ""
    return str(source_dataset).strip().lower()


def _business_prefix(label: str) -> str:
    return label.split(">", 1)[0].strip()


def validate_pakistani_label_mapping(labels: list[str]) -> None:
    normalized_labels = {_normalize_text(label) for label in labels if _normalize_text(label)}
    missing = sorted(label for label in normalized_labels if label not in PAKISTANI_LABEL_MAP)
    if missing:
        raise ValueError(f"Unmapped Pakistani labels detected: {missing}")


def map_category(raw_category: str, source_dataset: str | None = None) -> str:
    label = _normalize_text(raw_category)
    if not label:
        return "Other"

    source_key = _source_key(source_dataset)

    if source_key in PAKISTANI_SOURCES:
        if label not in PAKISTANI_LABEL_MAP:
            raise ValueError(f"Unmapped Pakistani label: {label}")
        return PAKISTANI_LABEL_MAP[label]

    if source_key in BUSINESS_SOURCES:
        prefix = _business_prefix(label)
        return BUSINESS_PREFIX_MAP.get(prefix, "Other")

    if label in PAKISTANI_LABEL_MAP:
        return PAKISTANI_LABEL_MAP[label]

    prefix = _business_prefix(label)
    if prefix in BUSINESS_PREFIX_MAP:
        return BUSINESS_PREFIX_MAP[prefix]

    return "Other"
