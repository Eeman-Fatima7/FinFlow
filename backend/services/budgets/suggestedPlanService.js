const DEFAULT_PROFILE = 'other';

const CATEGORY_ORDER = [
  'Bills',
  'Groceries',
  'Food & Dining',
  'Transport',
  'Shopping',
  'Subscriptions',
  'Entertainment',
  'Healthcare',
  'Education',
  'Charity',
  'Other',
];

const ESSENTIAL_CATEGORIES = new Set([
  'Bills',
  'Groceries',
  'Transport',
  'Healthcare',
  'Education',
]);

const PROFILE_CONFIG = {
  salaried: {
    savings_percent: 0.18,
    min_savings_percent: 0.08,
    weights: {
      Bills: 0.25,
      Groceries: 0.16,
      'Food & Dining': 0.1,
      Transport: 0.12,
      Shopping: 0.08,
      Subscriptions: 0.04,
      Entertainment: 0.06,
      Healthcare: 0.07,
      Education: 0.05,
      Charity: 0.03,
      Other: 0.04,
    },
  },
  student: {
    savings_percent: 0.1,
    min_savings_percent: 0.05,
    weights: {
      Bills: 0.18,
      Groceries: 0.15,
      'Food & Dining': 0.14,
      Transport: 0.1,
      Shopping: 0.07,
      Subscriptions: 0.05,
      Entertainment: 0.08,
      Healthcare: 0.06,
      Education: 0.11,
      Charity: 0.02,
      Other: 0.04,
    },
  },
  freelancer: {
    savings_percent: 0.22,
    min_savings_percent: 0.1,
    weights: {
      Bills: 0.24,
      Groceries: 0.15,
      'Food & Dining': 0.09,
      Transport: 0.11,
      Shopping: 0.06,
      Subscriptions: 0.03,
      Entertainment: 0.04,
      Healthcare: 0.08,
      Education: 0.04,
      Charity: 0.02,
      Other: 0.14,
    },
  },
  low_income: {
    savings_percent: 0.06,
    min_savings_percent: 0.02,
    weights: {
      Bills: 0.3,
      Groceries: 0.2,
      'Food & Dining': 0.09,
      Transport: 0.14,
      Shopping: 0.04,
      Subscriptions: 0.01,
      Entertainment: 0.02,
      Healthcare: 0.09,
      Education: 0.06,
      Charity: 0.01,
      Other: 0.04,
    },
  },
  homemaker: {
    savings_percent: 0.1,
    min_savings_percent: 0.05,
    weights: {
      Bills: 0.26,
      Groceries: 0.2,
      'Food & Dining': 0.08,
      Transport: 0.09,
      Shopping: 0.06,
      Subscriptions: 0.03,
      Entertainment: 0.04,
      Healthcare: 0.1,
      Education: 0.07,
      Charity: 0.03,
      Other: 0.04,
    },
  },
  other: {
    savings_percent: 0.12,
    min_savings_percent: 0.05,
    weights: {
      Bills: 0.25,
      Groceries: 0.17,
      'Food & Dining': 0.1,
      Transport: 0.12,
      Shopping: 0.07,
      Subscriptions: 0.04,
      Entertainment: 0.05,
      Healthcare: 0.08,
      Education: 0.05,
      Charity: 0.03,
      Other: 0.04,
    },
  },
};

const CITY_COST_MULTIPLIERS = [
  { matcher: ['islamabad', 'karachi', 'lahore'], multiplier: 1.1 },
  { matcher: ['rawalpindi', 'faisalabad', 'peshawar'], multiplier: 1.05 },
];

const DEBT_PRIORITY_SHARE = {
  low: 0.06,
  medium: 0.1,
  high: 0.15,
};

const DEBT_PRIORITY_HORIZON_MONTHS = {
  low: 24,
  medium: 18,
  high: 12,
};

const STABILITY_SAVINGS_ADJUSTMENT = {
  fixed: 0,
  variable: 0.025,
  seasonal: 0.04,
};

const GOAL_SAVINGS_ADJUSTMENT = {
  stabilize: 0.01,
  pay_debt: -0.03,
  save_more: 0.04,
  balanced: 0,
};

const DEBT_MODE_SHARE_ADJUSTMENT = {
  avalanche: 0.01,
  snowball: 0,
};

const LIFESTYLE_PRIORITY_CATEGORIES = [
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Food & Dining',
  'Charity',
  'Other',
];

