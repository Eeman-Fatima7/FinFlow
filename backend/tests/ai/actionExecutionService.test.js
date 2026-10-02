const crypto = require('crypto');
const db = require('../../db/db');
const runMigrations = require('../../db/migrate');
const {
  parseMonthYear,
} = require('../../services/budgets/budgetWriteService');
const {
  executeConfirmedAction,
} = require('../../services/ai/actionExecutionService');

const ensureTestUser = async () => {
  const unique = `ai-action-test-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  const result = await db.query(
    `INSERT INTO users (name, email, password, monthly_income)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id`,
    ['AI Action Test User', unique, 'hashed-password', 500000]
  );
  return result.rows[0].user_id;
};

const getCategoryIdByName = async (name) => {
  const result = await db.query(
    `SELECT category_id
     FROM categories
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [name]
  );

  if (!result.rows[0]) {
    throw new Error(`Category not found in test setup: ${name}`);
  }

  return Number(result.rows[0].category_id);
};

const createPendingActionRequest = async ({
  userId,
  type,
  payload,
  confirmationSummary,
  expiresInMinutes = 30,
}) => {
  const actionRequestId = crypto.randomUUID();

  const result = await db.query(
    `INSERT INTO ai_action_requests (
       action_request_id,
       user_id,
       action_type,
       action_payload,
       confirmation_summary,
       status,
       expires_at
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, 'pending', NOW() + ($6 || ' minutes')::interval)
     RETURNING action_request_id`,
    [
      actionRequestId,
      userId,
      type,
      JSON.stringify(payload || {}),
      confirmationSummary || `Confirm ${type}`,
      String(expiresInMinutes),
    ]
  );

  return result.rows[0].action_request_id;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const testConfirmCreateBudget = async () => {
  const userId = await ensureTestUser();
  const groceriesCategoryId = await getCategoryIdByName('Groceries');
  const parsed = parseMonthYear();

  const proposalId = await createPendingActionRequest({
    userId,
    type: 'create_budget',
    payload: {
      category_id: groceriesCategoryId,
      monthly_limit: 16000,
      month: parsed.month,
      year: parsed.year,
    },
    confirmationSummary: 'Set Groceries budget to 16,000 PKR',
  });

  const result = await executeConfirmedAction({
    proposalId,
    userId,
    decision: 'confirm',
  });

  assert(result.executed === true, 'Expected budget action to execute');
  assert(result.status === 'executed', 'Expected status executed');
  assert(result.type === 'create_budget', 'Expected type create_budget');

  const budgetCheck = await db.query(
    `SELECT budget_id, monthly_limit
     FROM budgets
     WHERE user_id = $1
       AND category_id = $2
       AND month = $3
       AND year = $4
     LIMIT 1`,
    [userId, groceriesCategoryId, parsed.month, parsed.year]
  );

  assert(Boolean(budgetCheck.rows[0]), 'Expected budget row to exist after confirm');
  assert(Number(budgetCheck.rows[0].monthly_limit) === 16000, 'Expected monthly limit to match confirmed value');
};

const testConfirmCreateGoal = async () => {
  const userId = await ensureTestUser();

  const proposalId = await createPendingActionRequest({
    userId,
    type: 'create_goal',
    payload: {
      title: 'Emergency Fund',
      target_amount: 200000,
      deadline: '2027-12-31',
      current_savings: 15000,
    },
    confirmationSummary: 'Create emergency fund goal',
  });

  const result = await executeConfirmedAction({
    proposalId,
    userId,
    decision: 'confirm',
  });

  assert(result.executed === true, 'Expected goal create to execute');
  assert(result.status === 'executed', 'Expected status executed');
  assert(result.type === 'create_goal', 'Expected create_goal type');

  const goalCheck = await db.query(
    `SELECT goal_id, title, target_amount
     FROM goals
     WHERE user_id = $1
       AND title = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, 'Emergency Fund']
  );

  assert(Boolean(goalCheck.rows[0]), 'Expected goal row to exist after confirm');
  assert(Number(goalCheck.rows[0].target_amount) === 200000, 'Expected target_amount to match confirmed value');
};

const testRejectAction = async () => {
  const userId = await ensureTestUser();
  const groceriesCategoryId = await getCategoryIdByName('Groceries');
  const parsed = parseMonthYear();

  const proposalId = await createPendingActionRequest({
    userId,
    type: 'create_budget',
    payload: {
      category_id: groceriesCategoryId,
      monthly_limit: 14000,
      month: parsed.month,
      year: parsed.year,
    },
    confirmationSummary: 'Set Groceries budget to 14,000 PKR',
  });

  const result = await executeConfirmedAction({
    proposalId,
    userId,
    decision: 'reject',
  });

  assert(result.executed === false, 'Expected rejected action not to execute');
  assert(result.status === 'rejected', 'Expected proposal status rejected');

  const proposalCheck = await db.query(
    `SELECT status FROM ai_action_requests WHERE action_request_id = $1`,
    [proposalId]
  );

  assert(proposalCheck.rows[0]?.status === 'rejected', 'Expected DB status rejected');

  const budgetCheck = await db.query(
    `SELECT budget_id
     FROM budgets
     WHERE user_id = $1
       AND category_id = $2
       AND month = $3
       AND year = $4
     LIMIT 1`,
    [userId, groceriesCategoryId, parsed.month, parsed.year]
  );

  assert(!budgetCheck.rows[0], 'Expected no budget write after rejection');
};

const testExpiredAction = async () => {
  const userId = await ensureTestUser();
  const groceriesCategoryId = await getCategoryIdByName('Groceries');
  const parsed = parseMonthYear();

  const proposalId = await createPendingActionRequest({
    userId,
    type: 'create_budget',
    payload: {
      category_id: groceriesCategoryId,
      monthly_limit: 12000,
      month: parsed.month,
      year: parsed.year,
    },
    confirmationSummary: 'Set Groceries budget to 12,000 PKR',
    expiresInMinutes: -5,
  });

  let gotExpectedError = false;
  try {
    await executeConfirmedAction({
      proposalId,
      userId,
      decision: 'confirm',
    });
  } catch (err) {
    gotExpectedError = err.statusCode === 410;
  }

  assert(gotExpectedError, 'Expected expired proposal to fail with 410');

  const proposalCheck = await db.query(
    `SELECT status FROM ai_action_requests WHERE action_request_id = $1`,
    [proposalId]
  );

  assert(proposalCheck.rows[0]?.status === 'expired', 'Expected DB status expired');
};

const main = async () => {
  await runMigrations();

  const tests = [
    { name: 'confirm create_budget executes write', run: testConfirmCreateBudget },
    { name: 'confirm create_goal executes write', run: testConfirmCreateGoal },
    { name: 'reject marks rejected without write', run: testRejectAction },
    { name: 'expired proposal is blocked', run: testExpiredAction },
  ];

  let failed = false;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`✓ ${test.name}`);
    } catch (err) {
      failed = true;
      console.error(`✗ ${test.name}`);
      console.error(err.message);
      break;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log('\nAll actionExecutionService tests passed.');
  process.exit(0);
};

main().catch((err) => {
  console.error('actionExecutionService.test fatal error:', err.message);
  process.exit(1);
});
