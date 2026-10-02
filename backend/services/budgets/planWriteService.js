const db = require('../../db/db');
const {
  parseMonthYear,
  requireExpenseCategoryById,
  findExpenseCategoryByName,
  upsertBudget,
} = require('./budgetWriteService');
const {
  generateSuggestedPlan,
  normalizeDebtInput,
  normalizeQuestionnaire,
} = require('./suggestedPlanService');

const PLAN_STATUSES = new Set(['draft', 'active', 'archived']);

const toPositiveInt = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const err = new Error(`${fieldName} must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }

  return numeric;
};

const toNonNegativeNumber = (value, fieldName, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const err = new Error(`${fieldName} must be a non-negative number`);
    err.statusCode = 400;
    throw err;
  }

  return Number(numeric.toFixed(2));
};

const toTrimmedNullableText = (value, maxLength, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;

  if (maxLength && normalized.length > maxLength) {
    const err = new Error(`${fieldName} must be ${maxLength} characters or less`);
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const toPriorityNullable = (value, fieldName = 'debt_priority') => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const normalized = String(value).trim().toLowerCase();
  if (normalized !== 'low' && normalized !== 'medium' && normalized !== 'high') {
    const err = new Error(`${fieldName} must be low, medium, or high`);
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const toRoundedPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(3));
};

const normalizeStatus = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!PLAN_STATUSES.has(normalized)) {
    const err = new Error('Invalid plan status');
    err.statusCode = 400;
    throw err;
  }

  return normalized;
};

const normalizeSource = (value, fallback = 'system') => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return normalized.slice(0, 50);
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const readPayloadValue = (payload, snakeKey, camelKey) => {
  if (hasOwn(payload, snakeKey)) return payload[snakeKey];
  if (camelKey && hasOwn(payload, camelKey)) return payload[camelKey];
  return undefined;
};

const toBooleanInput = (value, fallback = false) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

const resolveHealthStateFromTotals = ({ monthlyIncome, remainingBalance, affordabilityRatio }) => {
  if (remainingBalance < 0) return 'deficit';
  if (monthlyIncome <= 0) return 'tight';

  const safeAffordabilityRatio = Number(affordabilityRatio || 0);
  if (safeAffordabilityRatio > 0 && safeAffordabilityRatio < 0.2) return 'tight';

  return 'balanced';
};

const assertDebtMinimumPayment = ({ hasDebt, minimumMonthlyDebtPayment }) => {
  if (!hasDebt) return;

  const numeric = Number(minimumMonthlyDebtPayment || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const err = new Error('minimum_monthly_debt_payment is required and must be greater than 0 when has_debt is true');
    err.statusCode = 400;
    throw err;
  }
};

const snapshotAllocations = (allocations = []) => {
  return allocations.map((item) => ({
    category_id: Number(item?.category_id || 0),
    category_name: item?.category_name || null,
    allocation_amount: Number(item?.allocation_amount || 0),
    is_debt_allocation: item?.is_debt_allocation === true,
  }));
};

const computeAllocationDeltas = ({ baselineAllocations = [], currentAllocations = [] }) => {
  const baselineByCategory = new Map();
  baselineAllocations.forEach((item) => {
    baselineByCategory.set(Number(item.category_id), {
      amount: Number(item.allocation_amount || 0),
      category_name: item.category_name || null,
    });
  });

  const currentByCategory = new Map();
  currentAllocations.forEach((item) => {
    currentByCategory.set(Number(item.category_id), {
      amount: Number(item.allocation_amount || 0),
      category_name: item.category_name || null,
    });
  });

  const touchedIds = new Set([...baselineByCategory.keys(), ...currentByCategory.keys()]);
  const deltas = [];

  for (const categoryId of touchedIds) {
    const baseline = baselineByCategory.get(categoryId);
    const current = currentByCategory.get(categoryId);
    const baselineAmount = Number(baseline?.amount || 0);
    const currentAmount = Number(current?.amount || 0);
    const delta = Number((currentAmount - baselineAmount).toFixed(2));

    if (Math.abs(delta) < 0.01) continue;

    deltas.push({
      category_id: categoryId,
      category_name: current?.category_name || baseline?.category_name || null,
      baseline_amount: baselineAmount,
      current_amount: currentAmount,
      delta_amount: delta,
    });
  }

  return deltas;
};

const mergeQuestionnaireFromPayload = ({ payload = {}, existingQuestionnaire = {} }) => {
  const merged = {
    fixed_obligations:
      readPayloadValue(payload, 'fixed_obligations', 'fixedObligations')
      ?? existingQuestionnaire.fixed_obligations,
    household_size:
      readPayloadValue(payload, 'household_size', 'householdSize')
      ?? existingQuestionnaire.household_size,
    dependents_count:
      readPayloadValue(payload, 'dependents_count', 'dependentsCount')
      ?? existingQuestionnaire.dependents_count,
    risk_tolerance:
      readPayloadValue(payload, 'risk_tolerance', 'riskTolerance')
      ?? existingQuestionnaire.risk_tolerance,
    financial_priorities:
      readPayloadValue(payload, 'financial_priorities', 'financialPriorities')
      ?? existingQuestionnaire.financial_priorities,
    savings_goal_mode:
      readPayloadValue(payload, 'savings_goal_mode', 'savingsGoalMode')
      ?? existingQuestionnaire.savings_goal_mode,
    income_stability:
      readPayloadValue(payload, 'income_stability', 'incomeStability')
      ?? existingQuestionnaire.income_stability,
    housing_cost:
      readPayloadValue(payload, 'housing_cost', 'housingCost')
      ?? existingQuestionnaire.housing_cost,
    utilities_cost:
      readPayloadValue(payload, 'utilities_cost', 'utilitiesCost')
      ?? existingQuestionnaire.utilities_cost,
    groceries_baseline:
      readPayloadValue(payload, 'groceries_baseline', 'groceriesBaseline')
      ?? existingQuestionnaire.groceries_baseline,
    transport_baseline:
      readPayloadValue(payload, 'transport_baseline', 'transportBaseline')
      ?? existingQuestionnaire.transport_baseline,
    essential_subscriptions_or_fees:
      readPayloadValue(payload, 'essential_subscriptions_or_fees', 'essentialSubscriptionsOrFees')
      ?? existingQuestionnaire.essential_subscriptions_or_fees,
    emergency_savings_current:
      readPayloadValue(payload, 'emergency_savings_current', 'emergencySavingsCurrent')
      ?? existingQuestionnaire.emergency_savings_current,
    primary_goal:
      readPayloadValue(payload, 'primary_goal', 'primaryGoal')
      ?? existingQuestionnaire.primary_goal,
    debt_priority_mode:
      readPayloadValue(payload, 'debt_priority_mode', 'debtPriorityMode')
      ?? existingQuestionnaire.debt_priority_mode,
  };

  return normalizeQuestionnaire(merged);
};

const fetchUserProfile = async ({ userId, dbClient = db }) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const result = await dbClient.query(
    `SELECT user_id, monthly_income, occupation, city
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [safeUserId]
  );

  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const row = result.rows[0];

  return {
    user_id: Number(row.user_id),
    monthly_income: Number(row.monthly_income || 0),
    occupation: row.occupation || null,
    city: row.city || null,
  };
};