const OBLIGATION_CATEGORY_KEYWORDS = [
  { keywords: ['rent', 'house', 'housing', 'utility', 'bill', 'electric', 'gas', 'water', 'internet'], category: 'Bills' },
  { keywords: ['grocery', 'supermarket'], category: 'Groceries' },
  { keywords: ['food', 'dining', 'restaurant'], category: 'Food & Dining' },
  { keywords: ['transport', 'fuel', 'ride', 'travel', 'car', 'bus'], category: 'Transport' },
  { keywords: ['shop', 'clothes', 'retail'], category: 'Shopping' },
  { keywords: ['subscription', 'stream', 'netflix'], category: 'Subscriptions' },
  { keywords: ['entertainment', 'game', 'movie'], category: 'Entertainment' },
  { keywords: ['health', 'medical', 'doctor', 'medicine', 'insurance'], category: 'Healthcare' },
  { keywords: ['education', 'school', 'tuition', 'course'], category: 'Education' },
  { keywords: ['charity', 'zakat', 'donation'], category: 'Charity' },
  { keywords: ['debt', 'loan', 'installment'], category: 'Debt Repayment' },
];

const ALLOWED_RISK_TOLERANCE = new Set(['low', 'medium', 'high']);
const ALLOWED_SAVINGS_GOAL_MODES = new Set(['conservative', 'balanced', 'aggressive']);
const ALLOWED_INCOME_STABILITY = new Set(['fixed', 'variable', 'seasonal']);
const ALLOWED_PRIMARY_GOALS = new Set(['stabilize', 'pay_debt', 'save_more', 'balanced']);
const ALLOWED_DEBT_PRIORITY_MODES = new Set(['avalanche', 'snowball']);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundMoney = (value) => Number((Number(value) || 0).toFixed(2));

const roundPercent = (value) => Number((Number(value) || 0).toFixed(3));

const toNonNegativeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }
  return numeric;
};

const toNonNegativeInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
};

const normalizeText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeDebtPriority = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'low' || normalized === 'high') return normalized;
  return 'medium';
};

const normalizeIncomeStability = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_INCOME_STABILITY.has(normalized) ? normalized : 'fixed';
};

const normalizePrimaryGoal = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_PRIMARY_GOALS.has(normalized) ? normalized : 'balanced';
};

const normalizeDebtPriorityMode = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_DEBT_PRIORITY_MODES.has(normalized) ? normalized : 'avalanche';
};

const normalizeRiskTolerance = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_RISK_TOLERANCE.has(normalized) ? normalized : 'medium';
};

const normalizeSavingsGoalMode = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_SAVINGS_GOAL_MODES.has(normalized) ? normalized : 'balanced';
};

const normalizeFinancialPriorities = (value) => {
  if (!Array.isArray(value)) return [];

  const unique = new Set();
  value.forEach((item) => {
    const normalized = typeof item === 'string' ? item.trim().toLowerCase().replace(/\s+/g, '_') : '';
    if (normalized) unique.add(normalized.slice(0, 40));
  });

  return Array.from(unique).slice(0, 8);
};

const classifyOccupation = (occupation) => {
  const normalized = String(occupation || '').trim().toLowerCase();

  if (!normalized) return DEFAULT_PROFILE;
  if (normalized.includes('student')) return 'student';
  if (normalized.includes('freelancer') || normalized.includes('self-employed') || normalized.includes('self employed') || normalized.includes('entrepreneur') || normalized.includes('business')) {
    return 'freelancer';
  }
  if (normalized.includes('unemployed') || normalized.includes('jobless') || normalized.includes('not working')) {
    return 'low_income';
  }
  if (normalized.includes('homemaker') || normalized.includes('housewife') || normalized.includes('home maker')) {
    return 'homemaker';
  }
  if (normalized.includes('employee') || normalized.includes('salaried') || normalized.includes('engineer') || normalized.includes('manager') || normalized.includes('developer') || normalized.includes('teacher') || normalized.includes('doctor') || normalized.includes('officer')) {
    return 'salaried';
  }

  return DEFAULT_PROFILE;
};

const resolveCityMultiplier = (city) => {
  const normalized = String(city || '').trim().toLowerCase();

  if (!normalized) return 1;

  for (const entry of CITY_COST_MULTIPLIERS) {
    if (entry.matcher.some((term) => normalized.includes(term))) {
      return entry.multiplier;
    }
  }

  return 1;
};

const resolveObligationCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'Other';

  for (const entry of OBLIGATION_CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.category;
    }
  }

  return 'Other';
};

const normalizeFixedObligations = (value) => {
  if (!Array.isArray(value)) return [];

  const normalized = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index] || {};
    const amount = roundMoney(toNonNegativeNumber(item.amount, 0));
    if (amount <= 0) continue;

    const name = normalizeText(item.name) || `Obligation ${index + 1}`;
    const categoryHint = resolveObligationCategory(item.category_hint || item.category || item.name);

    normalized.push({
      name,
      amount,
      category_hint: categoryHint,
    });
  }

  return normalized.slice(0, 30);
};

