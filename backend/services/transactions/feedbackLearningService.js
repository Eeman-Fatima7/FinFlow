const crypto = require('crypto');
const db = require('../../db/db');
const {
  normalizeMerchantKey,
  normalizeScopeToken,
  normalizeDirection,
  upsertMemoryFromFeedback,
} = require('./merchantPatternMemoryService');

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeWhitespace = (value) => toTrimmedString(value).replace(/\s+/g, ' ');

const normalizeDescription = (value) => normalizeWhitespace(value).toLowerCase();

const normalizeSourceLabel = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  return normalized || null;
};

const toNumberOrNull = (value, digits = 4) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(digits));
};

const toBooleanOrNull = (value) => {
  if (value === true || value === false) return value;
  return null;
};

const normalizeCategoryName = (value) => {
  const normalized = normalizeWhitespace(value);
  return normalized || null;
};

const getCategoryByName = async (name) => {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return null;

  const result = await db.query(
    'SELECT category_id, name FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [normalized]
  );

  return result.rows[0] || null;
};

const resolveCategory = async ({ categoryId, categoryName }) => {
  const numericId = Number(categoryId);
  if (Number.isInteger(numericId) && numericId > 0) {
    const result = await db.query(
      'SELECT category_id, name FROM categories WHERE category_id = $1 LIMIT 1',
      [numericId]
    );
    if (result.rows[0]) return result.rows[0];
  }

  return getCategoryByName(categoryName);
};

const classifyFeedbackKind = ({
  interactionKind,
  predictedCategoryName,
  finalCategoryName,
}) => {
  const normalizedInteraction = toTrimmedString(interactionKind).toLowerCase();

  if (normalizedInteraction === 'post_save_edit') {
    return {
      feedbackKind: 'post_save_edit',
      signalType: 'correction',
    };
  }

  if (normalizedInteraction === 'manual_labeling') {
    return {
      feedbackKind: 'manual_labeling',
      signalType: 'label',
    };
  }

  const predicted = normalizeCategoryName(predictedCategoryName);
  const final = normalizeCategoryName(finalCategoryName);

  if (predicted && final && predicted.toLowerCase() === final.toLowerCase()) {
    return {
      feedbackKind: 'explicit_confirmation',
      signalType: 'confirmation',
    };
  }

  return {
    feedbackKind: 'explicit_correction',
    signalType: 'correction',
  };
};

const buildEventHash = ({
  userId,
  transactionId,
  importSessionId,
  rowIndex,
  feedbackKind,
  predictedCategoryName,
  finalCategoryName,
  normalizedMerchant,
  normalizedDescription,
  amount,
}) => {
  const signature = [
    Number(userId) || '',
    Number(transactionId) || '',
    toTrimmedString(importSessionId),
    Number.isInteger(Number(rowIndex)) ? Number(rowIndex) : '',
    feedbackKind,
    normalizeCategoryName(predictedCategoryName) || '',
    normalizeCategoryName(finalCategoryName) || '',
    normalizeMerchantKey(normalizedMerchant || ''),
    normalizeDescription(normalizedDescription || ''),
    toNumberOrNull(amount, 2) ?? '',
  ].join('|');

  return crypto.createHash('sha256').update(signature).digest('hex');
};

