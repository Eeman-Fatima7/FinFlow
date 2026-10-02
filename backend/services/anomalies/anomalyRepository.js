const crypto = require('crypto');
const db = require('../../db/db');
const { ORDERED_SEVERITY } = require('./anomalyTypes');

const VALID_STATUSES = new Set(['active', 'read', 'dismissed', 'resolved']);
const VALID_SCOPES = new Set(['transaction', 'month']);
const VALID_SEVERITY = new Set(['low', 'medium', 'high']);

const normalizeStatus = (value, fallback = 'active') => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return VALID_STATUSES.has(normalized) ? normalized : fallback;
};

const normalizeScope = (value, fallback = 'transaction') => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return VALID_SCOPES.has(normalized) ? normalized : fallback;
};

const normalizeSeverity = (value, fallback = 'low') => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return VALID_SEVERITY.has(normalized) ? normalized : fallback;
};

const buildDedupeKey = ({
  userId,
  type,
  scope,
  transactionId = null,
  year = null,
  month = null,
  customFingerprint = '',
}) => {
  const fingerprintSeed = [
    String(userId || ''),
    String(type || ''),
    String(scope || ''),
    transactionId === null || transactionId === undefined ? '' : String(transactionId),
    year === null || year === undefined ? '' : String(year),
    month === null || month === undefined ? '' : String(month),
    String(customFingerprint || '').trim(),
  ].join('|');

  return crypto.createHash('sha256').update(fingerprintSeed).digest('hex');
};