const normalizeQuestionnaire = (input = {}) => {
  const source = input || {};

  const housingCost = roundMoney(
    toNonNegativeNumber(source.housing_cost ?? source.housingCost, 0)
  );
  const utilitiesCost = roundMoney(
    toNonNegativeNumber(source.utilities_cost ?? source.utilitiesCost, 0)
  );
  const groceriesBaseline = roundMoney(
    toNonNegativeNumber(source.groceries_baseline ?? source.groceriesBaseline, 0)
  );
  const transportBaseline = roundMoney(
    toNonNegativeNumber(source.transport_baseline ?? source.transportBaseline, 0)
  );
  const essentialSubscriptionsOrFees = roundMoney(
    toNonNegativeNumber(
      source.essential_subscriptions_or_fees ?? source.essentialSubscriptionsOrFees,
      0
    )
  );
  const emergencySavingsCurrent = roundMoney(
    toNonNegativeNumber(source.emergency_savings_current ?? source.emergencySavingsCurrent, 0)
  );

  const fixedObligations = normalizeFixedObligations(
    source.fixed_obligations || source.fixedObligations
  );

  return {
    fixed_obligations: fixedObligations,
    household_size: toNonNegativeInt(source.household_size ?? source.householdSize, 0),
    dependents_count: toNonNegativeInt(source.dependents_count ?? source.dependentsCount, 0),
    risk_tolerance: normalizeRiskTolerance(source.risk_tolerance ?? source.riskTolerance),
    financial_priorities: normalizeFinancialPriorities(
      source.financial_priorities || source.financialPriorities
    ),
    savings_goal_mode: normalizeSavingsGoalMode(source.savings_goal_mode ?? source.savingsGoalMode),
    income_stability: normalizeIncomeStability(source.income_stability ?? source.incomeStability),
    housing_cost: housingCost,
    utilities_cost: utilitiesCost,
    groceries_baseline: groceriesBaseline,
    transport_baseline: transportBaseline,
    essential_subscriptions_or_fees: essentialSubscriptionsOrFees,
    emergency_savings_current: emergencySavingsCurrent,
    primary_goal: normalizePrimaryGoal(source.primary_goal ?? source.primaryGoal),
    debt_priority_mode: normalizeDebtPriorityMode(
      source.debt_priority_mode ?? source.debtPriorityMode
    ),
  };
};

const normalizeWeights = (weights) => {
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total <= 0) {
    return { ...PROFILE_CONFIG[DEFAULT_PROFILE].weights };
  }

  const normalized = {};
  for (const category of CATEGORY_ORDER) {
    normalized[category] = Number(weights[category] || 0) / total;
  }

  return normalized;
};

const sumWeightForCategories = (weights, categories) => {
  return categories.reduce((sum, category) => {
    return sum + Number(weights[category] || 0);
  }, 0);
};

const normalizeWeightsForCategories = ({ weights, categories }) => {
  const normalized = {};
  CATEGORY_ORDER.forEach((category) => {
    normalized[category] = 0;
  });

  const selected = categories.filter((category) => CATEGORY_ORDER.includes(category));
  if (selected.length === 0) return normalized;

  const total = selected.reduce((sum, category) => sum + Number(weights[category] || 0), 0);

  if (total <= 0) {
    const equal = 1 / selected.length;
    selected.forEach((category) => {
      normalized[category] = equal;
    });
    return normalized;
  }

  selected.forEach((category) => {
    normalized[category] = Number(weights[category] || 0) / total;
  });

  return normalized;
};

const combineCategoryAllocations = (...allocationGroups) => {
  const totals = new Map();

  CATEGORY_ORDER.forEach((category) => {
    totals.set(category, 0);
  });

  allocationGroups.forEach((group) => {
    if (!Array.isArray(group)) return;

    group.forEach((item) => {
      const key = item?.category_name;
      if (!totals.has(key)) return;
      totals.set(
        key,
        roundMoney(Number(totals.get(key) || 0) + Number(item?.allocation_amount || 0))
      );
    });
  });

  return CATEGORY_ORDER.map((category) => ({
    category_name: category,
    allocation_amount: roundMoney(Number(totals.get(category) || 0)),
  }));
};

