const axios = require('axios');
const { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, AMBIGUITY_MARGIN } = require('../../config/mlConfig');
const { logServiceEvent } = require('../observability/eventLogger');
const {
  loadMerchantCategoryRules,
  findMatchingMerchantRule,
} = require('../transactions/merchantCategoryRuleService');
const { findBestMemoryMatch } = require('../transactions/merchantPatternMemoryService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const toNumericConfidence = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toBooleanOrNull = (value) => {
  if (value === true || value === false) return value;
  return null;
};

const normalizeTopPredictions = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const category = toTrimmedString(item.category);
      const confidence = Number(item.confidence);

      if (!category || !Number.isFinite(confidence)) return null;

      return {
        category,
        confidence: Number(confidence.toFixed(4)),
      };
    })
    .filter(Boolean)
    .slice(0, 5);
};

const isRuleSource = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  return normalized === 'rule' || normalized === 'user_rule' || normalized === 'override';
};

const resolveDirection = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'income' || normalized === 'credit') return 'credit';
  if (normalized === 'expense' || normalized === 'debit') return 'debit';
  return null;
};

const buildMlRequest = (review = {}) => {
  const description =
    toTrimmedString(review.description) ||
    toTrimmedString(review.description_raw) ||
    toTrimmedString(review.merchant) ||
    'Imported transaction';

  const merchant = toTrimmedString(review.merchant || review.counterparty);
  const amount = Number(review.amount);

  return {
    description,
    merchant,
    amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
    direction: toTrimmedString(review.direction) || 'unknown',
    source_bank: toTrimmedString(review.source_bank) || 'unknown',
    channel: toTrimmedString(review.channel) || 'unknown',
    has_fees: Number(review.fees) || 0,
    has_tax: Number(review.tax) || 0,
    is_credit_origin: toTrimmedString(review.direction).toLowerCase() === 'credit' ? 1 : 0,
    counterparty: toTrimmedString(review.counterparty),
    recurring_flag: Number(review.recurring_flag) || 0,
  };
};

