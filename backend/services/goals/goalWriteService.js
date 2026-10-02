const db = require('../../db/db');

const GOAL_STATUS_VALUES = new Set(['active', 'completed', 'paused']);

const toPositiveInt = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const err = new Error(`${fieldName} must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }

  return numeric;
};

const toPositiveNumber = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const err = new Error(`${fieldName} must be greater than 0`);
    err.statusCode = 400;
    throw err;
  }

  return Number(numeric.toFixed(2));
};

const toNonNegativeNumberOrNull = (value, fieldName) => {
  if (value === null || value === undefined || value === '') return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const err = new Error(`${fieldName} must be greater than or equal to 0`);
    err.statusCode = 400;
    throw err;
  }

  return Number(numeric.toFixed(2));
};

const normalizeTitle = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    const err = new Error('title is required');
    err.statusCode = 400;
    throw err;
  }

  if (text.length > 150) {
    const err = new Error('title must be 150 characters or less');
    err.statusCode = 400;
    throw err;
  }

  return text;
};

const normalizeOptionalTitle = (value) => {
  if (value === undefined) return null;
  return normalizeTitle(value);
};

const normalizeDeadline = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;

    const err = new Error('deadline is required');
    err.statusCode = 400;
    throw err;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error('deadline must be a valid date');
    err.statusCode = 400;
    throw err;
  }

  return parsed.toISOString().slice(0, 10);
};

const normalizeStatus = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();

  if (!GOAL_STATUS_VALUES.has(normalized)) {
    const err = new Error('status must be active, completed, or paused');
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const ensureOwnedGoal = async ({ userId, goalId, dbClient = db }) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const safeGoalId = toPositiveInt(goalId, 'goal_id');

  const result = await dbClient.query(
    `SELECT goal_id, user_id, title, target_amount, current_savings, deadline, status, created_at
     FROM goals
     WHERE goal_id = $1 AND user_id = $2
     LIMIT 1`,
    [safeGoalId, safeUserId]
  );

  if (!result.rows[0]) {
    const err = new Error('Goal not found');
    err.statusCode = 404;
    throw err;
  }

  return result.rows[0];
};

const createGoal = async ({ userId, title, targetAmount, deadline = null, dbClient = db }) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const safeTitle = normalizeTitle(title);
  const safeTargetAmount = toPositiveNumber(targetAmount, 'target_amount');
  const safeDeadline = normalizeDeadline(deadline);

  const result = await dbClient.query(
    `INSERT INTO goals (user_id, title, target_amount, deadline)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [safeUserId, safeTitle, safeTargetAmount, safeDeadline]
  );

  return result.rows[0];
};

const updateGoal = async ({ userId, goalId, fields = {}, dbClient = db }) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const safeGoalId = toPositiveInt(goalId, 'goal_id');

  await ensureOwnedGoal({ userId: safeUserId, goalId: safeGoalId, dbClient });

  const normalizedFields = {
    current_savings: toNonNegativeNumberOrNull(fields.current_savings, 'current_savings'),
    status: normalizeStatus(fields.status),
    title: normalizeOptionalTitle(fields.title),
    target_amount: fields.target_amount === undefined
      ? null
      : toPositiveNumber(fields.target_amount, 'target_amount'),
    deadline: fields.deadline === undefined
      ? null
      : normalizeDeadline(fields.deadline),
  };

  const result = await dbClient.query(
    `UPDATE goals SET
       current_savings = COALESCE($1, current_savings),
       status          = COALESCE($2, status),
       title           = COALESCE($3, title),
       target_amount   = COALESCE($4, target_amount),
       deadline        = COALESCE($5, deadline)
     WHERE goal_id = $6 AND user_id = $7
     RETURNING *`,
    [
      normalizedFields.current_savings,
      normalizedFields.status,
      normalizedFields.title,
      normalizedFields.target_amount,
      normalizedFields.deadline,
      safeGoalId,
      safeUserId,
    ]
  );

  return result.rows[0];
};

module.exports = {
  GOAL_STATUS_VALUES,
  toPositiveInt,
  toPositiveNumber,
  normalizeTitle,
  normalizeDeadline,
  normalizeStatus,
  ensureOwnedGoal,
  createGoal,
  updateGoal,
};
