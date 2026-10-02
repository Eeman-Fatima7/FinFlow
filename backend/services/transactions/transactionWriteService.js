const db = require('../../db/db');
const axios = require('axios');
const {
  loadMerchantCategoryRules,
  findMatchingMerchantRule,
} = require('./merchantCategoryRuleService');
const { findBestMemoryMatch } = require('./merchantPatternMemoryService');
const { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, AMBIGUITY_MARGIN } = require('../../config/mlConfig');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_TYPES = new Set(['income', 'expense']);
const ALLOWED_STATUSES = new Set(['completed', 'pending']);
const DEFAULT_STATUS = 'completed';
const DEFAULT_SOURCE = 'Bank';
const MAX_BATCH_SIZE = 500;

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const buildDateOnlyFromParts = (year, month, day) => {
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

const normalizeDate = (value, { allowDefaultToday = true } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (allowDefaultToday) {
      return new Date().toISOString().split('T')[0];
    }

    const err = new Error('date is required');
    err.statusCode = 400;
    throw err;
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoMatch) {
    const normalized = buildDateOnlyFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (normalized) return normalized;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error('date must be a valid date');
    err.statusCode = 400;
    throw err;
  }

  return parsed.toISOString().split('T')[0];
};

const normalizeAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const err = new Error('amount must be a positive number');
    err.statusCode = 400;
    throw err;
  }
  return numeric;
};

const normalizeType = (value, fallback = 'expense') => {
  if (value === undefined || value === null || value === '') return fallback;

  const normalized = toTrimmedString(value).toLowerCase();
  if (!ALLOWED_TYPES.has(normalized)) {
    const err = new Error("type must be either 'income' or 'expense'");
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const normalizeStatus = (value, fallback = DEFAULT_STATUS) => {
  if (value === undefined || value === null || value === '') return fallback;

  const normalized = toTrimmedString(value).toLowerCase();
  if (!ALLOWED_STATUSES.has(normalized)) {
    const err = new Error("status must be either 'completed' or 'pending'");
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const normalizeSource = (value, fallback = DEFAULT_SOURCE) => {
  if (value === undefined || value === null || value === '') return fallback;

  const source = toTrimmedString(value);
  if (!source) return fallback;

  if (source.length > 30) {
    const err = new Error('source must be 30 characters or less');
    err.statusCode = 400;
    throw err;
  }

  return source;
};

const normalizeNotes = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const notes = toTrimmedString(value);
  if (!notes) return null;

  if (notes.length > 2000) {
    const err = new Error('notes must be 2000 characters or less');
    err.statusCode = 400;
    throw err;
  }

  return notes;
};

const parseOptionalCategoryId = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const err = new Error('category_id must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  return numeric;
};

const ensureCategoryExists = async (categoryId) => {
  const result = await db.query(
    'SELECT category_id FROM categories WHERE category_id = $1',
    [categoryId]
  );

  if (result.rows.length === 0) {
    const err = new Error('category_id does not exist');
    err.statusCode = 400;
    throw err;
  }
};

const getCategoryByName = async (name) => {
  const normalized = toTrimmedString(name);
  if (!normalized) return null;

  const direct = await db.query(
    'SELECT category_id, name FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [normalized]
  );

  if (direct.rows[0]) {
    return {
      category_id: direct.rows[0].category_id,
      category_name: direct.rows[0].name,
      matched_by: 'direct',
    };
  }

  const collapsed = normalized.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!collapsed) return null;

  const normalizedMatch = await db.query(
    `SELECT category_id, name
     FROM categories
     WHERE regexp_replace(LOWER(name), '[^a-z0-9]+', '', 'g') = $1
     ORDER BY category_id ASC
     LIMIT 1`,
    [collapsed]
  );

  if (normalizedMatch.rows[0]) {
    return {
      category_id: normalizedMatch.rows[0].category_id,
      category_name: normalizedMatch.rows[0].name,
      matched_by: 'normalized',
    };
  }

  return null;
};

const getCategoryIdByName = async (name) => {
  const category = await getCategoryByName(name);
  return category?.category_id || null;
};

const hydrateTransaction = (row) => row || null;

const fetchTransactionById = async (userId, transactionId) => {
  const result = await db.query(
    `SELECT
      t.*,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.category_id
     WHERE t.transaction_id = $1 AND t.user_id = $2`,
    [transactionId, userId]
  );

  return hydrateTransaction(result.rows[0] || null);
};

const normalizeTopPredictions = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const category = toTrimmedString(item.category);
      const confidence = Number(item.confidence);

      if (!category || !Number.isFinite(confidence)) return null;
      return { category, confidence: Number(confidence.toFixed(4)) };
    })
    .filter(Boolean)
    .slice(0, 5);
};

