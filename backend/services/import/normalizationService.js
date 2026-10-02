const { annotateRowDedupe } = require('./dedupeService');

const SUPPORTED_CURRENCIES = new Set(['USD', 'PKR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY']);

const normalizeCurrency = (value, fallback = null) => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (SUPPORTED_CURRENCIES.has(code)) return code;
  return fallback;
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const buildDateFromParts = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toDateOnly = (value) => {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return buildDateFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s|T|$)/);
  if (slashMatch) {
    const partA = Number(slashMatch[1]);
    const partB = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;

    let day;
    let month;

    if (partA > 12 && partB <= 12) {
      day = partA;
      month = partB;
    } else if (partB > 12 && partA <= 12) {
      day = partB;
      month = partA;
    } else {
      day = partA;
      month = partB;
    }

    const normalized = buildDateFromParts(year, month, day);
    if (normalized) return normalized;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return buildDateFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};

const normalizeDirection = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'credit' || normalized === 'income') return 'credit';
  if (normalized === 'debit' || normalized === 'expense') return 'debit';
  return null;
};

const normalizeAmountFields = ({ amount_signed, amount, debit, credit, direction }) => {
  const signed = Number(amount_signed);
  const numericAmount = Number(amount);
  const numericDebit = Number(debit);
  const numericCredit = Number(credit);

  if (Number.isFinite(signed) && signed !== 0) {
    return {
      amount_signed: signed,
      amount: Math.abs(signed),
      debit: signed < 0 ? Math.abs(signed) : null,
      credit: signed > 0 ? Math.abs(signed) : null,
      direction: signed >= 0 ? 'credit' : 'debit',
    };
  }

  if (Number.isFinite(numericAmount) && numericAmount > 0) {
    const resolvedDirection = normalizeDirection(direction) || 'debit';
    const signedValue = resolvedDirection === 'credit' ? numericAmount : -numericAmount;

    return {
      amount_signed: signedValue,
      amount: Math.abs(numericAmount),
      debit: resolvedDirection === 'debit' ? Math.abs(numericAmount) : null,
      credit: resolvedDirection === 'credit' ? Math.abs(numericAmount) : null,
      direction: resolvedDirection,
    };
  }

  if (Number.isFinite(numericDebit) && numericDebit > 0) {
    return {
      amount_signed: -Math.abs(numericDebit),
      amount: Math.abs(numericDebit),
      debit: Math.abs(numericDebit),
      credit: null,
      direction: 'debit',
    };
  }

  if (Number.isFinite(numericCredit) && numericCredit > 0) {
    return {
      amount_signed: Math.abs(numericCredit),
      amount: Math.abs(numericCredit),
      debit: null,
      credit: Math.abs(numericCredit),
      direction: 'credit',
    };
  }

  return {
    amount_signed: null,
    amount: null,
    debit: null,
    credit: null,
    direction: normalizeDirection(direction) || 'debit',
  };
};

const buildCanonicalPayload = (row) => {
  const transactionDate = toDateOnly(row.transaction_date) || toDateOnly(row.date);
  const merchant = toTrimmedString(row.merchant) || toTrimmedString(row.counterparty) || toTrimmedString(row.description) || 'Imported transaction';
  const description = toTrimmedString(row.description) || toTrimmedString(row.description_raw) || merchant;
  const direction = normalizeDirection(row.direction) || 'debit';
  const amount = Number(row.amount);

  return {
    description,
    merchant,
    amount: Number.isFinite(amount) ? Math.abs(amount) : null,
    type: direction === 'credit' ? 'income' : 'expense',
    date: transactionDate,
    notes: toTrimmedString(row.notes) || toTrimmedString(row.description_raw) || null,
    status: toTrimmedString(row.status).toLowerCase() || 'completed',
    source: row.source_bank || row.source || 'Bank',
    source_reference_id: toTrimmedString(row.reference_id) || null,
  };
};