const enrichRowsWithCategories = async ({ userId, rows = [], correlationId = null }) => {
  const warnings = [];
  const startedAt = Date.now();

  const pushWarning = (message) => {
    const text = toTrimmedString(message);
    if (!text) return;
    if (warnings.includes(text)) return;
    warnings.push(text);
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    logServiceEvent({
      service: 'import.categorization',
      operation: 'enrich_rows_with_categories',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      details: {
        user_id: Number.isInteger(Number(userId)) ? Number(userId) : null,
        total_rows: 0,
        memory_matches: 0,
        rule_matches: 0,
        ml_requests: 0,
        ml_rows: 0,
      },
      requestLike: correlationId ? { correlationId } : null,
    });

    return { rows: [], warnings };
  }

  const metrics = {
    totalRows: rows.length,
    memoryMatches: 0,
    ruleMatches: 0,
    mlRows: 0,
  };

  const updatedRows = rows.map((row) => ({
    ...row,
    review_payload: {
      ...(row.review_payload || {}),
    },
  }));

  let merchantRules = [];
  if (Number.isInteger(Number(userId)) && Number(userId) > 0) {
    try {
      merchantRules = await loadMerchantCategoryRules(Number(userId));
    } catch (ruleErr) {
      pushWarning('Merchant category rules unavailable during import preview');
    }
  }

  const pending = [];

  for (let index = 0; index < updatedRows.length; index += 1) {
    const row = updatedRows[index];
    const review = row.review_payload || {};
    const hasFinalCategory = Boolean(toTrimmedString(review.category_final));

    if (hasFinalCategory) {
      continue;
    }

    const memoryMatch = await findBestMemoryMatch({
      userId,
      merchant: review.merchant || review.counterparty,
      description: review.description || review.description_raw,
      sourceBank: review.source_bank,
      channel: review.channel,
      direction: resolveDirection(review.direction),
    });

    if (memoryMatch) {
      metrics.memoryMatches += 1;

      review.ml_predicted_category = memoryMatch.category_name;
      review.ml_confidence = Number(memoryMatch.confidence.toFixed(4));
      review.ml_source = 'override';
      review.ml_margin = null;
      review.ml_ambiguous = false;
      review.category_final = memoryMatch.category_name;
      review.top_predictions = [
        {
          category: memoryMatch.category_name,
          confidence: Number(memoryMatch.confidence.toFixed(4)),
        },
      ];
      review.needs_review = false;

      updatedRows[index].review_payload = review;
      updatedRows[index].top_predictions = review.top_predictions;
      updatedRows[index].normalized_payload = {
        ...(updatedRows[index].normalized_payload || {}),
        category_name: memoryMatch.category_name,
        ml_confidence: review.ml_confidence,
        ml_margin: review.ml_margin,
        ml_ambiguous: review.ml_ambiguous,
        ml_source: review.ml_source,
        top_predictions: review.top_predictions,
      };
      continue;
    }

    const matchedRule = findMatchingMerchantRule({
      description: review.description || review.description_raw,
      merchant: review.merchant || review.counterparty,
      rules: merchantRules,
    });

    if (matchedRule) {
      metrics.ruleMatches += 1;

      review.ml_predicted_category = matchedRule.category_name;
      review.ml_confidence = Number(matchedRule.confidence.toFixed(4));
      review.ml_source = 'user_rule';
      review.ml_margin = null;
      review.ml_ambiguous = false;
      review.category_final = matchedRule.category_name;
      review.top_predictions = [
        {
          category: matchedRule.category_name,
          confidence: Number(matchedRule.confidence.toFixed(4)),
        },
      ];
      review.needs_review = false;

      updatedRows[index].review_payload = review;
      updatedRows[index].top_predictions = review.top_predictions;
      updatedRows[index].normalized_payload = {
        ...(updatedRows[index].normalized_payload || {}),
        category_name: matchedRule.category_name,
        ml_confidence: review.ml_confidence,
        ml_margin: review.ml_margin,
        ml_ambiguous: review.ml_ambiguous,
        ml_source: review.ml_source,
        top_predictions: review.top_predictions,
      };
      continue;
    }

    pending.push({
      index,
      request: buildMlRequest(review),
    });
  }

  metrics.mlRows = pending.length;

  if (pending.length === 0) {
    logServiceEvent({
      service: 'import.categorization',
      operation: 'enrich_rows_with_categories',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      details: {
        user_id: Number.isInteger(Number(userId)) ? Number(userId) : null,
        total_rows: metrics.totalRows,
        memory_matches: metrics.memoryMatches,
        rule_matches: metrics.ruleMatches,
        ml_requests: 0,
        ml_rows: metrics.mlRows,
        warning_count: warnings.length,
      },
      requestLike: correlationId ? { correlationId } : null,
    });

    return { rows: updatedRows, warnings };
  }

  let response;
  try {
    response = await axios.post(
      `${ML_SERVICE_URL}/ml/categorize/batch`,
      pending.map((item) => item.request),
      {
        timeout: 10000,
        headers: correlationId ? { 'x-correlation-id': correlationId } : undefined,
      }
    );
  } catch (err) {
    pushWarning('ML categorization service unavailable during import preview');

    logServiceEvent({
      service: 'import.categorization',
      operation: 'ml_categorize_batch',
      status: 'error',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      error: err,
      details: {
        user_id: Number.isInteger(Number(userId)) ? Number(userId) : null,
        total_rows: metrics.totalRows,
        memory_matches: metrics.memoryMatches,
        rule_matches: metrics.ruleMatches,
        ml_requests: 1,
        ml_rows: metrics.mlRows,
        warning_count: warnings.length,
      },
      requestLike: correlationId ? { correlationId } : null,
    });

    return { rows: updatedRows, warnings };
  }

  const batchResults = Array.isArray(response.data?.results) ? response.data.results : [];

  pending.forEach((item, resultIndex) => {
    const result = batchResults[resultIndex] || {};
    const review = updatedRows[item.index].review_payload || {};

    const predictedCategory = toTrimmedString(result.category);
    const confidence = toNumericConfidence(result.confidence);
    const source = toTrimmedString(result.source) || 'model';
    const modelVersion = toTrimmedString(result.model_version) || null;
    const topPredictions = normalizeTopPredictions(result.top_predictions);
    const margin = toNumericConfidence(result.margin);
    const ambiguousFromModel = toBooleanOrNull(result.ambiguous);

    const inferredAmbiguous =
      ambiguousFromModel === null && topPredictions.length > 1
        ? Number(topPredictions[0].confidence) - Number(topPredictions[1].confidence) < AMBIGUITY_MARGIN
        : false;
    const isAmbiguous = ambiguousFromModel === true || inferredAmbiguous;

    review.ml_predicted_category = predictedCategory || null;
    review.ml_confidence = confidence;
    review.ml_source = source;
    review.ml_margin = margin;
    review.ml_ambiguous = isAmbiguous;
    review.model_version = modelVersion;
    review.top_predictions = topPredictions;

    const hasFinalCategory = Boolean(toTrimmedString(review.category_final));
    if (!hasFinalCategory && predictedCategory) {
      const highConfidenceModel = confidence !== null && confidence >= CONFIDENCE_HIGH;
      if (isRuleSource(source) || (highConfidenceModel && !isAmbiguous)) {
        review.category_final = predictedCategory;
      }
    }

    const existingWarnings = Array.isArray(review.warnings) ? review.warnings : [];
    const nextWarnings = [...existingWarnings];

    if (confidence !== null && confidence < CONFIDENCE_MEDIUM) {
      if (!nextWarnings.includes('Low confidence ML category prediction')) {
        nextWarnings.push('Low confidence ML category prediction');
      }
      review.needs_review = true;
    }

    if (isAmbiguous) {
      if (!nextWarnings.includes('Ambiguous ML category prediction')) {
        nextWarnings.push('Ambiguous ML category prediction');
      }
      review.needs_review = true;
    }

    if (!toTrimmedString(review.category_final)) {
      review.needs_review = true;
    } else if (review.needs_review !== true) {
      review.needs_review = false;
    }

    review.warnings = nextWarnings;

    updatedRows[item.index].review_payload = review;
    updatedRows[item.index].top_predictions = topPredictions;
    updatedRows[item.index].normalized_payload = {
      ...(updatedRows[item.index].normalized_payload || {}),
      category_name:
        toTrimmedString(review.category_final || review.extracted_category || review.ml_predicted_category) ||
        null,
      ml_confidence: review.ml_confidence,
      ml_margin: review.ml_margin,
      ml_ambiguous: review.ml_ambiguous,
      ml_source: review.ml_source,
      top_predictions: topPredictions,
      model_version: modelVersion,
    };
    updatedRows[item.index].needs_review = Boolean(review.needs_review || updatedRows[item.index].needs_review);
  });

  logServiceEvent({
    service: 'import.categorization',
    operation: 'ml_categorize_batch',
    status: 'ok',
    latencyMs: Date.now() - startedAt,
    fallbackUsed: false,
    details: {
      user_id: Number.isInteger(Number(userId)) ? Number(userId) : null,
      total_rows: metrics.totalRows,
      memory_matches: metrics.memoryMatches,
      rule_matches: metrics.ruleMatches,
      ml_requests: 1,
      ml_rows: metrics.mlRows,
      warning_count: warnings.length,
    },
    requestLike: correlationId ? { correlationId } : null,
  });

  return {
    rows: updatedRows,
    warnings,
  };
};

module.exports = {
  enrichRowsWithCategories,
};