const toNumericConfidence = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(4)) : null;
};

const toBooleanOrNull = (value) => {
  if (value === true || value === false) return value;
  return null;
};

const inferAmbiguous = ({ ambiguous, margin, topPredictions }) => {
  if (ambiguous === true) return true;
  if (ambiguous === false) return false;

  const numericMargin = toNumericConfidence(margin);
  if (numericMargin !== null) {
    return numericMargin < AMBIGUITY_MARGIN;
  }

  if (Array.isArray(topPredictions) && topPredictions.length > 1) {
    const gap = Number(topPredictions[0].confidence) - Number(topPredictions[1].confidence);
    if (Number.isFinite(gap)) {
      return gap < AMBIGUITY_MARGIN;
    }
  }

  return false;
};

const inferDirectionFromType = (type) => {
  const normalized = toTrimmedString(type).toLowerCase();
  return normalized === 'income' ? 'credit' : 'debit';
};

const callMlCategorizer = async ({
  description,
  merchant,
  amount,
  direction = 'unknown',
  source_bank = 'unknown',
  channel = 'unknown',
  has_fees = 0,
  has_tax = 0,
  is_credit_origin = 0,
  counterparty = '',
  recurring_flag = 0,
}) => {
  const mlResponse = await axios.post(
    `${ML_SERVICE_URL}/ml/categorize`,
    {
      description,
      merchant: merchant || '',
      amount: Number(amount),
      direction,
      source_bank,
      channel,
      has_fees: Number(has_fees) || 0,
      has_tax: Number(has_tax) || 0,
      is_credit_origin: Number(is_credit_origin) || 0,
      counterparty: counterparty || '',
      recurring_flag: Number(recurring_flag) || 0,
    },
    { timeout: 5000 }
  );

  const { category, confidence, source, top_predictions, margin, ambiguous, model_version } = mlResponse.data || {};
  const normalizedTopPredictions = normalizeTopPredictions(top_predictions);

  return {
    category: typeof category === 'string' ? category.trim() : '',
    confidence: toNumericConfidence(confidence),
    source: typeof source === 'string' ? source.trim() : 'model',
    top_predictions: normalizedTopPredictions,
    margin: toNumericConfidence(margin),
    ambiguous: toBooleanOrNull(ambiguous),
    model_version: toTrimmedString(model_version) || null,
  };
};

const normalizeCreatePayload = (body = {}) => {
  const merchant = toTrimmedString(body.merchant) || null;
  const rawDescription = toTrimmedString(body.description);
  const description = rawDescription || merchant || '';
  const sourceImportSessionId = toTrimmedString(body.source_import_session_id) || null;

  if (!description) {
    const err = new Error('description and amount are required');
    err.statusCode = 400;
    throw err;
  }

  if (description.length > 255) {
    const err = new Error('description must be 255 characters or less');
    err.statusCode = 400;
    throw err;
  }

  if (merchant && merchant.length > 150) {
    const err = new Error('merchant must be 150 characters or less');
    err.statusCode = 400;
    throw err;
  }

  return {
    description,
    merchant,
    amount: normalizeAmount(body.amount),
    type: normalizeType(body.type),
    date: normalizeDate(body.date, { allowDefaultToday: !sourceImportSessionId }),
    category_id: parseOptionalCategoryId(body.category_id),
    category_name: toTrimmedString(body.category_name) || null,
    notes: normalizeNotes(body.notes) ?? null,
    status: normalizeStatus(body.status),
    source: normalizeSource(body.source),
    source_import_session_id: sourceImportSessionId,
    source_reference_id: toTrimmedString(body.source_reference_id) || null,
    dedupe_fingerprint: toTrimmedString(body.dedupe_fingerprint) || null,
    source_bank: toTrimmedString(body.source_bank || body.source) || 'unknown',
    channel: toTrimmedString(body.channel) || 'unknown',
    has_fees: Number(body.has_fees) || 0,
    has_tax: Number(body.has_tax) || 0,
    is_credit_origin: Number(body.is_credit_origin) || 0,
    counterparty: toTrimmedString(body.counterparty) || '',
    recurring_flag: Number(body.recurring_flag) || 0,
    ml_confidence: toNumericConfidence(body.ml_confidence),
    ml_margin: toNumericConfidence(body.ml_margin),
    ml_ambiguous: toBooleanOrNull(body.ml_ambiguous),
    ml_source: toTrimmedString(body.ml_source) || null,
  };
};