const insertFeedbackEvent = async ({
  userId,
  transactionId,
  importSessionId,
  rowIndex,
  feedbackKind,
  signalType,
  predictedCategory,
  finalCategory,
  predictedConfidence,
  predictedSource,
  predictedMargin,
  predictedAmbiguous,
  merchant,
  description,
  amount,
  direction,
  sourceBank,
  channel,
  modelVersion,
  overrideSource,
  overrideRuleId,
  overrideMetadata,
  metadata,
  eventHash,
}) => {
  const metadataJson = JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {});
  const overrideMetadataJson = JSON.stringify(
    overrideMetadata && typeof overrideMetadata === 'object' ? overrideMetadata : {}
  );
  const normalizedPredictedSource = normalizeSourceLabel(predictedSource);

  if (eventHash) {
    const existing = await db.query(
      `SELECT feedback_event_id
       FROM category_feedback_events
       WHERE event_hash = $1
       LIMIT 1`,
      [eventHash]
    );

    if (existing.rows[0]) {
      const existingId = Number(existing.rows[0].feedback_event_id);
      await db.query(
        `UPDATE category_feedback_events
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
         WHERE feedback_event_id = $1`,
        [existingId, metadataJson]
      );
      return existingId;
    }
  }

  const result = await db.query(
    `INSERT INTO category_feedback_events (
      user_id,
      transaction_id,
      import_session_id,
      row_index,
      feedback_kind,
      signal_type,
      predicted_category_id,
      predicted_category_name,
      predicted_confidence,
      predicted_source,
      predicted_margin,
      predicted_ambiguous,
      final_category_id,
      final_category_name,
      merchant,
      normalized_merchant,
      description,
      normalized_description,
      amount,
      direction,
      source_bank,
      channel,
      model_version,
      override_source,
      override_rule_id,
      override_metadata,
      metadata,
      event_hash,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24,
      $25, $26::jsonb, $27::jsonb, $28, NOW()
    )
    RETURNING feedback_event_id`,
    [
      Number(userId),
      Number.isInteger(Number(transactionId)) ? Number(transactionId) : null,
      toTrimmedString(importSessionId) || null,
      Number.isInteger(Number(rowIndex)) ? Number(rowIndex) : null,
      feedbackKind,
      signalType,
      predictedCategory ? Number(predictedCategory.category_id) : null,
      predictedCategory ? predictedCategory.name : null,
      toNumberOrNull(predictedConfidence),
      normalizedPredictedSource,
      toNumberOrNull(predictedMargin),
      toBooleanOrNull(predictedAmbiguous),
      finalCategory ? Number(finalCategory.category_id) : null,
      finalCategory ? finalCategory.name : null,
      toTrimmedString(merchant) || null,
      normalizeMerchantKey(merchant) || null,
      toTrimmedString(description) || null,
      normalizeDescription(description) || null,
      toNumberOrNull(amount, 2),
      normalizeDirection(direction),
      normalizeScopeToken(sourceBank),
      normalizeScopeToken(channel),
      toTrimmedString(modelVersion) || null,
      toTrimmedString(overrideSource) || null,
      Number.isInteger(Number(overrideRuleId)) ? Number(overrideRuleId) : null,
      overrideMetadataJson,
      metadataJson,
      eventHash || null,
    ]
  );

  return result.rows[0] ? Number(result.rows[0].feedback_event_id) : null;
};

const recordFeedbackEvent = async ({
  userId,
  transactionId,
  importSessionId,
  rowIndex,
  interactionKind,
  predictedCategoryId,
  predictedCategoryName,
  finalCategoryId,
  finalCategoryName,
  predictedConfidence,
  predictedSource,
  predictedMargin,
  predictedAmbiguous,
  merchant,
  description,
  amount,
  direction,
  sourceBank,
  channel,
  modelVersion,
  overrideSource,
  overrideRuleId,
  overrideMetadata,
  metadata,
}) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) return null;

  const resolvedFinalCategory = await resolveCategory({
    categoryId: finalCategoryId,
    categoryName: finalCategoryName,
  });

  if (!resolvedFinalCategory) return null;

  const resolvedPredictedCategory = await resolveCategory({
    categoryId: predictedCategoryId,
    categoryName: predictedCategoryName,
  });

  const normalizedPredictedName = resolvedPredictedCategory?.name || normalizeCategoryName(predictedCategoryName);
  const normalizedFinalName = resolvedFinalCategory.name;

  const normalizedPredictedSource = normalizeSourceLabel(predictedSource);

  const { feedbackKind, signalType } = classifyFeedbackKind({
    interactionKind,
    predictedCategoryName: normalizedPredictedName,
    finalCategoryName: normalizedFinalName,
  });

  const normalizedMerchant = toTrimmedString(merchant);
  const normalizedDescriptionText = toTrimmedString(description);

  const eventHash = buildEventHash({
    userId: numericUserId,
    transactionId,
    importSessionId,
    rowIndex,
    feedbackKind,
    predictedCategoryName: normalizedPredictedName,
    finalCategoryName: normalizedFinalName,
    normalizedMerchant,
    normalizedDescription: normalizedDescriptionText,
    amount,
  });

  const feedbackEventId = await insertFeedbackEvent({
    userId: numericUserId,
    transactionId,
    importSessionId,
    rowIndex,
    feedbackKind,
    signalType,
    predictedCategory: resolvedPredictedCategory,
    finalCategory: resolvedFinalCategory,
    predictedConfidence,
    predictedSource: normalizedPredictedSource,
    predictedMargin,
    predictedAmbiguous,
    merchant: normalizedMerchant,
    description: normalizedDescriptionText,
    amount,
    direction,
    sourceBank,
    channel,
    modelVersion,
    overrideSource,
    overrideRuleId,
    overrideMetadata,
    metadata,
    eventHash,
  });

  const memory = await upsertMemoryFromFeedback({
    userId: numericUserId,
    merchant: normalizedMerchant,
    description: normalizedDescriptionText,
    categoryId: resolvedFinalCategory.category_id,
    sourceBank,
    channel,
    direction,
    signalType,
    feedbackEventId,
    metadata: {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      feedback_kind: feedbackKind,
      signal_type: signalType,
    },
  });

  return {
    feedback_event_id: feedbackEventId,
    feedback_kind: feedbackKind,
    signal_type: signalType,
    predicted_category: normalizedPredictedName || null,
    final_category: normalizedFinalName,
    memory_id: memory?.memory_id || null,
  };
};