const archiveDraftPlans = async ({ userId, dbClient = db }) => {
  await dbClient.query(
    `UPDATE budget_plans
     SET status = 'archived',
         updated_at = NOW()
     WHERE user_id = $1
       AND status = 'draft'`,
    [userId]
  );
};

const insertPlanHeader = async ({
  userId,
  status,
  source,
  suggested,
  dbClient = db,
}) => {
  const safeStatus = normalizeStatus(status);
  const safeSource = normalizeSource(source);
  const acceptedAt = safeStatus === 'active' ? new Date() : null;

  const result = await dbClient.query(
    `INSERT INTO budget_plans (
       user_id,
       status,
       source,
       monthly_income_snapshot,
       occupation_snapshot,
       city_snapshot,
       has_debt,
       debt_amount,
       minimum_monthly_debt_payment,
       debt_priority,
       debt_type,
       debt_notes,
       recommended_monthly_debt_payment,
       recommended_savings_amount,
       recommended_savings_percent,
       rationale_json,
       accepted_at,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3,
       $4, $5, $6,
       $7, $8, $9, $10, $11, $12,
       $13, $14, $15,
       $16,
       $17,
       NOW(), NOW()
     )
     RETURNING *`,
    [
      userId,
      safeStatus,
      safeSource,
      Number(suggested.monthly_income_snapshot || 0),
      suggested.occupation_snapshot || null,
      suggested.city_snapshot || null,
      Boolean(suggested.has_debt),
      suggested.debt_amount,
      suggested.minimum_monthly_debt_payment,
      suggested.debt_priority || null,
      suggested.debt_type || null,
      suggested.debt_notes || null,
      Number(suggested.recommended_monthly_debt_payment || 0),
      Number(suggested.recommended_savings_amount || 0),
      Number(suggested.recommended_savings_percent || 0),
      suggested.rationale_json || {},
      acceptedAt,
    ]
  );

  return result.rows[0];
};