const resolveCategoryForCreate = async ({
  userId,
  category_id,
  category_name,
  description,
  merchant,
  amount,
  type,
  source_bank,
  channel,
  has_fees,
  has_tax,
  is_credit_origin,
  counterparty,
  recurring_flag,
  ml_confidence,
  ml_margin,
  ml_ambiguous,
  ml_source,
}) => {
  if (category_id !== undefined) {
    if (category_id === null) {
      return {
        categoryId: null,
        mlConfidence: null,
        mlCategoryName: null,
        source: 'manual',
        mlMargin: null,
        mlAmbiguous: false,
        topPredictions: [],
        needsReview: false,
      };
    }

    await ensureCategoryExists(category_id);
    return {
      categoryId: category_id,
      mlConfidence: null,
      mlCategoryName: null,
      source: 'manual',
      mlMargin: null,
      mlAmbiguous: false,
      topPredictions: [],
      needsReview: false,
    };
  }

  const precomputedConfidence = toNumericConfidence(ml_confidence);
  const precomputedMargin = toNumericConfidence(ml_margin);
  const precomputedSource = toTrimmedString(ml_source) || null;
  const precomputedAmbiguous = inferAmbiguous({
    ambiguous: toBooleanOrNull(ml_ambiguous),
    margin: precomputedMargin,
    topPredictions: [],
  });

  if (category_name && precomputedSource) {
    const categoryId = await getCategoryIdByName(category_name);
    return {
      categoryId: categoryId || null,
      mlConfidence: precomputedConfidence,
      mlCategoryName: category_name,
      source: precomputedSource,
      mlMargin: precomputedMargin,
      mlAmbiguous: precomputedAmbiguous,
      topPredictions: [],
      needsReview:
        precomputedAmbiguous ||
        precomputedConfidence === null ||
        precomputedConfidence < CONFIDENCE_MEDIUM,
    };
  }

  if (category_name) {
    const categoryId = await getCategoryIdByName(category_name);
    if (categoryId) {
      return {
        categoryId,
        mlConfidence: null,
        mlCategoryName: category_name,
        source: 'manual',
        mlMargin: null,
        mlAmbiguous: false,
        topPredictions: [],
        needsReview: false,
      };
    }
  }

  try {
    const memoryMatch = await findBestMemoryMatch({
      userId,
      merchant,
      description,
      sourceBank: source_bank,
      channel,
      direction: inferDirectionFromType(type),
    });

    if (memoryMatch) {
      return {
        categoryId: memoryMatch.category_id,
        mlConfidence: memoryMatch.confidence,
        mlCategoryName: memoryMatch.category_name,
        source: 'override',
        mlMargin: null,
        mlAmbiguous: false,
        topPredictions: [
          {
            category: memoryMatch.category_name,
            confidence: Number(memoryMatch.confidence.toFixed(4)),
          },
        ],
        needsReview: false,
      };
    }

    const merchantRules = await loadMerchantCategoryRules(userId);
    const matchedRule = findMatchingMerchantRule({
      description,
      merchant,
      rules: merchantRules,
    });

    if (matchedRule) {
      return {
        categoryId: matchedRule.category_id,
        mlConfidence: matchedRule.confidence,
        mlCategoryName: matchedRule.category_name,
        source: 'user_rule',
        mlMargin: null,
        mlAmbiguous: false,
        topPredictions: [
          {
            category: matchedRule.category_name,
            confidence: Number(matchedRule.confidence.toFixed(4)),
          },
        ],
        needsReview: false,
      };
    }
  } catch (ruleErr) {
    console.warn('Override/rule lookup failed, falling back to ML:', ruleErr.message);
  }

  try {
    const {
      category,
      confidence,
      source,
      top_predictions,
      margin,
      ambiguous,
      model_version,
    } = await callMlCategorizer({
      description,
      merchant,
      amount,
      direction: inferDirectionFromType(type),
      source_bank,
      channel,
      has_fees,
      has_tax,
      is_credit_origin,
      counterparty,
      recurring_flag,
    });

    const normalizedTopPredictions = normalizeTopPredictions(top_predictions);
    const resolvedAmbiguous = inferAmbiguous({
      ambiguous,
      margin,
      topPredictions: normalizedTopPredictions,
    });

    if (!category) {
      return {
        categoryId: null,
        mlConfidence: null,
        mlCategoryName: null,
        source: source || 'model',
        mlMargin: toNumericConfidence(margin),
        mlAmbiguous: resolvedAmbiguous,
        topPredictions: normalizedTopPredictions,
        needsReview: true,
      };
    }

    const categoryId = await getCategoryIdByName(category);
    const normalizedConfidence = toNumericConfidence(confidence);
    const normalizedMargin = toNumericConfidence(margin);
    const normalizedSource = source || 'model';
    const highConfidenceModel =
      normalizedConfidence !== null &&
      normalizedConfidence >= CONFIDENCE_HIGH &&
      !resolvedAmbiguous;
    const assignableModel =
      normalizedConfidence !== null &&
      normalizedConfidence >= CONFIDENCE_MEDIUM &&
      !resolvedAmbiguous;
    const isRulePath = normalizedSource === 'rule' || normalizedSource === 'user_rule';

    return {
      categoryId: isRulePath || assignableModel ? categoryId || null : null,
      mlConfidence: normalizedConfidence,
      mlCategoryName: category,
      source: normalizedSource,
      mlMargin: normalizedMargin,
      mlAmbiguous: resolvedAmbiguous,
      topPredictions: normalizedTopPredictions,
      modelVersion: model_version,
      needsReview:
        !isRulePath &&
        (normalizedConfidence === null ||
          normalizedConfidence < CONFIDENCE_MEDIUM ||
          resolvedAmbiguous ||
          !highConfidenceModel),
    };
  } catch (mlErr) {
    console.warn('ML service unavailable, saving without category:', mlErr.message);
    return {
      categoryId: null,
      mlConfidence: null,
      mlCategoryName: null,
      source: 'unavailable',
      mlMargin: null,
      mlAmbiguous: false,
      topPredictions: [],
      needsReview: true,
    };
  }
};