const mapRow = (row) => ({
  anomaly_id: Number(row.anomaly_id),
  user_id: Number(row.user_id),
  transaction_id: row.transaction_id === null ? null : Number(row.transaction_id),
  anomaly_type: row.anomaly_type,
  scope: row.scope,
  severity: row.severity,
  title: row.title,
  explanation: row.explanation,
  evidence: row.evidence || {},
  status: row.status,
  dedupe_key: row.dedupe_key,
  year: row.year === null ? null : Number(row.year),
  month: row.month === null ? null : Number(row.month),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const upsertAnomaly = async ({
  userId,
  transactionId = null,
  anomalyType,
  scope,
  severity,
  title,
  explanation,
  evidence = {},
  status = 'active',
  dedupeKey,
  year = null,
  month = null,
}) => {
  const resolvedDedupeKey = dedupeKey || buildDedupeKey({
    userId,
    type: anomalyType,
    scope,
    transactionId,
    year,
    month,
    customFingerprint: JSON.stringify(evidence || {}),
  });

  const result = await db.query(
    `INSERT INTO anomalies
      (
        user_id,
        transaction_id,
        anomaly_type,
        scope,
        severity,
        title,
        explanation,
        evidence,
        status,
        dedupe_key,
        year,
        month,
        created_at,
        updated_at
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, NOW(), NOW())
     ON CONFLICT (user_id, dedupe_key)
     DO UPDATE SET
       transaction_id = EXCLUDED.transaction_id,
       anomaly_type = EXCLUDED.anomaly_type,
       scope = EXCLUDED.scope,
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       explanation = EXCLUDED.explanation,
       evidence = EXCLUDED.evidence,
       status = CASE
         WHEN anomalies.status IN ('dismissed', 'resolved') THEN anomalies.status
         ELSE EXCLUDED.status
       END,
       year = EXCLUDED.year,
       month = EXCLUDED.month,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      transactionId,
      anomalyType,
      normalizeScope(scope),
      normalizeSeverity(severity),
      title,
      explanation,
      JSON.stringify(evidence || {}),
      normalizeStatus(status),
      resolvedDedupeKey,
      year,
      month,
    ]
  );

  return mapRow(result.rows[0]);
};

const markAnomaliesResolvedForTransaction = async ({ userId, transactionId }) => {
  if (!transactionId) return 0;

  const result = await db.query(
    `UPDATE anomalies
     SET status = 'resolved',
         updated_at = NOW()
     WHERE user_id = $1
       AND transaction_id = $2
       AND scope = 'transaction'
       AND status IN ('active', 'read')`,
    [userId, transactionId]
  );

  return Number(result.rowCount || 0);
};

const getAnomaliesForUser = async ({
  userId,
  status,
  severity,
  type,
  month,
  year,
  limit = 50,
  offset = 0,
}) => {
  const filters = ['user_id = $1'];
  const values = [userId];
  let param = 2;

  if (status) {
    filters.push(`status = $${param++}`);
    values.push(normalizeStatus(status));
  }

  if (severity) {
    filters.push(`severity = $${param++}`);
    values.push(normalizeSeverity(severity));
  }

  if (type) {
    filters.push(`anomaly_type = $${param++}`);
    values.push(String(type).trim());
  }

  if (month) {
    filters.push(`month = $${param++}`);
    values.push(Number(month));
  }

  if (year) {
    filters.push(`year = $${param++}`);
    values.push(Number(year));
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  values.push(safeLimit);
  values.push(safeOffset);

  const orderBySeverityCase = ORDERED_SEVERITY
    .map((value, index) => `WHEN '${value}' THEN ${index}`)
    .join(' ');

  const result = await db.query(
    `SELECT *
     FROM anomalies
     WHERE ${filters.join(' AND ')}
     ORDER BY
       CASE severity ${orderBySeverityCase} ELSE 99 END,
       created_at DESC
     LIMIT $${param++} OFFSET $${param++}`,
    values
  );

  return result.rows.map(mapRow);
};

const getAnomalySummaryForUser = async ({ userId, month = null, year = null, limit = 8 }) => {
  const values = [userId];
  const where = ['user_id = $1', "status = 'active'"];
  let param = 2;

  if (month) {
    where.push(`month = $${param++}`);
    values.push(Number(month));
  }

  if (year) {
    where.push(`year = $${param++}`);
    values.push(Number(year));
  }

  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));

  const countsResult = await db.query(
    `SELECT
       COUNT(*)::int AS total_active,
       COUNT(*) FILTER (WHERE severity = 'high')::int AS high_count,
       COUNT(*) FILTER (WHERE severity = 'medium')::int AS medium_count,
       COUNT(*) FILTER (WHERE severity = 'low')::int AS low_count
     FROM anomalies
     WHERE ${where.join(' AND ')}`,
    values
  );

  const highlightsValues = [...values, safeLimit];

  const highlightsResult = await db.query(
    `SELECT *
     FROM anomalies
     WHERE ${where.join(' AND ')}
     ORDER BY
       CASE severity
         WHEN 'high' THEN 0
         WHEN 'medium' THEN 1
         WHEN 'low' THEN 2
         ELSE 99
       END,
       created_at DESC
     LIMIT $${param}`,
    highlightsValues
  );

  const counts = countsResult.rows[0] || {};

  return {
    total_active: Number(counts.total_active || 0),
    high_count: Number(counts.high_count || 0),
    medium_count: Number(counts.medium_count || 0),
    low_count: Number(counts.low_count || 0),
    highlights: highlightsResult.rows.map(mapRow),
  };
};

const updateAnomalyStatus = async ({ userId, anomalyId, status }) => {
  const nextStatus = normalizeStatus(status);

  const result = await db.query(
    `UPDATE anomalies
     SET status = $1,
         updated_at = NOW()
     WHERE anomaly_id = $2
       AND user_id = $3
     RETURNING *`,
    [nextStatus, anomalyId, userId]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

const getTransactionAnomalies = async ({ userId, transactionId }) => {
  const result = await db.query(
    `SELECT *
     FROM anomalies
     WHERE user_id = $1
       AND transaction_id = $2
     ORDER BY
       CASE severity
         WHEN 'high' THEN 0
         WHEN 'medium' THEN 1
         WHEN 'low' THEN 2
         ELSE 99
       END,
       created_at DESC`,
    [userId, transactionId]
  );

  return result.rows.map(mapRow);
};

module.exports = {
  buildDedupeKey,
  upsertAnomaly,
  markAnomaliesResolvedForTransaction,
  getAnomaliesForUser,
  getAnomalySummaryForUser,
  updateAnomalyStatus,
  getTransactionAnomalies,
};
