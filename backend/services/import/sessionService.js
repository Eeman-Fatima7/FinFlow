const crypto = require('crypto');
const db = require('../../db/db');

const allowedStates = new Set([
  'uploaded',
  'detected',
  'extracted',
  'normalized',
  'categorized',
  'review_ready',
  'confirming',
  'completed',
  'failed',
  'cancelled',
]);

const createSessionId = () => crypto.randomBytes(16).toString('hex');

const createImportSession = async ({
  userId,
  fileName,
  mimeType,
  sourceType,
  sourceBank,
  parserName,
  detectionConfidence,
  state = 'uploaded',
  warnings = [],
  summary = {},
}) => {
  const importSessionId = createSessionId();

  await db.query(
    `INSERT INTO import_sessions
      (import_session_id, user_id, file_name, mime_type, source_type, source_bank, parser_name, detection_confidence, state, warnings, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)`,
    [
      importSessionId,
      userId,
      fileName,
      mimeType,
      sourceType,
      sourceBank || 'unknown',
      parserName || null,
      detectionConfidence ?? null,
      allowedStates.has(state) ? state : 'uploaded',
      JSON.stringify(warnings || []),
      JSON.stringify(summary || {}),
    ]
  );

  return importSessionId;
};

const setSessionState = async ({ sessionId, state, warnings, summary }) => {
  if (!allowedStates.has(state)) {
    throw new Error(`Invalid import session state: ${state}`);
  }

  await db.query(
    `UPDATE import_sessions
     SET state = $1,
         warnings = COALESCE($2::jsonb, warnings),
         summary = COALESCE($3::jsonb, summary),
         updated_at = NOW()
     WHERE import_session_id = $4`,
    [
      state,
      warnings ? JSON.stringify(warnings) : null,
      summary ? JSON.stringify(summary) : null,
      sessionId,
    ]
  );
};

const setSessionMetadata = async ({
  sessionId,
  sourceType,
  sourceBank,
  parserName,
  detectionConfidence,
}) => {
  await db.query(
    `UPDATE import_sessions
     SET source_type = $1,
         source_bank = $2,
         parser_name = $3,
         detection_confidence = $4,
         updated_at = NOW()
     WHERE import_session_id = $5`,
    [
      sourceType,
      sourceBank || 'unknown',
      parserName || null,
      detectionConfidence ?? null,
      sessionId,
    ]
  );
};

const replaceSessionRows = async ({ sessionId, rows }) => {
  await db.query('DELETE FROM import_session_rows WHERE import_session_id = $1', [sessionId]);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    await db.query(
      `INSERT INTO import_session_rows
        (import_session_id, row_index, raw_payload, normalized_payload, review_payload, extraction_confidence, needs_review, dedupe_fingerprint, dedupe_status, duplicate_reason, top_predictions, is_excluded)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11::jsonb, $12)`,
      [
        sessionId,
        index,
        JSON.stringify(row.raw_payload || {}),
        JSON.stringify(row.normalized_payload || {}),
        JSON.stringify(row.review_payload || {}),
        row.extraction_confidence ?? null,
        Boolean(row.needs_review),
        row.dedupe_fingerprint || null,
        row.dedupe_status || 'clear',
        row.duplicate_reason || null,
        JSON.stringify(row.top_predictions || []),
        Boolean(row.is_excluded),
      ]
    );
  }
};

const getImportSession = async ({ userId, sessionId }) => {
  const sessionResult = await db.query(
    `SELECT *
     FROM import_sessions
     WHERE import_session_id = $1
       AND user_id = $2`,
    [sessionId, userId]
  );

  if (sessionResult.rows.length === 0) return null;

  const rowsResult = await db.query(
    `SELECT *
     FROM import_session_rows
     WHERE import_session_id = $1
     ORDER BY row_index ASC`,
    [sessionId]
  );

  return {
    session: sessionResult.rows[0],
    rows: rowsResult.rows,
  };
};

const getLatestImportSessionSnapshotForUser = async ({ userId, rowLimit = 250 }) => {
  const safeRowLimit = Math.min(Math.max(Number(rowLimit) || 250, 1), 1000);

  const sessionResult = await db.query(
    `SELECT
       import_session_id,
       state,
       warnings,
       summary,
       created_at,
       updated_at
     FROM import_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (sessionResult.rows.length === 0) return null;

  const session = sessionResult.rows[0];

  const rowsResult = await db.query(
    `SELECT
      row_index,
      extraction_confidence,
      needs_review,
      dedupe_status,
      duplicate_reason,
      is_excluded,
      top_predictions,
      review_payload,
      normalized_payload
     FROM import_session_rows
     WHERE import_session_id = $1
     ORDER BY row_index ASC
     LIMIT $2`,
    [session.import_session_id, safeRowLimit]
  );

  return {
    session,
    rows: rowsResult.rows,
  };
};

const mergeSessionRows = async ({ sessionId, updates = [] }) => {
  for (const update of updates) {
    const rowIndex = Number(update.row_index);
    if (!Number.isInteger(rowIndex) || rowIndex < 0) continue;

    if (update.action === 'remove') {
      await db.query(
        `UPDATE import_session_rows
         SET is_excluded = TRUE,
             updated_at = NOW()
         WHERE import_session_id = $1
           AND row_index = $2`,
        [sessionId, rowIndex]
      );
      continue;
    }

    if (update.action === 'restore') {
      await db.query(
        `UPDATE import_session_rows
         SET is_excluded = FALSE,
             updated_at = NOW()
         WHERE import_session_id = $1
           AND row_index = $2`,
        [sessionId, rowIndex]
      );
      continue;
    }

    if (update.action === 'update' && update.patch && typeof update.patch === 'object') {
      const current = await db.query(
        `SELECT normalized_payload, review_payload
         FROM import_session_rows
         WHERE import_session_id = $1
           AND row_index = $2
         LIMIT 1`,
        [sessionId, rowIndex]
      );

      if (current.rows.length === 0) continue;

      const normalizedPayload = {
        ...(current.rows[0].normalized_payload || {}),
        ...update.patch,
      };

      const reviewPayload = {
        ...(current.rows[0].review_payload || {}),
        ...update.patch,
      };

      await db.query(
        `UPDATE import_session_rows
         SET normalized_payload = $1::jsonb,
             review_payload = $2::jsonb,
             updated_at = NOW()
         WHERE import_session_id = $3
           AND row_index = $4`,
        [JSON.stringify(normalizedPayload), JSON.stringify(reviewPayload), sessionId, rowIndex]
      );
    }
  }
};

module.exports = {
  createImportSession,
  setSessionState,
  setSessionMetadata,
  replaceSessionRows,
  getImportSession,
  getLatestImportSessionSnapshotForUser,
  mergeSessionRows,
};