const buildImportFeedbackCandidates = ({ rows = [] }) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const candidates = [];

  rows.forEach((row) => {
    if (!row || row.is_excluded) return;

    const categoryFinal = normalizeCategoryName(row.category_final);
    const categoryPredicted = normalizeCategoryName(row.category_predicted);
    const merchant = normalizeWhitespace(row.merchant);
    const description = normalizeWhitespace(row.description);

    if (!categoryFinal) return;

    const categoryTouched = Boolean(row.category_touched);

    if (categoryPredicted) {
      if (!categoryTouched) return;

      const sameCategory = categoryPredicted.toLowerCase() === categoryFinal.toLowerCase();

      candidates.push({
        interactionKind: sameCategory ? 'explicit_confirmation' : 'explicit_correction',
        category_final: categoryFinal,
        category_predicted: categoryPredicted,
        merchant: merchant || null,
        description: description || null,
        amount: toNumberOrNull(row.amount, 2),
        direction: normalizeDirection(row.type || row.direction),
        source_bank: normalizeScopeToken(row.source_bank || row.source),
        channel: normalizeScopeToken(row.channel),
        ml_confidence: toNumberOrNull(row.ml_confidence),
        ml_source: toTrimmedString(row.ml_source) || null,
        ml_margin: toNumberOrNull(row.ml_margin),
        ml_ambiguous: toBooleanOrNull(row.ml_ambiguous),
        model_version: toTrimmedString(row.model_version) || null,
        row_index: Number.isInteger(Number(row.__row_index)) ? Number(row.__row_index) : null,
      });
      return;
    }

    if (!categoryTouched) return;

    candidates.push({
      interactionKind: 'manual_labeling',
      category_final: categoryFinal,
      category_predicted: null,
      merchant: merchant || null,
      description: description || null,
      amount: toNumberOrNull(row.amount, 2),
      direction: normalizeDirection(row.type || row.direction),
      source_bank: normalizeScopeToken(row.source_bank || row.source),
      channel: normalizeScopeToken(row.channel),
      ml_confidence: toNumberOrNull(row.ml_confidence),
      ml_source: toTrimmedString(row.ml_source) || null,
      ml_margin: toNumberOrNull(row.ml_margin),
      ml_ambiguous: toBooleanOrNull(row.ml_ambiguous),
      model_version: toTrimmedString(row.model_version) || null,
      row_index: Number.isInteger(Number(row.__row_index)) ? Number(row.__row_index) : null,
    });
  });

  return candidates;
};

const recordImportFeedbackEvents = async ({
  userId,
  importSessionId,
  candidates = [],
  metadata,
}) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const results = [];

  for (const candidate of candidates) {
    const event = await recordFeedbackEvent({
      userId,
      importSessionId,
      rowIndex: candidate.row_index,
      interactionKind: candidate.interactionKind,
      predictedCategoryName: candidate.category_predicted,
      finalCategoryName: candidate.category_final,
      predictedConfidence: candidate.ml_confidence,
      predictedSource: candidate.ml_source,
      predictedMargin: candidate.ml_margin,
      predictedAmbiguous: candidate.ml_ambiguous,
      modelVersion: candidate.model_version,
      merchant: candidate.merchant,
      description: candidate.description,
      amount: candidate.amount,
      direction: candidate.direction,
      sourceBank: candidate.source_bank,
      channel: candidate.channel,
      metadata,
    });

    if (event) results.push(event);
  }

  return results;
};

module.exports = {
  normalizeDescription,
  classifyFeedbackKind,
  buildImportFeedbackCandidates,
  recordFeedbackEvent,
  recordImportFeedbackEvents,
};
