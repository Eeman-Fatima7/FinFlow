const db = require('../db/db');
const runMigrations = require('../db/migrate');
const advisorService = require('../services/advisorService');
const {
  parseAssistantOutput,
  persistActionProposal,
} = require('../services/ai/actionProposalService');
const {
  executeConfirmedAction,
} = require('../services/ai/actionExecutionService');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const getOrCreateSmokeUser = async () => {
  const email = 'phase10-ai-actions-smoke@example.com';

  const existing = await db.query(
    `SELECT user_id
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (existing.rows[0]) {
    return Number(existing.rows[0].user_id);
  }

  const inserted = await db.query(
    `INSERT INTO users (name, email, password, monthly_income, city, occupation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id`,
    ['Phase10 Smoke User', email, 'hashed-password', 450000, 'Islamabad', 'Engineer']
  );

  return Number(inserted.rows[0].user_id);
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
    throw new Error(`Category not found: ${name}`);
  }

  return Number(result.rows[0].category_id);
};

const run = async () => {
  await runMigrations();

  const userId = await getOrCreateSmokeUser();
  const groceriesCategoryId = await getCategoryIdByName('Groceries');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const prompts = advisorService.buildPrompt(
    {
      city: 'Islamabad',
      occupation: 'Engineer',
      monthly_income: 450000,
      income: 450000,
      total_expenses: 220000,
      savings: 230000,
      savings_rate: 51.1,
      month,
      year,
      category_breakdown: [
        { category: 'Groceries', amount: 32000, percentage: 0.145 },
      ],
      overspending_flags: [],
      structured_context: {
        confirmed: [],
        predicted: [],
        uncertain: [],
        meta: { quality_flags: [] },
      },
      all_time_context: {
        lifetime_totals: {
          income: 2200000,
          expenses: 1400000,
          net_savings: 800000,
          transaction_count: 210,
          first_transaction_date: '2025-01-01',
          last_transaction_date: now.toISOString().slice(0, 10),
        },
        category_totals: [{ category: 'Groceries', amount: 300000 }],
        monthly_trend: [],
        recurring_merchants: [],
        budget_status: { month, year, items: [] },
        active_goals: [],
        recent_transactions: [],
      },
    },
    'Set my groceries budget to 17000 this month'
  );

  assert(
    prompts.systemPrompt.includes('[ACTION_PROPOSAL_JSON]'),
    'Prompt must include action marker instruction'
  );

  const syntheticModelOutput = [
    'Sure — I can set your groceries budget for this month.',
    '[ACTION_PROPOSAL_JSON]{',
    '  "type": "create_budget",',
    '  "payload": {',
    `    "category_id": ${groceriesCategoryId},`,
    '    "monthly_limit": 17000,',
    `    "month": ${month},`,
    `    "year": ${year}`,
    '  },',
    '  "confirmation_summary": "Set Groceries budget to 17,000 PKR for this month"',
    '}',
  ].join('\n');

  const parsed = parseAssistantOutput(syntheticModelOutput);

  assert(parsed.reply_text.includes('set your groceries budget'), 'Reply text parsing failed');
  assert(parsed.proposal && parsed.proposal.type === 'create_budget', 'Proposal parsing failed');
  assert(parsed.proposal_error === null, 'Expected no proposal parse error');

  const persisted = await persistActionProposal({
    userId,
    proposal: parsed.proposal,
    correlationId: 'phase10-smoke',
    expiresInMinutes: 15,
  });

  assert(persisted.proposal_id, 'Proposal persistence failed');
  assert(persisted.status === 'pending', 'Expected pending proposal status');

  const rejected = await executeConfirmedAction({
    proposalId: persisted.proposal_id,
    userId,
    decision: 'reject',
  });

  assert(rejected.status === 'rejected', 'Reject path failed');
  assert(rejected.executed === false, 'Reject path should not execute writes');

  const confirmProposal = await persistActionProposal({
    userId,
    proposal: parsed.proposal,
    correlationId: 'phase10-smoke-confirm',
    expiresInMinutes: 15,
  });

  const executed = await executeConfirmedAction({
    proposalId: confirmProposal.proposal_id,
    userId,
    decision: 'confirm',
  });

  assert(executed.status === 'executed', 'Confirm path did not execute');
  assert(executed.executed === true, 'Confirm path should execute write');
  assert(executed.type === 'create_budget', 'Unexpected execution type');

  const budgetCheck = await db.query(
    `SELECT budget_id, monthly_limit
     FROM budgets
     WHERE user_id = $1
       AND category_id = $2
       AND month = $3
       AND year = $4
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, groceriesCategoryId, month, year]
  );

  assert(Boolean(budgetCheck.rows[0]), 'Confirmed action did not persist budget row');
  assert(Number(budgetCheck.rows[0].monthly_limit) === 17000, 'Persisted budget limit mismatch');

  return {
    user_id: userId,
    month,
    year,
    proposal_rejected: rejected.proposal_id,
    proposal_executed: executed.proposal_id,
    budget_id: Number(budgetCheck.rows[0].budget_id),
    budget_monthly_limit: Number(budgetCheck.rows[0].monthly_limit),
  };
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 10 AI actions smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Phase 10 AI actions smoke test failed:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
