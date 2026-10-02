const crypto = require('crypto');
const db = require('../../db/db');
const budgetService = require('../budgetService');

const ACTION_PROPOSAL_MARKER = '[ACTION_PROPOSAL_JSON]';

const ACTION_TYPES = new Set([
  'create_budget',
  'update_budget',
  'create_goal',
  'update_goal',
]);

const GOAL_STATUS_VALUES = new Set(['active', 'completed', 'paused']);

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const toPositiveIntegerOrNull = (value) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
};

const toPositiveNumberOrNull = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
};

const toNonNegativeNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Number(numeric.toFixed(2));
};

const parseJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    try {
      const sliced = candidate.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(sliced);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
};

const normalizeBudgetPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Budget action payload must be an object');
    err.statusCode = 400;
    throw err;
  }

  const categoryId = toPositiveIntegerOrNull(
    payload.category_id
    ?? payload.categoryId
    ?? payload.categoryID
  );

  const categoryName = toTrimmedString(
    payload.category
    ?? payload.category_name
    ?? payload.categoryName
  );

  if (!categoryId && !categoryName) {
    const err = new Error('Budget action requires category or category_id');
    err.statusCode = 400;
    throw err;
  }

  const monthlyLimit = toPositiveNumberOrNull(
    payload.monthly_limit
    ?? payload.monthlyLimit
    ?? payload.limit
    ?? payload.amount
    ?? payload.budget
  );

  if (!monthlyLimit) {
    const err = new Error('Budget action requires a positive monthly limit');
    err.statusCode = 400;
    throw err;
  }

  let month = payload.month;
  let year = payload.year;

  if (payload.year_month && (month === undefined || year === undefined)) {
    const parts = String(payload.year_month).trim().split('-');
    if (parts.length === 2) {
      year = year ?? parts[0];
      month = month ?? parts[1];
    }
  }

  const parsedMonthYear = budgetService.parseMonthYear(month, year);

  return {
    category_id: categoryId,
    category: categoryName || null,
    monthly_limit: monthlyLimit,
    month: parsedMonthYear.month,
    year: parsedMonthYear.year,
  };
};

const normalizeGoalCreatePayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Goal action payload must be an object');
    err.statusCode = 400;
    throw err;
  }

  const title = toTrimmedString(payload.title ?? payload.name ?? payload.goal_name);
  if (!title) {
    const err = new Error('Goal action requires title');
    err.statusCode = 400;
    throw err;
  }

  const targetAmount = toPositiveNumberOrNull(
    payload.target_amount
    ?? payload.targetAmount
    ?? payload.target
    ?? payload.amount
  );

  if (!targetAmount) {
    const err = new Error('Goal action requires a positive target_amount');
    err.statusCode = 400;
    throw err;
  }

  const deadline = toTrimmedString(payload.deadline ?? payload.target_date ?? payload.targetDate);
  if (deadline) {
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      const err = new Error('Goal deadline must be a valid date');
      err.statusCode = 400;
      throw err;
    }
  }

  const currentSavings = toNonNegativeNumberOrNull(
    payload.current_savings
    ?? payload.currentAmount
    ?? payload.current_amount
  );

  return {
    title,
    target_amount: targetAmount,
    current_savings: currentSavings,
    deadline: deadline || null,
  };
};

const normalizeGoalUpdatePayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Goal action payload must be an object');
    err.statusCode = 400;
    throw err;
  }

  const goalId = toPositiveIntegerOrNull(payload.goal_id ?? payload.goalId ?? payload.id);
  if (!goalId) {
    const err = new Error('Goal update action requires goal_id');
    err.statusCode = 400;
    throw err;
  }

  const title = payload.title !== undefined || payload.name !== undefined
    ? toTrimmedString(payload.title ?? payload.name)
    : null;

  if (title !== null && !title) {
    const err = new Error('Goal title cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  const targetAmount = payload.target_amount !== undefined
    || payload.targetAmount !== undefined
    || payload.target !== undefined
    || payload.amount !== undefined
    ? toPositiveNumberOrNull(
      payload.target_amount
      ?? payload.targetAmount
      ?? payload.target
      ?? payload.amount
    )
    : null;

  if ((payload.target_amount !== undefined
      || payload.targetAmount !== undefined
      || payload.target !== undefined
      || payload.amount !== undefined) && !targetAmount) {
    const err = new Error('Goal target_amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }

  const currentSavings = payload.current_savings !== undefined
    || payload.currentAmount !== undefined
    || payload.current_amount !== undefined
    ? toNonNegativeNumberOrNull(
      payload.current_savings
      ?? payload.currentAmount
      ?? payload.current_amount
    )
    : null;

  if ((payload.current_savings !== undefined
      || payload.currentAmount !== undefined
      || payload.current_amount !== undefined) && currentSavings === null) {
    const err = new Error('Goal current_savings must be greater than or equal to 0');
    err.statusCode = 400;
    throw err;
  }

  const deadline = payload.deadline !== undefined || payload.target_date !== undefined || payload.targetDate !== undefined
    ? toTrimmedString(payload.deadline ?? payload.target_date ?? payload.targetDate)
    : null;

  if (deadline) {
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      const err = new Error('Goal deadline must be a valid date');
      err.statusCode = 400;
      throw err;
    }
  }

  const status = payload.status !== undefined
    ? toTrimmedString(payload.status).toLowerCase()
    : null;

  if (status && !GOAL_STATUS_VALUES.has(status)) {
    const err = new Error('Goal status must be active, completed, or paused');
    err.statusCode = 400;
    throw err;
  }

  const fields = {
    ...(title !== null ? { title } : {}),
    ...(targetAmount !== null ? { target_amount: targetAmount } : {}),
    ...(currentSavings !== null ? { current_savings: currentSavings } : {}),
    ...(deadline !== null ? { deadline: deadline || null } : {}),
    ...(status !== null ? { status } : {}),
  };

  if (Object.keys(fields).length === 0) {
    const err = new Error('Goal update action requires at least one updatable field');
    err.statusCode = 400;
    throw err;
  }

  return {
    goal_id: goalId,
    fields,
  };
};

const normalizeActionType = (value) => {
  const raw = toTrimmedString(value).toLowerCase();

  if (!raw) return null;

  const map = {
    createbudget: 'create_budget',
    create_budget: 'create_budget',
    'budget.create': 'create_budget',
    updatebudget: 'update_budget',
    update_budget: 'update_budget',
    'budget.update': 'update_budget',
    creategoal: 'create_goal',
    create_goal: 'create_goal',
    'goal.create': 'create_goal',
    updategoal: 'update_goal',
    update_goal: 'update_goal',
    'goal.update': 'update_goal',
  };

  return map[raw] || null;
};

const normalizeActionProposal = (proposal = {}) => {
  const type = normalizeActionType(proposal.type || proposal.action_type || proposal.action);
  if (!type || !ACTION_TYPES.has(type)) {
    const err = new Error('Unsupported action proposal type');
    err.statusCode = 400;
    throw err;
  }

  const payload = proposal.payload && typeof proposal.payload === 'object'
    ? proposal.payload
    : proposal;

  let normalizedPayload;
  if (type === 'create_budget' || type === 'update_budget') {
    normalizedPayload = normalizeBudgetPayload(payload);
  } else if (type === 'create_goal') {
    normalizedPayload = normalizeGoalCreatePayload(payload);
  } else {
    normalizedPayload = normalizeGoalUpdatePayload(payload);
  }

  const confirmationSummary = toTrimmedString(
    proposal.confirmation_summary
    || proposal.confirmationSummary
    || proposal.summary
  ) || `Confirm action: ${type}`;

  return {
    type,
    payload: normalizedPayload,
    confirmation_summary: confirmationSummary,
  };
};

const stripActionMarkerFromText = (text) => {
  const rawText = toTrimmedString(text);
  if (!rawText) return '';

  const markerIndex = rawText.lastIndexOf(ACTION_PROPOSAL_MARKER);
  if (markerIndex === -1) return rawText;

  const cleaned = rawText.slice(0, markerIndex).trim();
  return cleaned || rawText.replace(ACTION_PROPOSAL_MARKER, '').trim();
};

const extractActionChunk = (text) => {
  const rawText = toTrimmedString(text);
  if (!rawText) return null;

  const markerIndex = rawText.lastIndexOf(ACTION_PROPOSAL_MARKER);
  if (markerIndex === -1) return null;

  return rawText.slice(markerIndex + ACTION_PROPOSAL_MARKER.length).trim();
};

const parseAssistantOutput = (rawOutput) => {
  const cleanedReply = stripActionMarkerFromText(rawOutput);
  const actionChunk = extractActionChunk(rawOutput);

  if (!actionChunk) {
    return {
      reply_text: cleanedReply,
      proposal: null,
      proposal_error: null,
    };
  }

  if (actionChunk.toLowerCase() === 'null') {
    return {
      reply_text: cleanedReply,
      proposal: null,
      proposal_error: null,
    };
  }

  const parsedJson = parseJsonObject(actionChunk);
  if (!parsedJson) {
    return {
      reply_text: cleanedReply,
      proposal: null,
      proposal_error: 'Failed to parse action proposal JSON',
    };
  }

  try {
    const proposal = normalizeActionProposal(parsedJson);
    return {
      reply_text: cleanedReply,
      proposal,
      proposal_error: null,
    };
  } catch (err) {
    return {
      reply_text: cleanedReply,
      proposal: null,
      proposal_error: err.message,
    };
  }
};

const persistActionProposal = async ({
  userId,
  aiLogId = null,
  proposal,
  correlationId = null,
  expiresInMinutes = 30,
}) => {
  const safeUserId = toPositiveIntegerOrNull(userId);
  if (!safeUserId) {
    const err = new Error('user_id is required');
    err.statusCode = 400;
    throw err;
  }

  const safeAiLogId = aiLogId === null || aiLogId === undefined || aiLogId === ''
    ? null
    : toPositiveIntegerOrNull(aiLogId);

  if (aiLogId !== null && aiLogId !== undefined && aiLogId !== '' && !safeAiLogId) {
    const err = new Error('ai_log_id must be a positive integer when provided');
    err.statusCode = 400;
    throw err;
  }

  const actionRequestId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(5, Number(expiresInMinutes) || 30) * 60 * 1000).toISOString();

  const result = await db.query(
    `INSERT INTO ai_action_requests (
       action_request_id,
       user_id,
       ai_log_id,
       action_type,
       action_payload,
       confirmation_summary,
       status,
       correlation_id,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'pending', $7, $8)
     RETURNING action_request_id, action_type, action_payload, confirmation_summary, status, expires_at`,
    [
      actionRequestId,
      safeUserId,
      safeAiLogId,
      proposal.type,
      JSON.stringify(proposal.payload || {}),
      proposal.confirmation_summary,
      correlationId || null,
      expiresAt,
    ]
  );

  const row = result.rows[0];
  return {
    proposal_id: row.action_request_id,
    type: row.action_type,
    payload: row.action_payload,
    confirmation_summary: row.confirmation_summary,
    status: row.status,
    expires_at: row.expires_at,
  };
};

module.exports = {
  ACTION_TYPES,
  ACTION_PROPOSAL_MARKER,
  parseAssistantOutput,
  normalizeActionProposal,
  persistActionProposal,
};