const toReviewRow = ({
  importSessionId,
  sourceType,
  sourceBank,
  row,
  amountFields,
  dedupe,
  defaultCurrency = null,
}) => {
  const descriptionRaw = toTrimmedString(row.description_raw || row.description || row.details);
  const description = toTrimmedString(row.description || row.details) || descriptionRaw;
  const merchant = toTrimmedString(row.merchant || row.counterparty);
  const extractedCategory = toTrimmedString(row.extracted_category || row.category);
  const categoryFinal = toTrimmedString(row.category_final || extractedCategory);
  const extractionConfidence = Number.isFinite(Number(row.extraction_confidence)) ? Number(row.extraction_confidence) : null;

  const needsReview =
    row.needs_review === true ||
    !toDateOnly(row.transaction_date || row.date) ||
    !description ||
    !Number.isFinite(amountFields.amount) ||
    dedupe.dedupe_status !== 'clear' ||
    (extractionConfidence !== null && extractionConfidence < 0.65);

  const warnings = Array.isArray(row.warnings) ? row.warnings.filter(Boolean) : [];
  if (dedupe.duplicate_reason) {
    warnings.push(dedupe.duplicate_reason);
  }

  const canonicalPayload = buildCanonicalPayload({
    ...row,
    transaction_date: row.transaction_date || row.date,
    description,
    merchant,
    direction: amountFields.direction,
    amount: amountFields.amount,
  });

  const resolvedCurrency = normalizeCurrency(row.currency, normalizeCurrency(defaultCurrency, null));

  return {
    source_file_id: importSessionId,
    source_type: sourceType,
    source_bank: sourceBank || 'unknown',
    transaction_date: toDateOnly(row.transaction_date || row.date),
    transaction_time: toTrimmedString(row.transaction_time || row.time) || null,
    description_raw: descriptionRaw || null,
    description: description || null,
    merchant: merchant || null,
    counterparty: toTrimmedString(row.counterparty) || null,
    channel: toTrimmedString(row.channel || row.transaction_method) || null,
    direction: amountFields.direction,
    amount_signed: amountFields.amount_signed,
    amount: amountFields.amount,
    debit: amountFields.debit,
    credit: amountFields.credit,
    balance_after: Number.isFinite(Number(row.balance_after)) ? Number(row.balance_after) : null,
    currency: resolvedCurrency,
    reference_id: toTrimmedString(row.reference_id || row.transaction_id) || null,
    fees: Number.isFinite(Number(row.fees)) ? Number(row.fees) : null,
    tax: Number.isFinite(Number(row.tax)) ? Number(row.tax) : null,
    extracted_category: extractedCategory || null,
    ml_predicted_category: toTrimmedString(row.ml_predicted_category) || null,
    ml_confidence: Number.isFinite(Number(row.ml_confidence)) ? Number(row.ml_confidence) : null,
    category_final: categoryFinal || null,
    extraction_confidence: extractionConfidence,
    ml_margin: Number.isFinite(Number(row.ml_margin)) ? Number(row.ml_margin) : null,
    ml_ambiguous: row.ml_ambiguous === true,
    needs_review: needsReview,
    dedupe_fingerprint: dedupe.dedupe_fingerprint,
    dedupe_status: dedupe.dedupe_status,
    warnings,
    canonical_payload: {
      ...canonicalPayload,
      ml_confidence: Number.isFinite(Number(row.ml_confidence)) ? Number(row.ml_confidence) : null,
      ml_margin: Number.isFinite(Number(row.ml_margin)) ? Number(row.ml_margin) : null,
      ml_ambiguous: row.ml_ambiguous === true,
      ml_source: toTrimmedString(row.ml_source) || null,
      dedupe_fingerprint: dedupe.dedupe_fingerprint,
      source_import_session_id: importSessionId,
    },
  };
};

const normalizeExtractedRows = async ({ userId, importSessionId, sourceType, sourceBank, rows, defaultCurrency = null }) => {
  const normalizedRows = [];
  const warnings = [];
  const seenFingerprints = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    const rawRow = rows[index] || {};
    const amountFields = normalizeAmountFields(rawRow);

    const dedupe = await annotateRowDedupe({
      userId,
      row: {
        ...rawRow,
        transaction_date: rawRow.transaction_date || rawRow.date,
        amount: amountFields.amount,
        description: toTrimmedString(rawRow.description || rawRow.details),
        merchant: toTrimmedString(rawRow.merchant || rawRow.counterparty),
        direction: amountFields.direction,
        source_bank: sourceBank,
      },
    });

    let dedupeStatus = dedupe.dedupe_status;
    let duplicateReason = dedupe.duplicate_reason;

    if (seenFingerprints.has(dedupe.dedupe_fingerprint)) {
      dedupeStatus = 'blocked_exact';
      duplicateReason = 'Duplicate row detected inside uploaded file';
    } else if (dedupe.dedupe_fingerprint) {
      seenFingerprints.add(dedupe.dedupe_fingerprint);
    }

    const reviewPayload = toReviewRow({
      importSessionId,
      sourceType,
      sourceBank,
      row: rawRow,
      amountFields,
      dedupe: {
        ...dedupe,
        dedupe_status: dedupeStatus,
        duplicate_reason: duplicateReason,
      },
      defaultCurrency,
    });

    if (!reviewPayload.transaction_date) {
      warnings.push(`Row ${index + 1}: missing/invalid date`);
    }

    if (!Number.isFinite(Number(reviewPayload.amount))) {
      warnings.push(`Row ${index + 1}: missing/invalid amount`);
    }

    normalizedRows.push({
      row_index: index,
      raw_payload: rawRow,
      normalized_payload: reviewPayload.canonical_payload,
      review_payload: reviewPayload,
      extraction_confidence: reviewPayload.extraction_confidence,
      needs_review: reviewPayload.needs_review,
      dedupe_fingerprint: reviewPayload.dedupe_fingerprint,
      dedupe_status: reviewPayload.dedupe_status,
      duplicate_reason: duplicateReason,
      top_predictions: [],
      is_excluded: reviewPayload.dedupe_status === 'blocked_exact',
    });
  }

  return {
    rows: normalizedRows,
    warnings,
  };
};

module.exports = {
  normalizeExtractedRows,
};