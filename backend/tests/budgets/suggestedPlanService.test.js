const assert = require('assert');

const {
  classifyOccupation,
  resolveCityMultiplier,
  normalizeQuestionnaire,
  generateSuggestedPlan,
} = require('../../services/budgets/suggestedPlanService');

const almostEqual = (a, b, tolerance = 0.02) => Math.abs(Number(a) - Number(b)) <= tolerance;

const getAllocation = (plan, categoryName) =>
  plan.allocations.find((item) => item.category_name === categoryName);

const testOccupationClassification = () => {
  assert.strictEqual(classifyOccupation('Software Engineer'), 'salaried');
  assert.strictEqual(classifyOccupation('Freelancer Designer'), 'freelancer');
  assert.strictEqual(classifyOccupation('Student'), 'student');
  assert.strictEqual(classifyOccupation('Unemployed'), 'low_income');
  assert.strictEqual(classifyOccupation('Homemaker'), 'homemaker');
  assert.strictEqual(classifyOccupation(''), 'other');
};

const testCityMultiplier = () => {
  assert.strictEqual(resolveCityMultiplier('Islamabad'), 1.1);
  assert.strictEqual(resolveCityMultiplier('Rawalpindi'), 1.05);
  assert.strictEqual(resolveCityMultiplier('Unknown City'), 1);
};

const testNoDebtPlanTotals = () => {
  const plan = generateSuggestedPlan({
    monthly_income: 200000,
    occupation: 'Salaried Engineer',
    city: 'Islamabad',
    debt_input: {
      has_debt: false,
    },
  });

  const debtAllocation = getAllocation(plan, 'Debt Repayment');
  assert(debtAllocation, 'Expected Debt Repayment allocation');
  assert.strictEqual(debtAllocation.allocation_amount, 0);

  const allocationTotal = Number(plan.allocations.reduce((sum, item) => sum + item.allocation_amount, 0).toFixed(2));
  const committedTotal = Number((allocationTotal + plan.recommended_savings_amount).toFixed(2));

  assert(almostEqual(committedTotal, plan.monthly_income_snapshot), 'Expected committed total to match income');
  assert(plan.recommended_savings_amount > 0, 'Expected positive savings amount');
  assert.strictEqual(plan.has_debt, false);
};

const testDebtPriorityImpactsRepayment = () => {
  const mediumPlan = generateSuggestedPlan({
    monthly_income: 150000,
    occupation: 'Salaried',
    city: 'Karachi',
    debt_input: {
      has_debt: true,
      debt_amount: 300000,
      minimum_monthly_debt_payment: 7000,
      debt_priority: 'medium',
      debt_priority_mode: 'snowball',
    },
    questionnaire: {
      debt_priority_mode: 'snowball',
    },
  });

  const highPlan = generateSuggestedPlan({
    monthly_income: 150000,
    occupation: 'Salaried',
    city: 'Karachi',
    debt_input: {
      has_debt: true,
      debt_amount: 300000,
      minimum_monthly_debt_payment: 7000,
      debt_priority: 'high',
      debt_priority_mode: 'avalanche',
    },
    questionnaire: {
      debt_priority_mode: 'avalanche',
    },
  });

  const mediumDebt = getAllocation(mediumPlan, 'Debt Repayment');
  const highDebt = getAllocation(highPlan, 'Debt Repayment');

  assert(mediumDebt, 'Expected medium debt allocation');
  assert(highDebt, 'Expected high debt allocation');
  assert(highDebt.allocation_amount > mediumDebt.allocation_amount, 'High priority should increase debt repayment');
  assert(highPlan.recommended_savings_amount <= mediumPlan.recommended_savings_amount, 'High debt priority should not increase savings');
  assert.strictEqual(highPlan.rationale_json.debt_calculation.debt_priority_mode, 'avalanche');
};

const testConstrainedIncomeAddsFlags = () => {
  const plan = generateSuggestedPlan({
    monthly_income: 40000,
    occupation: 'Unemployed',
    city: 'Lahore',
    debt_input: {
      has_debt: true,
      debt_amount: 250000,
      minimum_monthly_debt_payment: 25000,
      debt_priority: 'high',
      debt_priority_mode: 'avalanche',
    },
    questionnaire: {
      housing_cost: 18000,
      utilities_cost: 5000,
      groceries_baseline: 8000,
      primary_goal: 'pay_debt',
    },
  });

  const flags = plan.rationale_json?.flags || [];
  assert(Array.isArray(flags), 'Expected rationale flags array');
  assert(flags.length > 0, 'Expected at least one rationale flag in constrained setup');
  assert(['tight', 'deficit'].includes(plan.rationale_json?.health_state), 'Expected constrained health state');

  const discretionary = getAllocation(plan, 'Entertainment');
  const essentials = getAllocation(plan, 'Bills');
  assert(discretionary && essentials, 'Expected discretionary and essential buckets');
  assert(essentials.allocation_amount >= discretionary.allocation_amount, 'Essentials should be protected over discretionary categories');
};