const createTransaction = async (userId, rawPayload) => {
  const payload = normalizeCreatePayload(rawPayload);
  const resolved = await resolveCategoryForCreate({
    userId,
    ...payload,
  });

  const result = await db.query(
    `INSERT INTO transactions
      (user_id, category_id, description, merchant, amount, type, date, notes, status, source, ml_confidence, source_import_session_id, source_reference_id, dedupe_fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING transaction_id`,
    [
      userId,
      resolved.categoryId,
      payload.description,
      payload.merchant,
      payload.amount,
      payload.type,
      payload.date,
      payload.notes,
      payload.status,
      payload.source,
      resolved.mlConfidence,
      payload.source_import_session_id,
      payload.source_reference_id,
      payload.dedupe_fingerprint,
    ]
  );

  const transactionId = result.rows[0].transaction_id;
  const transaction = await fetchTransactionById(userId, transactionId);

  return {
    transaction,
    resolved,
  };
};

const normalizeUpdatePayload = (body = {}) => {
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = toTrimmedString(body.description);
    if (!description) {
      const err = new Error('description cannot be empty');
      err.statusCode = 400;
      throw err;
    }

    if (description.length > 255) {
      const err = new Error('description must be 255 characters or less');
      err.statusCode = 400;
      throw err;
    }

    updates.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'merchant')) {
    const merchant = toTrimmedString(body.merchant);
    if (merchant.length > 150) {
      const err = new Error('merchant must be 150 characters or less');
      err.statusCode = 400;
      throw err;
    }
    updates.merchant = merchant || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'amount')) {
    updates.amount = normalizeAmount(body.amount);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'type')) {
    updates.type = normalizeType(body.type);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'date')) {
    updates.date = normalizeDate(body.date, { allowDefaultToday: false });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'category_id')) {
    updates.category_id = parseOptionalCategoryId(body.category_id);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    updates.notes = normalizeNotes(body.notes);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    updates.status = normalizeStatus(body.status);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'source')) {
    updates.source = normalizeSource(body.source);
  }

  return updates;
};

const createTransactionsBatch = async (userId, items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('transactions must be a non-empty array');
    err.statusCode = 400;
    throw err;
  }

  if (items.length > MAX_BATCH_SIZE) {
    const err = new Error(`transactions batch cannot exceed ${MAX_BATCH_SIZE} items`);
    err.statusCode = 400;
    throw err;
  }

  const transactions = [];
  const errors = [];

  for (let index = 0; index < items.length; index += 1) {
    try {
      const created = await createTransaction(userId, items[index]);
      transactions.push(created.transaction);
    } catch (err) {
      errors.push({
        index,
        error: err.message || 'Failed to create transaction',
        statusCode: err.statusCode || 500,
      });
    }
  }

  return {
    total: items.length,
    created_count: transactions.length,
    failed_count: errors.length,
    transactions,
    errors,
  };
};

module.exports = {
  MAX_BATCH_SIZE,
  normalizeCreatePayload,
  normalizeUpdatePayload,
  ensureCategoryExists,
  fetchTransactionById,
  createTransaction,
  createTransactionsBatch,
  callMlCategorizer,
  normalizeTopPredictions,
};