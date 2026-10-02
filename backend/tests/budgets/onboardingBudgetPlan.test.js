const assert = require('assert');
const db = require('../../db/db');
const runMigrations = require('../../db/migrate');
const {
  createOrReplaceDraftPlanFromUser,
  getOnboardingStatus,
  getCurrentPlanForUser,
  mapPlanResponse,
  updateDraftPlan,
  acceptDraftPlan,
} = require('../../services/budgets/planWriteService');

const ensureTestUser = async () => {
  const unique = `onboarding-plan-test-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  const result = await db.query(
    `INSERT INTO users (name, email, password, monthly_income, city, occupation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id`,
    ['Onboarding Plan Test User', unique, 'hashed-password', 180000, 'Islamabad', 'Salaried Engineer']
  );

  return Number(result.rows[0].user_id);
};

const getExpenseCategoryIdByName = async (name) => {
  const result = await db.query(
    `SELECT category_id
     FROM categories
     WHERE LOWER(name) = LOWER($1)
       AND type = 'expense'
     LIMIT 1`,
    [name]
  );

  if (!result.rows[0]) {
    throw new Error(`Missing expense category in test setup: ${name}`);
  }

  return Number(result.rows[0].category_id);
};

const testDraftLifecycleAndAcceptProjection = async () => {
  const userId = await ensureTestUser();

  const createdDraft = await createOrReplaceDraftPlanFromUser({
    userId,
    source: 'signup_test',
    debtInput: {
      has_debt: true,
      debt_amount: 250000,
      minimum_monthly_debt_payment: 9000,
      debt_priority: 'medium',
      debt_priority_mode: 'avalanche',
    },
    questionnaire: {
      household_size: 4,
      dependents_count: 2,
      income_stability: 'variable',
      primary_goal: 'pay_debt',
      housing_cost: 50000,
      utilities_cost: 12000,
      groceries_baseline: 18000,
      transport_baseline: 10000,
      essential_subscriptions_or_fees: 4000,
      emergency_savings_current: 25000,
      financial_priorities: ['debt_reduction', 'emergency_fund'],
      debt_priority_mode: 'avalanche',
    },
  });

  assert(createdDraft, 'Expected created draft plan');
  assert.strictEqual(createdDraft.status, 'draft');
  assert.strictEqual(createdDraft.has_debt, true);
  assert(createdDraft.allocations.length > 0, 'Expected draft allocations');
  assert(createdDraft.rationale_json?.questionnaire, 'Expected questionnaire persistence on draft');
  assert.strictEqual(createdDraft.rationale_json?.questionnaire?.income_stability, 'variable');
  assert.strictEqual(createdDraft.rationale_json?.questionnaire?.primary_goal, 'pay_debt');
  assert.strictEqual(createdDraft.rationale_json?.questionnaire?.debt_priority_mode, 'avalanche');
  assert.strictEqual(createdDraft.rationale_json?.lifecycle?.suggested, true);
  assert.strictEqual(createdDraft.rationale_json?.lifecycle?.edited, false);

  const onboardingStatusAfterCreate = await getOnboardingStatus({ userId });
  assert.strictEqual(onboardingStatusAfterCreate.onboarding_required, true);
  assert.strictEqual(onboardingStatusAfterCreate.onboarding_completed, false);

  const groceriesCategoryId = await getExpenseCategoryIdByName('Groceries');
  const debtCategoryId = await getExpenseCategoryIdByName('Debt Repayment');

  const existingGroceries = createdDraft.allocations.find(
    (item) => item.category_id === groceriesCategoryId
  );

  const nextAllocations = createdDraft.allocations.map((allocation) => {
    if (allocation.category_id === groceriesCategoryId) {
      return {
        category_id: allocation.category_id,
        allocation_amount: Number((allocation.allocation_amount + 1500).toFixed(2)),
        is_debt_allocation: allocation.is_debt_allocation,
      };
    }

    if (allocation.category_id === debtCategoryId) {
      return {
        category_id: allocation.category_id,
        allocation_amount: Number((allocation.allocation_amount + 1000).toFixed(2)),
        is_debt_allocation: true,
      };
    }

    return {
      category_id: allocation.category_id,
      allocation_amount: allocation.allocation_amount,
      is_debt_allocation: allocation.is_debt_allocation,
    };
  });

  const updated = await updateDraftPlan({
    userId,
    payload: {
      recommended_savings_amount: Number((Math.max(0, createdDraft.recommended_savings_amount - 4500)).toFixed(2)),
      allocations: nextAllocations,
      debt_priority: 'high',
      debt_priority_mode: 'snowball',
      household_size: 5,
      dependents_count: 3,
      income_stability: 'seasonal',
      primary_goal: 'stabilize',
      housing_cost: 52000,
      emergency_savings_current: 30000,
      source: 'user_edit_test',
    },
  });

  const updatedGroceries = updated.allocations.find((item) => item.category_id === groceriesCategoryId);

  assert(updatedGroceries, 'Expected updated groceries allocation');
  assert(existingGroceries, 'Expected initial groceries allocation');
  assert(
    Number(updatedGroceries.allocation_amount) > Number(existingGroceries.allocation_amount),
    'Expected groceries allocation to increase after update'
  );
  assert.strictEqual(updated.debt_priority, 'high');
  assert.strictEqual(updated.rationale_json?.questionnaire?.income_stability, 'seasonal');
  assert.strictEqual(updated.rationale_json?.questionnaire?.primary_goal, 'stabilize');
  assert.strictEqual(updated.rationale_json?.questionnaire?.debt_priority_mode, 'snowball');
  assert.strictEqual(updated.rationale_json?.lifecycle?.edited, true);
  assert.strictEqual(updated.rationale_json?.lifecycle?.accepted, false);

  const acceptance = await acceptDraftPlan({ userId });

  assert(acceptance.plan, 'Expected accepted plan payload');
  assert.strictEqual(acceptance.plan.status, 'active');
  assert.strictEqual(typeof acceptance.applied_month, 'number');
  assert.strictEqual(typeof acceptance.applied_year, 'number');
  assert.strictEqual(acceptance.plan.rationale_json?.lifecycle?.accepted, true);
  assert.strictEqual(acceptance.plan.rationale_json?.lifecycle?.active, true);
  assert(['balanced', 'tight', 'deficit'].includes(acceptance.plan.health_state));

  const onboardingStatusAfterAccept = await getOnboardingStatus({ userId });
  assert.strictEqual(onboardingStatusAfterAccept.onboarding_required, false);
  assert.strictEqual(onboardingStatusAfterAccept.onboarding_completed, true);

  const budgetRows = await db.query(
    `SELECT b.category_id, b.monthly_limit
     FROM budgets b
     WHERE b.user_id = $1
       AND b.month = $2
       AND b.year = $3`,
    [userId, acceptance.applied_month, acceptance.applied_year]
  );

  assert(budgetRows.rows.length > 0, 'Expected budgets to be projected on accept');

  const debtBudget = budgetRows.rows.find((row) => Number(row.category_id) === debtCategoryId);
  assert(debtBudget, 'Expected debt repayment category to be projected into budgets');

  const currentPlanHeader = await getCurrentPlanForUser({ userId });
  assert(currentPlanHeader, 'Expected current plan header');
  const hydratedCurrentPlan = await mapPlanResponse({ planHeader: currentPlanHeader });
  assert.strictEqual(hydratedCurrentPlan.status, 'active');
};

const main = async () => {
  await runMigrations();

  try {
    await testDraftLifecycleAndAcceptProjection();
    console.log('onboardingBudgetPlan.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('onboardingBudgetPlan.test.js failed:', err.message);
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('onboardingBudgetPlan.test.js fatal error:', err.message);
  process.exit(1);
});
