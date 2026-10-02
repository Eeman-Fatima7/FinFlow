const db = require('../../db/db');

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeWhitespace = (value) => toTrimmedString(value).replace(/\s+/g, ' ');

const normalizeMerchantKey = (value) => normalizeWhitespace(value).toUpperCase();

const normalizeScopeToken = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'unknown' || normalized === 'n/a' || normalized === 'na') return null;
  return normalized;
};

const normalizeDirection = (value) => {
  const normalized = normalizeScopeToken(value);
  if (!normalized) return null;
  if (normalized === 'income' || normalized === 'credit') return 'credit';
  if (normalized === 'expense' || normalized === 'debit') return 'debit';
  return null;
};

const buildLookupKeys = ({ merchant, description }) => {
  const keys = [normalizeMerchantKey(merchant), normalizeMerchantKey(description)].filter(Boolean);
  return [...new Set(keys)];
};

const scopeMatches = (expected, actual) => {
  if (!expected) return true;
  return expected === actual;
};

const scopeSpecificityScore = (value) => (value ? 1 : 0);

const computeEvidenceScore = (row) => {
  const corrections = Number(row.correction_count || 0);
  const confirmations = Number(row.confirmation_count || 0);
  const total = Number(row.total_evidence_count || 0);

  return corrections * 4 + confirmations * 2 + total * 0.5;
};

const computeMatchScore = (row) => {
  const specificity =
    scopeSpecificityScore(row.source_bank) * 3 +
    scopeSpecificityScore(row.channel) * 2 +
    scopeSpecificityScore(row.direction) * 2;

  return computeEvidenceScore(row) + specificity;
};

const mapMemoryRow = (row) => {
  const correctionCount = Number(row.correction_count || 0);
  const confirmationCount = Number(row.confirmation_count || 0);
  const totalEvidence = Number(row.total_evidence_count || 0);
  const confidence = Math.min(1, Number((0.55 + correctionCount * 0.08 + confirmationCount * 0.04).toFixed(4)));

  return {
    memory_id: Number(row.memory_id),
    user_id: Number(row.user_id),
    normalized_merchant: row.normalized_merchant,
    pattern: row.pattern,
    category_id: Number(row.category_id),
    category_name: row.category_name,
    source_bank: row.source_bank,
    channel: row.channel,
    direction: row.direction,
    correction_count: correctionCount,
    confirmation_count: confirmationCount,
    total_evidence_count: totalEvidence,
    confidence,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_seen_at: row.last_seen_at,
    last_feedback_event_id: row.last_feedback_event_id ? Number(row.last_feedback_event_id) : null,
    source: 'override',
  };
};

const getMemoryById = async (memoryId) => {
  const result = await db.query(
    `SELECT
      m.memory_id,
      m.user_id,
      m.normalized_merchant,
      m.pattern,
      m.category_id,
      m.source_bank,
      m.channel,
      m.direction,
      m.correction_count,
      m.confirmation_count,
      m.total_evidence_count,
      m.created_at,
      m.updated_at,
      m.last_seen_at,
      m.last_feedback_event_id,
      c.name AS category_name
     FROM merchant_pattern_memory m
     JOIN categories c ON c.category_id = m.category_id
     WHERE m.memory_id = $1
     LIMIT 1`,
    [memoryId]
  );

  return result.rows[0] ? mapMemoryRow(result.rows[0]) : null;
};

const findBestMemoryMatch = async ({
  userId,
  merchant,
  description,
  sourceBank,
  channel,
  direction,
}) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) return null;

  const lookupKeys = buildLookupKeys({ merchant, description });
  if (lookupKeys.length === 0) return null;

  const normalizedSourceBank = normalizeScopeToken(sourceBank);
  const normalizedChannel = normalizeScopeToken(channel);
  const normalizedDirection = normalizeDirection(direction);

  const result = await db.query(
    `SELECT
      m.memory_id,
      m.user_id,
      m.normalized_merchant,
      m.pattern,
      m.category_id,
      m.source_bank,
      m.channel,
      m.direction,
      m.correction_count,
      m.confirmation_count,
      m.total_evidence_count,
      m.created_at,
      m.updated_at,
      m.last_seen_at,
      m.last_feedback_event_id,
      c.name AS category_name
     FROM merchant_pattern_memory m
     JOIN categories c ON c.category_id = m.category_id
     WHERE m.user_id = $1
       AND m.is_active = TRUE
       AND m.normalized_merchant = ANY($2::text[])
     ORDER BY m.updated_at DESC`,
    [numericUserId, lookupKeys]
  );

  let best = null;

  for (const row of result.rows) {
    if (!scopeMatches(row.source_bank, normalizedSourceBank)) continue;
    if (!scopeMatches(row.channel, normalizedChannel)) continue;
    if (!scopeMatches(row.direction, normalizedDirection)) continue;

    const score = computeMatchScore(row);

    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  if (!best) return null;

  const mapped = mapMemoryRow(best.row);
  return {
    ...mapped,
    match_score: best.score,
  };
};

