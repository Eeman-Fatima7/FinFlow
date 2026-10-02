const db = require('../../db/db');
const {
  normalizeActionProposal,
} = require('./actionProposalService');
const {
  upsertBudget,
  findExpenseCategoryByName,
} = require('../budgets/budgetWriteService');
const {
  createGoal,
  updateGoal,
} = require('../goals/goalWriteService');

const ACTION_STATUS_VALUES = new Set([
  'pending',
  'confirmed',
  'rejected',
  'expired',
  'executed',
  'failed',
]);

const ACTION_DECISIONS = new Set(['confirm', 'reject']);

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeDecision = (value) => {
  const decision = toTrimmedString(value).toLowerCase();
  if (!ACTION_DECISIONS.has(decision)) {
    const err = new Error('decision must be confirm or reject');
    err.statusCode = 400;
    throw err;
  }

  return decision;
};

const getPendingActionRequestForUser = async ({ proposalId, userId, dbClient = db }) => {
  const safeProposalId = toTrimmedString(proposalId);
  if (!safeProposalId) {
    const err = new Error('proposal_id is required');
    err.statusCode = 400;
    throw err;
  }

  const result = await dbClient.query(
    `SELECT
       action_request_id,
       user_id,
       ai_log_id,
       action_type,
       action_payload,
       confirmation_summary,
       status,
       correlation_id,
       expires_at,
       created_at,
       updated_at,
       executed_at,
       error_message
     FROM ai_action_requests
     WHERE action_request_id = $1
       AND user_id = $2
     LIMIT 1
     FOR UPDATE`,
    [safeProposalId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    const err = new Error('Action proposal not found');
    err.statusCode = 404;
    throw err;
  }

  return row;
};

const ensurePendingAndNotExpired = async ({ actionRequest, now = new Date() }) => {
  const status = toTrimmedString(actionRequest.status).toLowerCase();

  if (!ACTION_STATUS_VALUES.has(status)) {
    const err = new Error('Invalid action proposal state');
    err.statusCode = 409;
    throw err;
  }

  if (status !== 'pending') {
    const err = new Error('Action proposal is no longer pending');
    err.statusCode = 409;
    throw err;
  }

  const expiry = actionRequest.expires_at ? new Date(actionRequest.expires_at) : null;
  if (expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
    const err = new Error('Action proposal has expired');
    err.statusCode = 410;
    err.code = 'ACTION_EXPIRED';
    throw err;
  }
};

const markActionRequestStatus = async ({
  proposalId,
  status,
  dbClient = db,
  errorMessage = null,
  setExecutedAt = false,
}) => {
  const normalizedStatus = toTrimmedString(status).toLowerCase();
  if (!ACTION_STATUS_VALUES.has(normalizedStatus)) {
    throw new Error('Invalid action request status');
  }

  const result = await dbClient.query(
    `UPDATE ai_action_requests
     SET status = $2,
         error_message = $3,
         executed_at = CASE WHEN $4::boolean THEN NOW() ELSE executed_at END,
         updated_at = NOW()
     WHERE action_request_id = $1
     RETURNING action_request_id, action_type, action_payload, confirmation_summary, status, expires_at, executed_at, error_message`,
    [proposalId, normalizedStatus, errorMessage, Boolean(setExecutedAt)]
  );

  return result.rows[0] || null;
};

const executeBudgetAction = async ({ userId, normalizedProposal, dbClient }) => {
  const payload = normalizedProposal.payload || {};

  let categoryId = payload.category_id || null;
  if (!categoryId) {
    const resolved = await findExpenseCategoryByName({
      categoryName: payload.category,
      dbClient,
    });
    categoryId = resolved.category_id;
  }

  const { budget } = await upsertBudget({
    userId,
    categoryId,
    monthlyLimit: payload.monthly_limit,
    month: payload.month,
    year: payload.year,
    dbClient,
  });

  return {
    entity: 'budget',
    action_type: normalizedProposal.type,
    budget,
  };
};

const executeGoalAction = async ({ userId, normalizedProposal, dbClient }) => {
  if (normalizedProposal.type === 'create_goal') {
    const payload = normalizedProposal.payload || {};
    const goal = await createGoal({
      userId,
      title: payload.title,
      targetAmount: payload.target_amount,
      deadline: payload.deadline,
      dbClient,
    });

    return {
      entity: 'goal',
      action_type: normalizedProposal.type,
      goal,
    };
  }

  const payload = normalizedProposal.payload || {};
  const goal = await updateGoal({
    userId,
    goalId: payload.goal_id,
    fields: payload.fields || {},
    dbClient,
  });

  return {
    entity: 'goal',
    action_type: normalizedProposal.type,
    goal,
  };
};

const executeConfirmedAction = async ({ proposalId, userId, decision }) => {
  const normalizedDecision = normalizeDecision(decision);

  const safeUserId = Number(userId);
  if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
    const err = new Error('user_id is required');
    err.statusCode = 400;
    throw err;
  }

  const client = await db.pool.connect();
  let transactionClosed = false;

  try {
    await client.query('BEGIN');

    const actionRequest = await getPendingActionRequestForUser({
      proposalId,
      userId: safeUserId,
      dbClient: client,
    });

    try {
      await ensurePendingAndNotExpired({ actionRequest });
    } catch (err) {
      if (err.code === 'ACTION_EXPIRED') {
        await markActionRequestStatus({
          proposalId,
          status: 'expired',
          dbClient: client,
          errorMessage: 'Action proposal expired before confirmation',
        });
        await client.query('COMMIT');
        transactionClosed = true;
      }
      throw err;
    }

    if (normalizedDecision === 'reject') {
      const rejected = await markActionRequestStatus({
        proposalId,
        status: 'rejected',
        dbClient: client,
        errorMessage: null,
      });

      await client.query('COMMIT');
      transactionClosed = true;

      return {
        proposal_id: rejected.action_request_id,
        decision: 'reject',
        status: rejected.status,
        executed: false,
        type: rejected.action_type,
        confirmation_summary: rejected.confirmation_summary,
      };
    }

    const normalizedProposal = normalizeActionProposal({
      type: actionRequest.action_type,
      payload: actionRequest.action_payload,
      confirmation_summary: actionRequest.confirmation_summary,
    });

    let executionResult;
    if (normalizedProposal.type === 'create_budget' || normalizedProposal.type === 'update_budget') {
      executionResult = await executeBudgetAction({
        userId: safeUserId,
        normalizedProposal,
        dbClient: client,
      });
    } else {
      executionResult = await executeGoalAction({
        userId: safeUserId,
        normalizedProposal,
        dbClient: client,
      });
    }

    const executed = await markActionRequestStatus({
      proposalId,
      status: 'executed',
      dbClient: client,
      errorMessage: null,
      setExecutedAt: true,
    });

    await client.query('COMMIT');
    transactionClosed = true;

    return {
      proposal_id: executed.action_request_id,
      decision: 'confirm',
      status: executed.status,
      executed: true,
      type: executed.action_type,
      confirmation_summary: executed.confirmation_summary,
      result: executionResult,
      executed_at: executed.executed_at,
    };
  } catch (err) {
    if (!transactionClosed) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // no-op
      }
    }

    const proposalIdText = toTrimmedString(proposalId);
    if (proposalIdText && normalizedDecision === 'confirm' && err.code !== 'ACTION_EXPIRED') {
      try {
        await markActionRequestStatus({
          proposalId: proposalIdText,
          status: 'failed',
          errorMessage: err.message,
        });
      } catch {
        // no-op
      }
    }

    if (!err.statusCode) {
      err.statusCode = 500;
    }

    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  ACTION_DECISIONS,
  normalizeDecision,
  getPendingActionRequestForUser,
  executeConfirmedAction,
};