const testQuestionnaireNormalization = () => {
  const normalized = normalizeQuestionnaire({
    fixed_obligations: [
      { name: 'Rent', amount: 50000, category_hint: 'rent' },
      { name: 'Internet', amount: 4000, category_hint: 'utility bill' },
      { name: 'Ignored', amount: -20, category_hint: 'other' },
    ],
    household_size: 3,
    dependents_count: 2,
    risk_tolerance: 'LOW',
    financial_priorities: ['Debt Reduction', 'Emergency Fund', 'Debt Reduction'],
    savings_goal_mode: 'aggressive',
    income_stability: 'SEASONAL',
    housing_cost: 45000,
    utilities_cost: 9000,
    groceries_baseline: 24000,
    transport_baseline: 12000,
    essential_subscriptions_or_fees: 3500,
    emergency_savings_current: 50000,
    primary_goal: 'save_more',
    debt_priority_mode: 'snowball',
  });

  assert.strictEqual(normalized.fixed_obligations.length, 2);
  assert.strictEqual(normalized.fixed_obligations[0].category_hint, 'Bills');
  assert.strictEqual(normalized.household_size, 3);
  assert.strictEqual(normalized.dependents_count, 2);
  assert.strictEqual(normalized.risk_tolerance, 'low');
  assert.deepStrictEqual(normalized.financial_priorities, ['debt_reduction', 'emergency_fund']);
  assert.strictEqual(normalized.savings_goal_mode, 'aggressive');
  assert.strictEqual(normalized.income_stability, 'seasonal');
  assert.strictEqual(normalized.housing_cost, 45000);
  assert.strictEqual(normalized.utilities_cost, 9000);
  assert.strictEqual(normalized.groceries_baseline, 24000);
  assert.strictEqual(normalized.transport_baseline, 12000);
  assert.strictEqual(normalized.essential_subscriptions_or_fees, 3500);
  assert.strictEqual(normalized.emergency_savings_current, 50000);
  assert.strictEqual(normalized.primary_goal, 'save_more');
  assert.strictEqual(normalized.debt_priority_mode, 'snowball');
};

const testObligationsReservedFirst = () => {
  const plan = generateSuggestedPlan({
    monthly_income: 200000,
    occupation: 'Salaried Engineer',
    city: 'Islamabad',
    debt_input: {
      has_debt: false,
    },
    questionnaire: {
      fixed_obligations: [
        { name: 'Rent', amount: 60000, category_hint: 'rent' },
        { name: 'School Fee', amount: 10000, category_hint: 'education' },
      ],
      housing_cost: 20000,
      utilities_cost: 5000,
      groceries_baseline: 9000,
      transport_baseline: 6000,
      essential_subscriptions_or_fees: 3000,
      savings_goal_mode: 'balanced',
    },
  });

  const bills = getAllocation(plan, 'Bills');
  const education = getAllocation(plan, 'Education');
  const groceries = getAllocation(plan, 'Groceries');
  const transport = getAllocation(plan, 'Transport');
  const subscriptions = getAllocation(plan, 'Subscriptions');

  assert(bills && education && groceries && transport && subscriptions, 'Expected baseline obligation categories');
  assert(bills.allocation_amount >= 85000, 'Bills should include fixed obligations and housing/utilities baselines');
  assert(education.allocation_amount >= 10000, 'Education should include reserved obligations');
  assert(groceries.allocation_amount >= 9000, 'Groceries should include baseline');
  assert(transport.allocation_amount >= 6000, 'Transport should include baseline');
  assert(subscriptions.allocation_amount >= 3000, 'Subscriptions should include baseline obligations');

  const stageTotals = plan.rationale_json?.stage_totals || {};
  assert.strictEqual(Number(stageTotals.fixed_obligations_total || 0), 113000);
};

const testHealthStateAndLifecycleMetadata = () => {
  const balancedPlan = generateSuggestedPlan({
    monthly_income: 220000,
    occupation: 'Salaried Engineer',
    city: 'Islamabad',
    debt_input: {
      has_debt: false,
    },
    questionnaire: {
      income_stability: 'fixed',
      primary_goal: 'balanced',
      housing_cost: 45000,
      groceries_baseline: 18000,
      transport_baseline: 9000,
      emergency_savings_current: 120000,
    },
  });

  assert.strictEqual(balancedPlan.rationale_json?.health_state, 'balanced');
  assert.strictEqual(balancedPlan.rationale_json?.lifecycle?.suggested, true);
  assert.strictEqual(balancedPlan.rationale_json?.lifecycle?.edited, false);

  const tightPlan = generateSuggestedPlan({
    monthly_income: 90000,
    occupation: 'Salaried',
    city: 'Karachi',
    debt_input: {
      has_debt: true,
      debt_amount: 200000,
      minimum_monthly_debt_payment: 18000,
      debt_priority: 'high',
      debt_priority_mode: 'avalanche',
    },
    questionnaire: {
      primary_goal: 'pay_debt',
      housing_cost: 42000,
      utilities_cost: 9000,
      groceries_baseline: 16000,
      transport_baseline: 8000,
      emergency_savings_current: 15000,
    },
  });

  assert(['tight', 'deficit'].includes(tightPlan.rationale_json?.health_state));
};

(() => {
  try {
    testOccupationClassification();
    testCityMultiplier();
    testNoDebtPlanTotals();
    testDebtPriorityImpactsRepayment();
    testConstrainedIncomeAddsFlags();
    testQuestionnaireNormalization();
    testObligationsReservedFirst();
    testHealthStateAndLifecycleMetadata();

    console.log('suggestedPlanService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('suggestedPlanService.test.js failed:', err.message);
    process.exit(1);
  }
})();
