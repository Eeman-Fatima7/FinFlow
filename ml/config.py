# Confidence thresholds for categorization routing
CONFIDENCE_HIGH = 0.85   # auto-accept, no review needed
CONFIDENCE_MEDIUM = 0.60  # flag for review but do not block save
AMBIGUITY_MARGIN = 0.08  # top-1 vs top-2 confidence gap below this is ambiguous
# below CONFIDENCE_MEDIUM -> needs_review = True
# rule match (source == "rule") -> always treated as CONFIDENCE_HIGH