const selectExistingMemory = async ({
  userId,
  normalizedMerchant,
  sourceBank,
  channel,
  direction,
}) => {
  const result = await db.query(
    `SELECT memory_id, category_id, correction_count, confirmation_count, total_evidence_count
     FROM merchant_pattern_memory
     WHERE user_id = $1
       AND normalized_merchant = $2
       AND COALESCE(source_bank, '') = COALESCE($3, '')
       AND COALESCE(channel, '') = COALESCE($4, '')
       AND COALESCE(direction, '') = COALESCE($5, '')
     LIMIT 1`,
    [userId, normalizedMerchant, sourceBank, channel, direction]
  );

  return result.rows[0] || null;
};

const resolveNextCategoryId = ({ existing, categoryId, signalType }) => {
  const incoming = Number(categoryId);
  if (!Number.isInteger(incoming) || incoming <= 0) return null;

  if (!existing) return incoming;

  const current = Number(existing.category_id);
  if (!Number.isInteger(current) || current <= 0) return incoming;
  if (current === incoming) return current;

  if (signalType === 'correction') return incoming;
  if (signalType === 'confirmation') return current;
  if (signalType === 'label') return incoming;

  return current;
};

const upsertMemoryFromFeedback = async ({
  userId,
  merchant,
  description,
  categoryId,
  sourceBank,
  channel,
  direction,
  signalType,
  feedbackEventId,
  metadata,
}) => {
  const numericUserId = Number(userId);
  const numericCategoryId = Number(categoryId);

  if (!Number.isInteger(numericUserId) || numericUserId <= 0) return null;
  if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) return null;

  const normalizedMerchant = normalizeMerchantKey(merchant) || normalizeMerchantKey(description);
  if (!normalizedMerchant) return null;

  const normalizedSourceBank = normalizeScopeToken(sourceBank);
  const normalizedChannel = normalizeScopeToken(channel);
  const normalizedDirection = normalizeDirection(direction);

  const safeSignalType = signalType === 'correction' || signalType === 'confirmation' || signalType === 'label'
    ? signalType
    : 'label';

  const correctionIncrement = safeSignalType === 'correction' ? 1 : 0;
  const confirmationIncrement = safeSignalType === 'confirmation' ? 1 : 0;
  const metadataJson = JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {});

  const existing = await selectExistingMemory({
    userId: numericUserId,
    normalizedMerchant,
    sourceBank: normalizedSourceBank,
    channel: normalizedChannel,
    direction: normalizedDirection,
  });

  if (!existing) {
    const insertResult = await db.query(
      `INSERT INTO merchant_pattern_memory (
        user_id,
        normalized_merchant,
        pattern,
        category_id,
        source_bank,
        channel,
        direction,
        correction_count,
        confirmation_count,
        total_evidence_count,
        last_seen_at,
        last_corrected_at,
        last_confirmed_at,
        last_feedback_event_id,
        is_active,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, 1,
        NOW(),
        CASE WHEN $8 > 0 THEN NOW() ELSE NULL END,
        CASE WHEN $9 > 0 THEN NOW() ELSE NULL END,
        $10,
        TRUE,
        $11::jsonb,
        NOW(),
        NOW()
      )
      RETURNING memory_id`,
      [
        numericUserId,
        normalizedMerchant,
        normalizedMerchant,
        numericCategoryId,
        normalizedSourceBank,
        normalizedChannel,
        normalizedDirection,
        correctionIncrement,
        confirmationIncrement,
        feedbackEventId ? Number(feedbackEventId) : null,
        metadataJson,
      ]
    );

    return getMemoryById(insertResult.rows[0].memory_id);
  }

  const nextCategoryId = resolveNextCategoryId({
    existing,
    categoryId: numericCategoryId,
    signalType: safeSignalType,
  });

  await db.query(
    `UPDATE merchant_pattern_memory
     SET
       category_id = $2,
       correction_count = correction_count + $3,
       confirmation_count = confirmation_count + $4,
       total_evidence_count = total_evidence_count + 1,
       last_seen_at = NOW(),
       last_corrected_at = CASE WHEN $3 > 0 THEN NOW() ELSE last_corrected_at END,
       last_confirmed_at = CASE WHEN $4 > 0 THEN NOW() ELSE last_confirmed_at END,
       last_feedback_event_id = COALESCE($5, last_feedback_event_id),
       is_active = TRUE,
       metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
       updated_at = NOW()
     WHERE memory_id = $1`,
    [
      Number(existing.memory_id),
      nextCategoryId || numericCategoryId,
      correctionIncrement,
      confirmationIncrement,
      feedbackEventId ? Number(feedbackEventId) : null,
      metadataJson,
    ]
  );

  return getMemoryById(Number(existing.memory_id));
};

module.exports = {
  normalizeMerchantKey,
  normalizeScopeToken,
  normalizeDirection,
  findBestMemoryMatch,
  upsertMemoryFromFeedback,
};