const normalizeAllocationInput = async ({
  allocations,
  monthlyIncome,
  dbClient = db,
}) => {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    const err = new Error('allocations must be a non-empty array');
    err.statusCode = 400;
    throw err;
  }

  const normalized = [];

  for (const raw of allocations) {
    const amount = toNonNegativeNumber(raw?.allocation_amount, 'allocation_amount');

    let category;
    if (raw?.category_id !== undefined && raw?.category_id !== null) {
      category = await requireExpenseCategoryById({
        categoryId: raw.category_id,
        dbClient,
      });
    } else {
      category = await findExpenseCategoryByName({
        categoryName: raw?.category_name,
        dbClient,
      });
    }

    const allocationPercent = monthlyIncome > 0
      ? toRoundedPercent((amount / monthlyIncome) * 100)
      : 0;

    const categoryName = category.name;
    const explicitDebtFlag = raw?.is_debt_allocation === true;
    const inferredDebtFlag = String(categoryName || '').trim().toLowerCase() === 'debt repayment';

    normalized.push({
      category_id: Number(category.category_id),
      category_name: categoryName,
      allocation_amount: amount,
      allocation_percent: allocationPercent,
      is_debt_allocation: explicitDebtFlag || inferredDebtFlag,
    });
  }

  const dedupe = new Map();
  for (const item of normalized) {
    dedupe.set(item.category_id, item);
  }

  return Array.from(dedupe.values());
};

