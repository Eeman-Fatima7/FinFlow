const db = require('../../db/db');
const { createFingerprint } = require('./fingerprintService');

const findDuplicateStatus = async ({
  userId,
  fingerprint,
  date,
  amount,
  merchant,
  description,
  sourceReferenceId,
  excludeTransactionId = null,
}) => {
  if (!fingerprint) {
    return {
      dedupe_status: 'clear',
      duplicate_reason: null,
    };
  }

  const exact = await db.query(
    `SELECT transaction_id
     FROM transactions
     WHERE user_id = $1
       AND dedupe_fingerprint = $2
       AND ($3::int IS NULL OR transaction_id <> $3)
     LIMIT 1`,
    [userId, fingerprint, excludeTransactionId]
  );

  if (exact.rows.length > 0) {
    return {
      dedupe_status: 'blocked_exact',
      duplicate_reason: 'Exact duplicate fingerprint already exists in transactions',
    };
  }

  if (sourceReferenceId) {
    const referenceMatch = await db.query(
      `SELECT transaction_id
       FROM transactions
       WHERE user_id = $1
         AND source_reference_id = $2
         AND ($3::int IS NULL OR transaction_id <> $3)
       LIMIT 1`,
      [userId, sourceReferenceId, excludeTransactionId]
    );

    if (referenceMatch.rows.length > 0) {
      return {
        dedupe_status: 'probable_duplicate',
        duplicate_reason: 'Transaction reference ID already exists',
      };
    }
  }

  const parsedDate = new Date(date);
  const normalizedDate = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().split('T')[0];

  if (normalizedDate) {
    const probable = await db.query(
      `SELECT transaction_id
       FROM transactions
       WHERE user_id = $1
         AND date = $2::date
         AND ABS(amount) = $3
         AND LOWER(COALESCE(merchant, description, '')) = LOWER($4)
         AND ($5::int IS NULL OR transaction_id <> $5)
       LIMIT 1`,
      [
        userId,
        normalizedDate,
        Math.abs(Number(amount) || 0),
        merchant || description || '',
        excludeTransactionId,
      ]
    );

    if (probable.rows.length > 0) {
      return {
        dedupe_status: 'probable_duplicate',
        duplicate_reason: 'Similar transaction exists with same date, amount, and merchant/description',
      };
    }
  }

  return {
    dedupe_status: 'clear',
    duplicate_reason: null,
  };
};

const annotateRowDedupe = async ({ userId, row, excludeTransactionId = null }) => {
  const fingerprint = createFingerprint({
    userId,
    date: row.transaction_date,
    amount: row.amount,
    type: row.direction === 'credit' ? 'income' : 'expense',
    merchant: row.merchant,
    description: row.description,
    referenceId: row.reference_id,
    sourceBank: row.source_bank,
    source: row.source,
  });

  const status = await findDuplicateStatus({
    userId,
    fingerprint,
    date: row.transaction_date,
    amount: row.amount,
    merchant: row.merchant,
    description: row.description,
    sourceReferenceId: row.reference_id,
    excludeTransactionId,
  });

  return {
    dedupe_fingerprint: fingerprint,
    ...status,
  };
};

module.exports = {
  annotateRowDedupe,
};