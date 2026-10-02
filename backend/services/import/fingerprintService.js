const crypto = require('crypto');

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '');

const normalizeDateOnly = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount).toFixed(2) : '';
};

const createFingerprint = ({
  userId,
  date,
  amount,
  type,
  merchant,
  description,
  referenceId,
  sourceBank,
  source,
}) => {
  const payload = [
    String(userId || ''),
    normalizeDateOnly(date),
    normalizeAmount(amount),
    normalizeText(type),
    normalizeText(merchant),
    normalizeText(description),
    normalizeText(referenceId),
    normalizeText(sourceBank || source),
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
};

module.exports = {
  createFingerprint,
};