const adjustWeightsForContext = ({
  baseWeights,
  cityMultiplier,
  affordabilityRatio,
  incomeStability,
  primaryGoal,
  hasDebt,
  dependentsCount,
  householdSize,
}) => {
  const adjusted = { ...baseWeights };

  if (cityMultiplier > 1) {
    adjusted.Bills *= cityMultiplier;
    adjusted.Groceries *= cityMultiplier;
    adjusted.Transport *= cityMultiplier;
  }

  if (affordabilityRatio < 0.55) {
    for (const category of Object.keys(adjusted)) {
      if (ESSENTIAL_CATEGORIES.has(category)) {
        adjusted[category] *= 1.12;
      } else {
        adjusted[category] *= 0.78;
      }
    }
  }

  if (affordabilityRatio < 0.4) {
    for (const category of Object.keys(adjusted)) {
      if (ESSENTIAL_CATEGORIES.has(category)) {
        adjusted[category] *= 1.18;
      } else {
        adjusted[category] *= 0.68;
      }
    }
  }

  if (incomeStability === 'variable' || incomeStability === 'seasonal') {
    LIFESTYLE_PRIORITY_CATEGORIES.forEach((category) => {
      adjusted[category] *= incomeStability === 'seasonal' ? 0.7 : 0.8;
    });
    adjusted.Bills *= 1.08;
    adjusted.Groceries *= 1.08;
  }

  const safeDependents = toNonNegativeInt(dependentsCount, 0);
  if (safeDependents > 0) {
    adjusted.Groceries *= 1 + clamp(safeDependents * 0.08, 0, 0.35);
    adjusted.Healthcare *= 1 + clamp(safeDependents * 0.05, 0, 0.25);
    adjusted.Education *= 1 + clamp(safeDependents * 0.06, 0, 0.25);

    LIFESTYLE_PRIORITY_CATEGORIES.forEach((category) => {
      adjusted[category] *= 1 - clamp(safeDependents * 0.04, 0, 0.2);
    });
  }

  const safeHouseholdSize = toNonNegativeInt(householdSize, 0);
  if (safeHouseholdSize > 1) {
    adjusted.Groceries *= 1 + clamp((safeHouseholdSize - 1) * 0.03, 0, 0.15);
    adjusted.Transport *= 1 + clamp((safeHouseholdSize - 1) * 0.02, 0, 0.1);
  }

  if (primaryGoal === 'pay_debt' || hasDebt) {
    LIFESTYLE_PRIORITY_CATEGORIES.forEach((category) => {
      adjusted[category] *= primaryGoal === 'pay_debt' ? 0.72 : 0.85;
    });
  }

  if (primaryGoal === 'save_more') {
    LIFESTYLE_PRIORITY_CATEGORIES.forEach((category) => {
      adjusted[category] *= 0.78;
    });
  }

  if (primaryGoal === 'stabilize') {
    adjusted.Bills *= 1.05;
    adjusted.Groceries *= 1.05;
    adjusted.Healthcare *= 1.04;
  }

  return normalizeWeights(adjusted);
};

const allocateByWeights = ({ totalAmount, weights }) => {
  const safeTotal = roundMoney(totalAmount);

  if (safeTotal <= 0) {
    return CATEGORY_ORDER.map((category) => ({
      category_name: category,
      allocation_amount: 0,
    }));
  }

  const rawAllocations = CATEGORY_ORDER.map((category) => {
    const raw = safeTotal * Number(weights[category] || 0);
    const floored = Math.floor(raw * 100) / 100;

    return {
      category_name: category,
      raw,
      allocation_amount: floored,
      remainder: raw - floored,
    };
  });

  const flooredSum = rawAllocations.reduce((sum, item) => sum + item.allocation_amount, 0);
  let remainingCents = Math.round((safeTotal - flooredSum) * 100);

  rawAllocations.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return CATEGORY_ORDER.indexOf(a.category_name) - CATEGORY_ORDER.indexOf(b.category_name);
  });

  let index = 0;
  while (remainingCents > 0 && rawAllocations.length > 0) {
    rawAllocations[index % rawAllocations.length].allocation_amount = roundMoney(
      rawAllocations[index % rawAllocations.length].allocation_amount + 0.01
    );
    remainingCents -= 1;
    index += 1;
  }

  rawAllocations.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category_name) - CATEGORY_ORDER.indexOf(b.category_name)
  );

  return rawAllocations.map((item) => ({
    category_name: item.category_name,
    allocation_amount: roundMoney(item.allocation_amount),
  }));
};