const replacePlanAllocations = async ({
  planId,
  allocations,
  monthlyIncome,
  dbClient = db,
}) => {
  await dbClient.query(
    `DELETE FROM budget_plan_allocations
     WHERE plan_id = $1`,
    [planId]
  );

  const normalized = await normalizeAllocationInput({
    allocations,
    monthlyIncome,
    dbClient,
  });

  for (const item of normalized) {
    await dbClient.query(
      `INSERT INTO budget_plan_allocations (
         plan_id,
         category_id,
         allocation_amount,
         allocation_percent,
         is_debt_allocation,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        planId,
        item.category_id,
        item.allocation_amount,
        item.allocation_percent,
        item.is_debt_allocation,
      ]
    );
  }

  return normalized;
};

const getPlanHeaderById = async ({ userId, planId, dbClient = db }) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const safePlanId = toPositiveInt(planId, 'plan_id');

  const result = await dbClient.query(
    `SELECT *
     FROM budget_plans
     WHERE plan_id = $1
       AND user_id = $2
     LIMIT 1`,
    [safePlanId, safeUserId]
  );

  return result.rows[0] || null;
};

const getPlanAllocations = async ({ planId, dbClient = db }) => {
  const result = await dbClient.query(
    `SELECT
       a.allocation_id,
       a.plan_id,
       a.category_id,
       c.name AS category_name,
       c.icon AS category_icon,
       c.color AS category_color,
       c.type AS category_type,
       a.allocation_amount,
       a.allocation_percent,
       a.is_debt_allocation,
       a.created_at,
       a.updated_at
     FROM budget_plan_allocations a
     JOIN categories c ON c.category_id = a.category_id
     WHERE a.plan_id = $1
     ORDER BY c.name`,
    [planId]
  );

  return result.rows.map((row) => ({
    ...row,
    allocation_amount: Number(row.allocation_amount || 0),
    allocation_percent: Number(row.allocation_percent || 0),
  }));
};

const mapPlanResponse = async ({ planHeader, dbClient = db }) => {
  if (!planHeader) return null;

  const allocations = await getPlanAllocations({
    planId: planHeader.plan_id,
    dbClient,
  });

  const allocationTotal = Number(
    allocations.reduce((sum, item) => sum + Number(item.allocation_amount || 0), 0).toFixed(2)
  );
  const savingsAmount = Number(planHeader.recommended_savings_amount || 0);
  const monthlyIncome = Number(planHeader.monthly_income_snapshot || 0);
  const remainingBalance = Number((monthlyIncome - allocationTotal - savingsAmount).toFixed(2));

  const rationale = {
    ...(planHeader.rationale_json || {}),
  };

  const inferredHealthState = resolveHealthStateFromTotals({
    monthlyIncome,
    remainingBalance,
    affordabilityRatio: Number(rationale?.affordability_ratio || 0) / 100,
  });

  rationale.health_state = rationale.health_state || inferredHealthState;

  const existingLifecycle = rationale.lifecycle || {};
  rationale.lifecycle = {
    ...existingLifecycle,
    suggested: true,
    edited: Boolean(existingLifecycle.edited || rationale?.edited_by_user),
    accepted: planHeader.status === 'active',
    active: planHeader.status === 'active',
  };

  rationale.totals = {
    ...(rationale.totals || {}),
    monthly_income: monthlyIncome,
    allocation_total: allocationTotal,
    savings_amount: savingsAmount,
    total_committed: Number((allocationTotal + savingsAmount).toFixed(2)),
    remaining_balance: remainingBalance,
  };

  return {
    ...planHeader,
    rationale_json: rationale,
    health_state: rationale.health_state,
    lifecycle: rationale.lifecycle,
    monthly_income_snapshot: monthlyIncome,
    debt_amount: planHeader.debt_amount === null ? null : Number(planHeader.debt_amount || 0),
    minimum_monthly_debt_payment:
      planHeader.minimum_monthly_debt_payment === null
        ? null
        : Number(planHeader.minimum_monthly_debt_payment || 0),
    recommended_monthly_debt_payment: Number(planHeader.recommended_monthly_debt_payment || 0),
    recommended_savings_amount: savingsAmount,
    recommended_savings_percent: Number(planHeader.recommended_savings_percent || 0),
    allocations,
    totals: {
      monthly_income: monthlyIncome,
      allocation_total: allocationTotal,
      savings_amount: savingsAmount,
      committed_total: Number((allocationTotal + savingsAmount).toFixed(2)),
      remaining_balance: remainingBalance,
    },
  };
};

const getCurrentDraftPlan = async ({ userId, dbClient = db }) => {
  const result = await dbClient.query(
    `SELECT *
     FROM budget_plans
     WHERE user_id = $1
       AND status = 'draft'
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

const getCurrentPlanForUser = async ({ userId, dbClient = db }) => {
  const result = await dbClient.query(
    `SELECT *
     FROM budget_plans
     WHERE user_id = $1
       AND status IN ('draft', 'active')
     ORDER BY CASE WHEN status = 'draft' THEN 0 ELSE 1 END,
              updated_at DESC,
              created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

const getOnboardingStatus = async ({ userId, dbClient = db }) => {
  const result = await dbClient.query(
    `SELECT
       EXISTS(
         SELECT 1 FROM budget_plans
         WHERE user_id = $1 AND status = 'draft'
       ) AS has_draft,
       EXISTS(
         SELECT 1 FROM budget_plans
         WHERE user_id = $1 AND status = 'active'
       ) AS has_active`,
    [userId]
  );

  const row = result.rows[0] || { has_draft: false, has_active: false };
  const hasDraft = row.has_draft === true;
  const hasActive = row.has_active === true;

  return {
    onboarding_required: hasDraft,
    onboarding_completed: hasActive && !hasDraft,
    has_draft_plan: hasDraft,
    has_active_plan: hasActive,
  };
};

const createOrReplaceDraftPlan = async ({
  userId,
  profile,
  debtInput,
  questionnaire,
  source = 'system',
  dbClient = db,
}) => {
  const normalizedQuestionnaire = normalizeQuestionnaire(questionnaire || {});

  const suggested = generateSuggestedPlan({
    monthly_income: profile.monthly_income,
    occupation: profile.occupation,
    city: profile.city,
    debt_input: debtInput,
    questionnaire: normalizedQuestionnaire,
  });

  const nextRationale = {
    ...(suggested.rationale_json || {}),
    health_state: suggested?.rationale_json?.health_state || 'balanced',
    lifecycle: {
      suggested: true,
      edited: false,
      accepted: false,
      active: false,
    },
  };

  suggested.rationale_json = nextRationale;

  await archiveDraftPlans({ userId, dbClient });

  const planHeader = await insertPlanHeader({
    userId,
    status: 'draft',
    source,
    suggested,
    dbClient,
  });

  await replacePlanAllocations({
    planId: planHeader.plan_id,
    allocations: suggested.allocations,
    monthlyIncome: Number(suggested.monthly_income_snapshot || 0),
    dbClient,
  });

  return mapPlanResponse({ planHeader, dbClient });
};

const createOrReplaceDraftPlanFromUser = async ({
  userId,
  source = 'signup',
  debtInput = {},
  questionnaire = {},
  dbClient = db,
}) => {
  const profile = await fetchUserProfile({ userId, dbClient });
  const normalizedDebt = normalizeDebtInput(debtInput);
  assertDebtMinimumPayment({
    hasDebt: normalizedDebt.has_debt,
    minimumMonthlyDebtPayment: normalizedDebt.minimum_monthly_debt_payment,
  });

  const normalizedQuestionnaire = normalizeQuestionnaire(questionnaire);

  return createOrReplaceDraftPlan({
    userId,
    profile,
    debtInput: normalizedDebt,
    questionnaire: normalizedQuestionnaire,
    source,
    dbClient,
  });
};

const getActivePlanForUser = async ({ userId, dbClient = db }) => {
  const result = await dbClient.query(
    `SELECT *
     FROM budget_plans
     WHERE user_id = $1
       AND status = 'active'
     ORDER BY accepted_at DESC NULLS LAST, updated_at DESC, created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

const previewDraftPlan = async ({ userId, payload = {}, dbClient = db }) => {
  const profile = await fetchUserProfile({ userId, dbClient });
  const currentDraft = await getCurrentDraftPlan({ userId, dbClient });

  const monthlyIncomeInput = readPayloadValue(payload, 'monthly_income', 'monthlyIncome');
  const occupationInput = readPayloadValue(payload, 'occupation', 'occupation');
  const cityInput = readPayloadValue(payload, 'city', 'city');

  const nextProfile = {
    monthly_income: monthlyIncomeInput !== undefined
      ? toNonNegativeNumber(monthlyIncomeInput, 'monthly_income')
      : Number(currentDraft?.monthly_income_snapshot || profile.monthly_income),
    occupation: toTrimmedNullableText(occupationInput, 100, 'occupation')
      ?? currentDraft?.occupation_snapshot
      ?? profile.occupation,
    city: toTrimmedNullableText(cityInput, 100, 'city')
      ?? currentDraft?.city_snapshot
      ?? profile.city,
  };

  const hasDebt = toBooleanInput(
    readPayloadValue(payload, 'has_debt', 'hasDebt'),
    Boolean(currentDraft?.has_debt)
  );

  const debtInput = normalizeDebtInput({
    has_debt: hasDebt,
    debt_amount: readPayloadValue(payload, 'debt_amount', 'debtAmount')
      ?? currentDraft?.debt_amount,
    minimum_monthly_debt_payment: readPayloadValue(
      payload,
      'minimum_monthly_debt_payment',
      'minimumMonthlyDebtPayment'
    ) ?? currentDraft?.minimum_monthly_debt_payment,
    debt_priority: readPayloadValue(payload, 'debt_priority', 'debtPriority')
      ?? currentDraft?.debt_priority,
    debt_priority_mode: readPayloadValue(payload, 'debt_priority_mode', 'debtPriorityMode')
      ?? currentDraft?.rationale_json?.questionnaire?.debt_priority_mode,
    debt_type: readPayloadValue(payload, 'debt_type', 'debtType')
      ?? currentDraft?.debt_type,
    debt_notes: readPayloadValue(payload, 'debt_notes', 'debtNotes')
      ?? currentDraft?.debt_notes,
  });

  assertDebtMinimumPayment({
    hasDebt: debtInput.has_debt,
    minimumMonthlyDebtPayment: debtInput.minimum_monthly_debt_payment,
  });

  const questionnaire = mergeQuestionnaireFromPayload({
    payload,
    existingQuestionnaire: currentDraft?.rationale_json?.questionnaire || {},
  });

  return createOrReplaceDraftPlan({
    userId,
    profile: nextProfile,
    debtInput,
    questionnaire,
    source: 'preview',
    dbClient,
  });
};

const updateDraftPlan = async ({ userId, payload = {}, dbClient = db }) => {
  const draft = await getCurrentDraftPlan({ userId, dbClient });
  if (!draft) {
    const err = new Error('Draft onboarding plan not found');
    err.statusCode = 404;
    throw err;
  }

  const monthlyIncomeInput = readPayloadValue(payload, 'monthly_income', 'monthlyIncome');
  const monthlyIncome = monthlyIncomeInput !== undefined
    ? toNonNegativeNumber(monthlyIncomeInput, 'monthly_income')
    : Number(draft.monthly_income_snapshot || 0);

  const nextOccupation = toTrimmedNullableText(
    readPayloadValue(payload, 'occupation', 'occupation'),
    100,
    'occupation_snapshot'
  );
  const nextCity = toTrimmedNullableText(
    readPayloadValue(payload, 'city', 'city'),
    100,
    'city_snapshot'
  );

  const hasDebt = toBooleanInput(
    readPayloadValue(payload, 'has_debt', 'hasDebt'),
    Boolean(draft.has_debt)
  );

  const debtAmountInput = readPayloadValue(payload, 'debt_amount', 'debtAmount');
  const minimumDebtInput = readPayloadValue(
    payload,
    'minimum_monthly_debt_payment',
    'minimumMonthlyDebtPayment'
  );
  const debtPriorityInput = readPayloadValue(payload, 'debt_priority', 'debtPriority');
  const debtTypeInput = readPayloadValue(payload, 'debt_type', 'debtType');
  const debtNotesInput = readPayloadValue(payload, 'debt_notes', 'debtNotes');

  const debtAmount = hasDebt
    ? toNonNegativeNumber(
      debtAmountInput !== undefined ? debtAmountInput : draft.debt_amount,
      'debt_amount'
    )
    : null;

  const minimumMonthlyDebtPayment = hasDebt
    ? toNonNegativeNumber(
      minimumDebtInput !== undefined ? minimumDebtInput : draft.minimum_monthly_debt_payment,
      'minimum_monthly_debt_payment'
    )
    : null;

  const debtPriority = hasDebt
    ? (toPriorityNullable(
      debtPriorityInput !== undefined ? debtPriorityInput : draft.debt_priority
    ) || 'medium')
    : null;

  const debtType = hasDebt
    ? toTrimmedNullableText(
      debtTypeInput !== undefined ? debtTypeInput : draft.debt_type,
      80,
      'debt_type'
    )
    : null;

  const debtNotes = hasDebt
    ? toTrimmedNullableText(
      debtNotesInput !== undefined ? debtNotesInput : draft.debt_notes,
      5000,
      'debt_notes'
    )
    : null;

  assertDebtMinimumPayment({
    hasDebt,
    minimumMonthlyDebtPayment,
  });

  const recommendedSavingsInput = readPayloadValue(
    payload,
    'recommended_savings_amount',
    'recommendedSavingsAmount'
  );
  const recommendedDebtInput = readPayloadValue(
    payload,
    'recommended_monthly_debt_payment',
    'recommendedMonthlyDebtPayment'
  );

  const recommendedSavingsAmount = toNonNegativeNumber(
    recommendedSavingsInput !== undefined
      ? recommendedSavingsInput
      : draft.recommended_savings_amount,
    'recommended_savings_amount'
  );

  const recommendedDebtPayment = hasDebt
    ? toNonNegativeNumber(
      recommendedDebtInput !== undefined
        ? recommendedDebtInput
        : draft.recommended_monthly_debt_payment,
      'recommended_monthly_debt_payment'
    )
    : 0;

  const questionnaire = mergeQuestionnaireFromPayload({
    payload,
    existingQuestionnaire: draft.rationale_json?.questionnaire || {},
  });

  const allocationInput = readPayloadValue(payload, 'allocations', 'allocations');
  const allocations = allocationInput !== undefined
    ? allocationInput
    : await getPlanAllocations({ planId: draft.plan_id, dbClient });

  const normalizedAllocations = await normalizeAllocationInput({
    allocations,
    monthlyIncome,
    dbClient,
  });

  const baselineAllocations = await getPlanAllocations({
    planId: draft.plan_id,
    dbClient,
  });

  const allocationTotal = normalizedAllocations.reduce(
    (sum, item) => sum + Number(item.allocation_amount || 0),
    0
  );
  const committed = Number((allocationTotal + recommendedSavingsAmount).toFixed(2));
  const remainingBalance = Number((monthlyIncome - committed).toFixed(2));

  const previousRationale = draft.rationale_json || {};
  const previousQuestionnaire = normalizeQuestionnaire(previousRationale.questionnaire || {});
  const deltas = computeAllocationDeltas({
    baselineAllocations,
    currentAllocations: normalizedAllocations,
  });

  const affordabilityRatio = Number(previousRationale?.affordability_ratio || 0) / 100;

  const healthState = resolveHealthStateFromTotals({
    monthlyIncome,
    remainingBalance,
    affordabilityRatio,
  });

  const nextRationale = {
    ...previousRationale,
    edited_by_user: true,
    health_state: healthState,
    questionnaire,
    totals: {
      monthly_income: monthlyIncome,
      allocation_total: Number(allocationTotal.toFixed(2)),
      total_committed: committed,
      remaining_balance: remainingBalance,
    },
    allocation_guardrails: {
      ...(previousRationale.allocation_guardrails || {}),
      acceptance_blocked: remainingBalance < 0,
    },
    lifecycle: {
      ...(previousRationale.lifecycle || {}),
      suggested: true,
      edited: true,
      accepted: false,
      active: false,
    },
    adjustment_meta: {
      user_adjusted_categories: deltas.map((item) => item.category_name).filter(Boolean),
      delta_from_suggestion: deltas,
      savings_delta: Number((recommendedSavingsAmount - Number(draft.recommended_savings_amount || 0)).toFixed(2)),
      debt_delta: Number((recommendedDebtPayment - Number(draft.recommended_monthly_debt_payment || 0)).toFixed(2)),
      questionnaire_changed: JSON.stringify(previousQuestionnaire) !== JSON.stringify(questionnaire),
      edited_at: new Date().toISOString(),
    },
  };

  await dbClient.query(
    `UPDATE budget_plans
     SET monthly_income_snapshot = $1,
         occupation_snapshot = $2,
         city_snapshot = $3,
         has_debt = $4,
         debt_amount = $5,
         minimum_monthly_debt_payment = $6,
         debt_priority = $7,
         debt_type = $8,
         debt_notes = $9,
         recommended_monthly_debt_payment = $10,
         recommended_savings_amount = $11,
         recommended_savings_percent = $12,
         rationale_json = $13,
         source = $14,
         updated_at = NOW()
     WHERE plan_id = $15
       AND user_id = $16`,
    [
      monthlyIncome,
      nextOccupation === undefined ? draft.occupation_snapshot : nextOccupation,
      nextCity === undefined ? draft.city_snapshot : nextCity,
      hasDebt,
      debtAmount,
      minimumMonthlyDebtPayment,
      debtPriority,
      debtType,
      debtNotes,
      recommendedDebtPayment,
      recommendedSavingsAmount,
      monthlyIncome > 0 ? toRoundedPercent((recommendedSavingsAmount / monthlyIncome) * 100) : 0,
      nextRationale,
      normalizeSource(payload.source, 'user_edit'),
      draft.plan_id,
      userId,
    ]
  );

  await replacePlanAllocations({
    planId: draft.plan_id,
    allocations: normalizedAllocations,
    monthlyIncome,
    dbClient,
  });

  const updated = await getPlanHeaderById({
    userId,
    planId: draft.plan_id,
    dbClient,
  });

  return mapPlanResponse({ planHeader: updated, dbClient });
};

const acceptDraftPlan = async ({
  userId,
  month,
  year,
  dbClient = db,
}) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const period = parseMonthYear(month, year);

  const supportsPool = dbClient && dbClient.pool && typeof dbClient.pool.connect === 'function';
  const client = supportsPool ? await dbClient.pool.connect() : null;
  const tx = client || dbClient;

  try {
    if (client) await tx.query('BEGIN');

    const draftResult = await tx.query(
      `SELECT *
       FROM budget_plans
       WHERE user_id = $1
         AND status = 'draft'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [safeUserId]
    );

    if (!draftResult.rows[0]) {
      const err = new Error('Draft onboarding plan not found');
      err.statusCode = 404;
      throw err;
    }

    const draft = draftResult.rows[0];

    const allocations = await getPlanAllocations({
      planId: draft.plan_id,
      dbClient: tx,
    });

    if (!Array.isArray(allocations) || allocations.length === 0) {
      const err = new Error('Draft plan has no allocations to activate');
      err.statusCode = 400;
      throw err;
    }

    const allocationTotal = Number(
      allocations.reduce((sum, item) => sum + Number(item.allocation_amount || 0), 0).toFixed(2)
    );
    const savingsAmount = Number(draft.recommended_savings_amount || 0);
    const monthlyIncome = Number(draft.monthly_income_snapshot || 0);
    const committedTotal = Number((allocationTotal + savingsAmount).toFixed(2));
    const remainingBalance = Number((monthlyIncome - committedTotal).toFixed(2));

    if (remainingBalance < 0) {
      const err = new Error('Plan is over-allocated and must be edited before acceptance');
      err.statusCode = 400;
      throw err;
    }

    const healthState = resolveHealthStateFromTotals({
      monthlyIncome,
      remainingBalance,
      affordabilityRatio: Number(draft.rationale_json?.affordability_ratio || 0) / 100,
    });

    const updatedRationale = {
      ...(draft.rationale_json || {}),
      health_state: healthState,
      totals: {
        ...(draft.rationale_json?.totals || {}),
        monthly_income: monthlyIncome,
        allocation_total: allocationTotal,
        total_committed: committedTotal,
        remaining_balance: remainingBalance,
      },
      allocation_guardrails: {
        ...(draft.rationale_json?.allocation_guardrails || {}),
        acceptance_blocked: false,
      },
      lifecycle: {
        ...(draft.rationale_json?.lifecycle || {}),
        suggested: true,
        edited: Boolean(draft.rationale_json?.lifecycle?.edited || draft.rationale_json?.edited_by_user),
        accepted: true,
        active: true,
      },
      adjustment_meta: {
        ...(draft.rationale_json?.adjustment_meta || {}),
        accept_snapshot: {
          accepted_at: new Date().toISOString(),
          applied_month: period.month,
          applied_year: period.year,
          allocation_total: allocationTotal,
          savings_amount: savingsAmount,
          committed_total: committedTotal,
          remaining_balance: remainingBalance,
        },
      },
      plan_provenance: {
        runtime_source: 'accepted_onboarding_plan',
      },
    };

    await tx.query(
      `UPDATE budget_plans
       SET status = 'archived',
           updated_at = NOW()
       WHERE user_id = $1
         AND status = 'active'`,
      [safeUserId]
    );

    await tx.query(
      `UPDATE budget_plans
       SET status = 'active',
           accepted_at = NOW(),
           rationale_json = $1,
           updated_at = NOW()
       WHERE plan_id = $2
         AND user_id = $3`,
      [updatedRationale, draft.plan_id, safeUserId]
    );

    for (const allocation of allocations) {
      if (Number(allocation.allocation_amount || 0) <= 0) continue;

      await upsertBudget({
        userId: safeUserId,
        categoryId: allocation.category_id,
        monthlyLimit: allocation.allocation_amount,
        month: period.month,
        year: period.year,
        dbClient: tx,
      });
    }

    const activeResult = await tx.query(
      `SELECT *
       FROM budget_plans
       WHERE plan_id = $1
       LIMIT 1`,
      [draft.plan_id]
    );

    if (client) await tx.query('COMMIT');

    return {
      plan: await mapPlanResponse({
        planHeader: activeResult.rows[0],
        dbClient: db,
      }),
      applied_month: period.month,
      applied_year: period.year,
    };
  } catch (err) {
    if (client) {
      try {
        await tx.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('acceptDraftPlan rollback error:', rollbackErr.message);
      }
    }

    throw err;
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  toPositiveInt,
  fetchUserProfile,
  getOnboardingStatus,
  getCurrentPlanForUser,
  getActivePlanForUser,
  mapPlanResponse,
  createOrReplaceDraftPlanFromUser,
  previewDraftPlan,
  updateDraftPlan,
  acceptDraftPlan,
};