const normalizeDebtInput = (input = {}) => {
  const hasDebt = input.has_debt === true || String(input.has_debt).toLowerCase() === 'true';

  return {
    has_debt: hasDebt,
    debt_amount: hasDebt ? toNonNegativeNumber(input.debt_amount, 0) : null,
    minimum_monthly_debt_payment: hasDebt
      ? toNonNegativeNumber(input.minimum_monthly_debt_payment, 0)
      : null,
    debt_priority: hasDebt ? normalizeDebtPriority(input.debt_priority) : null,
    debt_priority_mode: hasDebt ? normalizeDebtPriorityMode(input.debt_priority_mode) : 'avalanche',
    debt_type: hasDebt ? normalizeText(input.debt_type) : null,
    debt_notes: hasDebt ? normalizeText(input.debt_notes) : null,
  };
};

const computeDebtPayment = ({ income, debtInput }) => {
  if (!debtInput.has_debt || income <= 0) {
    return {
      recommendedDebtPayment: 0,
      floorMinimumPayment: 0,
      rationale: {
        debt_priority_share: 0,
        debt_balance_target: 0,
      },
    };
  }

  const priority = debtInput.debt_priority || 'medium';
  const minimumPayment = toNonNegativeNumber(debtInput.minimum_monthly_debt_payment, 0);
  const debtAmount = toNonNegativeNumber(debtInput.debt_amount, 0);

  const priorityShareTarget = income * (DEBT_PRIORITY_SHARE[priority] || DEBT_PRIORITY_SHARE.medium);
  const horizonMonths = DEBT_PRIORITY_HORIZON_MONTHS[priority] || DEBT_PRIORITY_HORIZON_MONTHS.medium;
  const debtBalanceTarget = debtAmount > 0 ? debtAmount / horizonMonths : 0;

  let recommendedDebtPayment = Math.max(minimumPayment, priorityShareTarget, debtBalanceTarget);

  const maxReasonable = income * 0.45;
  if (recommendedDebtPayment > maxReasonable && minimumPayment <= maxReasonable) {
    recommendedDebtPayment = maxReasonable;
  }

  if (recommendedDebtPayment <= 0) {
    recommendedDebtPayment = income * 0.05;
  }

  return {
    recommendedDebtPayment: roundMoney(recommendedDebtPayment),
    floorMinimumPayment: roundMoney(minimumPayment),
    rationale: {
      debt_priority_share: roundMoney(priorityShareTarget),
      debt_balance_target: roundMoney(debtBalanceTarget),
    },
  };
};

const deriveSavingsAdjustments = ({
  cityMultiplier,
  debtInput,
  questionnaire,
}) => {
  let adjustment = 0;

  if (cityMultiplier >= 1.1) adjustment -= 0.03;
  else if (cityMultiplier >= 1.05) adjustment -= 0.015;

  if (debtInput.has_debt) {
    if (debtInput.debt_priority === 'high') adjustment -= 0.05;
    else if (debtInput.debt_priority === 'medium') adjustment -= 0.03;
    else adjustment -= 0.015;
  }

  if (questionnaire.savings_goal_mode === 'conservative') adjustment -= 0.02;
  if (questionnaire.savings_goal_mode === 'aggressive') adjustment += 0.03;

  if (questionnaire.risk_tolerance === 'low') adjustment += 0.01;
  if (questionnaire.risk_tolerance === 'high') adjustment -= 0.01;

  if (questionnaire.financial_priorities.includes('debt_reduction')) adjustment -= 0.01;
  if (questionnaire.financial_priorities.includes('emergency_fund')) adjustment += 0.015;

  adjustment += STABILITY_SAVINGS_ADJUSTMENT[questionnaire.income_stability] || 0;
  adjustment += GOAL_SAVINGS_ADJUSTMENT[questionnaire.primary_goal] || 0;

  if (debtInput.has_debt) {
    adjustment += DEBT_MODE_SHARE_ADJUSTMENT[debtInput.debt_priority_mode] || 0;
  }

  return adjustment;
};

const toObligationCategoryTotals = (questionnaire) => {
  const totals = {};

  CATEGORY_ORDER.forEach((category) => {
    totals[category] = 0;
  });

  questionnaire.fixed_obligations.forEach((obligation) => {
    const category = resolveObligationCategory(obligation.category_hint || obligation.name);
    totals[category] = roundMoney((totals[category] || 0) + Number(obligation.amount || 0));
  });

  if (questionnaire.housing_cost > 0) {
    totals.Bills = roundMoney((totals.Bills || 0) + Number(questionnaire.housing_cost || 0));
  }

  if (questionnaire.utilities_cost > 0) {
    totals.Bills = roundMoney((totals.Bills || 0) + Number(questionnaire.utilities_cost || 0));
  }

  if (questionnaire.groceries_baseline > 0) {
    totals.Groceries = roundMoney(
      (totals.Groceries || 0) + Number(questionnaire.groceries_baseline || 0)
    );
  }

  if (questionnaire.transport_baseline > 0) {
    totals.Transport = roundMoney(
      (totals.Transport || 0) + Number(questionnaire.transport_baseline || 0)
    );
  }

  if (questionnaire.essential_subscriptions_or_fees > 0) {
    totals.Subscriptions = roundMoney(
      (totals.Subscriptions || 0)
      + Number(questionnaire.essential_subscriptions_or_fees || 0)
    );
  }

  return totals;
};

const toHealthState = ({
  monthlyIncome,
  remainingBalance,
  affordabilityRatio,
}) => {
  if (remainingBalance < 0) return 'deficit';
  if (monthlyIncome <= 0) return 'tight';

  const safeAffordabilityRatio = Number(affordabilityRatio || 0);
  if (safeAffordabilityRatio < 0.2) return 'tight';

  return 'balanced';
};

const mergeDiscretionaryWithObligations = ({
  monthlyIncome,
  discretionaryAllocations,
  obligationsByCategory,
}) => {
  return CATEGORY_ORDER.map((category) => {
    const discretionary = discretionaryAllocations.find((item) => item.category_name === category);
    const obligationAmount = Number(obligationsByCategory[category] || 0);
    const totalAmount = roundMoney(Number(discretionary?.allocation_amount || 0) + obligationAmount);

    return {
      category_name: category,
      allocation_amount: totalAmount,
      allocation_percent: monthlyIncome > 0
        ? roundPercent((totalAmount / monthlyIncome) * 100)
        : 0,
      is_debt_allocation: false,
    };
  });
};

const generateSuggestedPlan = ({
  monthly_income,
  occupation,
  city,
  debt_input = {},
  questionnaire = {},
}) => {
  const monthlyIncome = roundMoney(toNonNegativeNumber(monthly_income, 0));
  const normalizedOccupation = normalizeText(occupation);
  const normalizedCity = normalizeText(city);
  const profileKey = classifyOccupation(normalizedOccupation);
  const profile = PROFILE_CONFIG[profileKey] || PROFILE_CONFIG[DEFAULT_PROFILE];
  const cityMultiplier = resolveCityMultiplier(normalizedCity);
  const normalizedQuestionnaire = normalizeQuestionnaire(questionnaire);
  const normalizedDebtInput = normalizeDebtInput({
    ...(debt_input || {}),
    debt_priority_mode:
      debt_input?.debt_priority_mode ?? normalizedQuestionnaire.debt_priority_mode,
  });

  const obligationsByCategory = toObligationCategoryTotals(normalizedQuestionnaire);

  const essentialsFloorTotal = roundMoney(
    Object.entries(obligationsByCategory).reduce((sum, [category, amount]) => {
      if (ESSENTIAL_CATEGORIES.has(category)) {
        return sum + Number(amount || 0);
      }
      return sum;
    }, 0)
  );

  const obligationsTotal = roundMoney(
    Object.values(obligationsByCategory).reduce((sum, amount) => sum + Number(amount || 0), 0)
  );

  const debtComputation = computeDebtPayment({
    income: monthlyIncome,
    debtInput: normalizedDebtInput,
  });

  const debtFloorPayment = roundMoney(debtComputation.floorMinimumPayment);
  let debtTargetPayment = roundMoney(debtComputation.recommendedDebtPayment);

  if (normalizedDebtInput.has_debt && debtTargetPayment < debtFloorPayment) {
    debtTargetPayment = debtFloorPayment;
  }

  if (normalizedDebtInput.has_debt) {
    const debtModeBoost = normalizedDebtInput.debt_priority_mode === 'avalanche'
      ? monthlyIncome * 0.01
      : monthlyIncome * 0.005;
    debtTargetPayment = roundMoney(Math.max(debtTargetPayment, debtFloorPayment + debtModeBoost));
  }

  const savingsAdjustment = deriveSavingsAdjustments({
    cityMultiplier,
    debtInput: normalizedDebtInput,
    questionnaire: normalizedQuestionnaire,
  });

  const minimumSavingsPercent = normalizedQuestionnaire.primary_goal === 'pay_debt'
    ? Math.max(0.01, profile.min_savings_percent - 0.02)
    : profile.min_savings_percent;

  let savingsPercent = clamp(
    profile.savings_percent + savingsAdjustment,
    minimumSavingsPercent,
    0.35
  );

  const emergencyBaselineMonths = normalizedQuestionnaire.income_stability === 'seasonal' ? 6 : 4;
  const essentialMonthlyBase = roundMoney(
    obligationsByCategory.Bills
    + obligationsByCategory.Groceries
    + obligationsByCategory.Transport
    + obligationsByCategory.Healthcare
    + obligationsByCategory.Education
  );

  const emergencyTarget = roundMoney(essentialMonthlyBase * emergencyBaselineMonths);
  const emergencyCurrent = roundMoney(normalizedQuestionnaire.emergency_savings_current || 0);
  const emergencyGap = roundMoney(Math.max(0, emergencyTarget - emergencyCurrent));
  const emergencyTopUpTarget = roundMoney(Math.min(emergencyGap * 0.08, monthlyIncome * 0.08));

  let recommendedSavingsAmount = roundMoney(monthlyIncome * savingsPercent);
  if (normalizedQuestionnaire.primary_goal === 'stabilize' || normalizedQuestionnaire.primary_goal === 'balanced') {
    recommendedSavingsAmount = roundMoney(Math.max(recommendedSavingsAmount, emergencyTopUpTarget));
  }

  const rationaleFlags = [];

  const committedCore = roundMoney(obligationsTotal + debtTargetPayment + recommendedSavingsAmount);
  let remainingForLiving = roundMoney(monthlyIncome - committedCore);

  if (remainingForLiving < 0) {
    let shortfall = Math.abs(remainingForLiving);

    const minimumSavingsAmount = roundMoney(monthlyIncome * minimumSavingsPercent);
    const reducibleSavings = Math.max(0, recommendedSavingsAmount - minimumSavingsAmount);
    const savingsReduction = Math.min(shortfall, reducibleSavings);
    recommendedSavingsAmount = roundMoney(recommendedSavingsAmount - savingsReduction);
    shortfall = roundMoney(shortfall - savingsReduction);

    const reducibleDebt = normalizedDebtInput.has_debt
      ? Math.max(0, debtTargetPayment - debtFloorPayment)
      : 0;
    const debtReduction = Math.min(shortfall, reducibleDebt);
    debtTargetPayment = roundMoney(debtTargetPayment - debtReduction);
    shortfall = roundMoney(shortfall - debtReduction);

    if (shortfall > 0) {
      rationaleFlags.push(
        `Fixed obligations and minimum commitments exceed monthly income by ${shortfall.toFixed(2)}.`
      );
    }

    remainingForLiving = roundMoney(
      Math.max(0, monthlyIncome - obligationsTotal - debtTargetPayment - recommendedSavingsAmount)
    );

    savingsPercent = monthlyIncome > 0
      ? clamp(recommendedSavingsAmount / monthlyIncome, 0, 0.35)
      : 0;
  }

  const affordabilityRatio = monthlyIncome > 0
    ? remainingForLiving / monthlyIncome
    : 0;

  const adjustedWeights = adjustWeightsForContext({
    baseWeights: profile.weights,
    cityMultiplier,
    affordabilityRatio,
    incomeStability: normalizedQuestionnaire.income_stability,
    primaryGoal: normalizedQuestionnaire.primary_goal,
    hasDebt: normalizedDebtInput.has_debt,
    dependentsCount: normalizedQuestionnaire.dependents_count,
    householdSize: normalizedQuestionnaire.household_size,
  });

  const essentialVariableCategories = CATEGORY_ORDER.filter((category) => ESSENTIAL_CATEGORIES.has(category));
  const discretionaryCategories = CATEGORY_ORDER.filter((category) => !ESSENTIAL_CATEGORIES.has(category));

  const essentialShare = clamp(
    sumWeightForCategories(adjustedWeights, essentialVariableCategories),
    0.35,
    0.85
  );

  const essentialVariableBudget = roundMoney(remainingForLiving * essentialShare);
  const discretionaryBudget = roundMoney(remainingForLiving - essentialVariableBudget);

  const essentialWeights = normalizeWeightsForCategories({
    weights: adjustedWeights,
    categories: essentialVariableCategories,
  });

  const discretionaryWeights = normalizeWeightsForCategories({
    weights: adjustedWeights,
    categories: discretionaryCategories,
  });

  const essentialVariableAllocations = allocateByWeights({
    totalAmount: essentialVariableBudget,
    weights: essentialWeights,
  });

  const discretionaryAllocations = allocateByWeights({
    totalAmount: discretionaryBudget,
    weights: discretionaryWeights,
  });

  const combinedLivingAllocations = combineCategoryAllocations(
    essentialVariableAllocations,
    discretionaryAllocations
  );

  const allocations = mergeDiscretionaryWithObligations({
    monthlyIncome,
    discretionaryAllocations: combinedLivingAllocations,
    obligationsByCategory,
  });

  allocations.push({
    category_name: 'Debt Repayment',
    allocation_amount: roundMoney(debtTargetPayment),
    allocation_percent: monthlyIncome > 0
      ? roundPercent((debtTargetPayment / monthlyIncome) * 100)
      : 0,
    is_debt_allocation: true,
  });

  const allocationTotal = roundMoney(
    allocations.reduce((sum, item) => sum + Number(item.allocation_amount || 0), 0)
  );
  const totalCommitted = roundMoney(allocationTotal + recommendedSavingsAmount);
  const remainingBalance = roundMoney(monthlyIncome - totalCommitted);

  const healthState = toHealthState({
    monthlyIncome,
    remainingBalance,
    affordabilityRatio,
  });

  if (remainingBalance < 0) {
    rationaleFlags.push(
      `Plan is over-allocated by ${Math.abs(remainingBalance).toFixed(2)} and must be edited before acceptance.`
    );
  }

  if (affordabilityRatio < 0.55) {
    rationaleFlags.push('Discretionary allocations were reduced to protect obligations and essential categories.');
  }

  if (obligationsTotal > 0) {
    rationaleFlags.push(`Fixed obligations reserve ${obligationsTotal.toFixed(2)} before variable budgeting.`);
  }

  if (normalizedDebtInput.has_debt) {
    rationaleFlags.push(
      `Debt repayment mode ${normalizedDebtInput.debt_priority_mode} applied with minimum floor ${debtFloorPayment.toFixed(2)}.`
    );
  }

  if (healthState === 'tight') {
    rationaleFlags.push('Plan is tight: remaining balance is low after core commitments.');
  }

  if (healthState === 'deficit') {
    rationaleFlags.push('Plan is in deficit and needs manual reductions before acceptance.');
  }

  return {
    monthly_income_snapshot: monthlyIncome,
    occupation_snapshot: normalizedOccupation,
    city_snapshot: normalizedCity,
    has_debt: normalizedDebtInput.has_debt,
    debt_amount: normalizedDebtInput.debt_amount,
    minimum_monthly_debt_payment: normalizedDebtInput.minimum_monthly_debt_payment,
    debt_priority: normalizedDebtInput.debt_priority,
    debt_type: normalizedDebtInput.debt_type,
    debt_notes: normalizedDebtInput.debt_notes,
    recommended_monthly_debt_payment: roundMoney(debtTargetPayment),
    recommended_savings_amount: roundMoney(recommendedSavingsAmount),
    recommended_savings_percent: monthlyIncome > 0
      ? roundPercent((recommendedSavingsAmount / monthlyIncome) * 100)
      : 0,
    allocations,
    rationale_json: {
      profile_key: profileKey,
      city_cost_multiplier: cityMultiplier,
      affordability_ratio: roundPercent(affordabilityRatio * 100),
      emergency_buffer_category: 'Other',
      health_state: healthState,
      lifecycle: {
        suggested: true,
        edited: false,
        accepted: false,
        active: false,
      },
      debt_calculation: {
        ...debtComputation.rationale,
        debt_priority_mode: normalizedDebtInput.debt_priority_mode,
      },
      stage_totals: {
        essentials_floor_total: essentialsFloorTotal,
        fixed_obligations_total: obligationsTotal,
        debt_total: roundMoney(debtTargetPayment),
        savings_total: roundMoney(recommendedSavingsAmount),
        living_essentials_total: roundMoney(essentialVariableBudget),
        discretionary_total: roundMoney(discretionaryBudget),
        discretionary_plus_living_total: roundMoney(remainingForLiving),
      },
      emergency_fund: {
        current_amount: emergencyCurrent,
        target_amount: emergencyTarget,
        gap_amount: emergencyGap,
        suggested_topup: emergencyTopUpTarget,
      },
      allocation_guardrails: {
        acceptance_blocked: remainingBalance < 0,
        minimum_savings_percent: roundPercent(minimumSavingsPercent * 100),
        debt_floor_payment: roundMoney(debtFloorPayment),
      },
      obligations_by_category: obligationsByCategory,
      questionnaire: normalizedQuestionnaire,
      totals: {
        monthly_income: monthlyIncome,
        allocation_total: allocationTotal,
        total_committed: totalCommitted,
        remaining_balance: remainingBalance,
      },
      constraint_flags: rationaleFlags,
      flags: rationaleFlags,
    },
  };
};

module.exports = {
  CATEGORY_ORDER,
  normalizeDebtInput,
  normalizeQuestionnaire,
  classifyOccupation,
  resolveCityMultiplier,
  resolveObligationCategory,
  generateSuggestedPlan,
};
