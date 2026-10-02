const db = require('../db/db');

const getPlanWriteService = () => require('./budgets/planWriteService');

// 50/30/20 rule category buckets
const NEEDS_CATEGORIES = [
  'Housing / Rent',
  'Groceries',
  'Utilities & Services',
  'Electricity / Water / Gas',
  'Mobile & Internet',
  'Transportation',
  'Public Transport',
  'Healthcare & Medical',
  'Insurance',
  'Education / Tuition',
  'Fuel / Gas',
  'Car Maintenance',
  'Medical / Pharmacy',
];

const WANTS_CATEGORIES = [
  'Restaurants / Eating Out',
  'Coffee & Snacks',
  'Entertainment & Recreation',
  'Subscriptions (Streaming / Apps)',
  'Shopping & Retail',
  'Shopping (Clothes / Electronics)',
  'Travel (Flights / Hotels)',
  'Gifts & Celebrations',
];

const FOOD_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Restaurants / Eating Out',
  'Coffee & Snacks',
];

const TRANSPORT_CATEGORIES = [
  'Transportation',
  'Public Transport',
  'Ride Sharing / Taxi',
  'Fuel / Gas',
  'Car Maintenance',
];

const SUBSCRIPTION_CATEGORIES = ['Subscriptions (Streaming / Apps)'];

const getPreviousMonth = (month, year) => {
  if (month === 1) {
    return { month: 12, year: year - 1 };
  }
  return { month: month - 1, year };
};

const sumCategories = (categoryBreakdown, categories) => {
  return categoryBreakdown.reduce((sum, item) => {
    if (categories.includes(item.category)) {
      return sum + item.amount;
    }
    return sum;
  }, 0);
};

const SUPPORTED_CURRENCIES = new Set(['USD', 'PKR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY']);

const normalizeCurrency = (value, fallback = 'USD') => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SUPPORTED_CURRENCIES.has(code) ? code : fallback;
};

const formatCurrency = (amount, currency = 'USD') => {
  const numeric = Math.round(Number(amount || 0));
  const resolvedCurrency = normalizeCurrency(currency, 'USD');

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric.toLocaleString('en-US')} ${resolvedCurrency}`;
  }
};

const parseMonthYear = (monthInput, yearInput) => {
  const now = new Date();
  const month = Number(monthInput || now.getMonth() + 1);
  const year = Number(yearInput || now.getFullYear());

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    const err = new Error('month must be between 1 and 12');
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isInteger(year) || year < 2000 || year > 3000) {
    const err = new Error('year must be a valid 4-digit year');
    err.statusCode = 400;
    throw err;
  }

  return { month, year };
};

const analyzeSpending = async (userId, monthInput, yearInput) => {
  const { month, year } = parseMonthYear(monthInput, yearInput);

  // User profile
  const userResult = await db.query(
    'SELECT monthly_income, city, occupation, preferred_currency FROM users WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const monthlyIncome = Number(userResult.rows[0].monthly_income || 0);
  const city = userResult.rows[0].city;
  const occupation = userResult.rows[0].occupation;
  const preferredCurrency = normalizeCurrency(userResult.rows[0].preferred_currency, 'USD');

  // Expenses this month
  const expenseResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = $1
       AND type = 'expense'
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR  FROM date) = $3`,
    [userId, month, year]
  );
  const totalExpenses = Number(expenseResult.rows[0].total);

  // Income transactions this month
  const incomeResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = $1
       AND type = 'income'
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR  FROM date) = $3`,
    [userId, month, year]
  );
  const totalIncomeTransactions = Number(incomeResult.rows[0].total);

  // Prefer actual income transactions if available
  const effectiveIncome = totalIncomeTransactions > 0 ? totalIncomeTransactions : monthlyIncome;
  const savings = Math.max(0, effectiveIncome - totalExpenses);
  const savingsRate = effectiveIncome > 0 ? savings / effectiveIncome : 0;

  // Category breakdown
  const categoryResult = await db.query(
    `SELECT
       c.name,
       c.icon,
       c.color,
       COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN categories c ON t.category_id = c.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND EXTRACT(MONTH FROM t.date) = $2
       AND EXTRACT(YEAR  FROM t.date) = $3
     GROUP BY c.category_id, c.name, c.icon, c.color
     ORDER BY total DESC`,
    [userId, month, year]
  );

  const categoryBreakdown = categoryResult.rows.map((row) => ({
    category: row.name,
    icon: row.icon,
    color: row.color,
    amount: Number(row.total),
    percentage: effectiveIncome > 0 ? Number(row.total) / effectiveIncome : 0,
  }));

  const { getActivePlanForUser, mapPlanResponse } = getPlanWriteService();

  const activePlanHeader = await getActivePlanForUser({ userId, dbClient: db });
  let planRuntime = null;

  if (activePlanHeader) {
    const activePlan = await mapPlanResponse({
      planHeader: activePlanHeader,
      dbClient: db,
    });

    const breakdownByCategory = new Map();
    categoryBreakdown.forEach((item) => {
      breakdownByCategory.set(String(item.category || '').toLowerCase(), Number(item.amount || 0));
    });

    const categoryAdherence = (activePlan.allocations || []).map((allocation) => {
      const planned = Number(allocation.allocation_amount || 0);
      const actual = Number(
        breakdownByCategory.get(String(allocation.category_name || '').toLowerCase()) || 0
      );
      const variance = Number((actual - planned).toFixed(2));

      return {
        category_id: allocation.category_id,
        category_name: allocation.category_name,
        is_debt_allocation: allocation.is_debt_allocation === true,
        planned,
        actual,
        variance,
        adherence_percent: planned > 0
          ? Number(((actual / planned) * 100).toFixed(2))
          : 0,
      };
    });

    const plannedTotal = Number(
      categoryAdherence.reduce((sum, item) => sum + Number(item.planned || 0), 0).toFixed(2)
    );
    const actualTotal = Number(
      categoryAdherence.reduce((sum, item) => sum + Number(item.actual || 0), 0).toFixed(2)
    );

    const debtTarget = Number(activePlan.recommended_monthly_debt_payment || 0);
    const debtActual = Number(
      categoryAdherence
        .filter((item) => item.is_debt_allocation)
        .reduce((sum, item) => sum + Number(item.actual || 0), 0)
        .toFixed(2)
    );

    const savingsTarget = Number(activePlan.recommended_savings_amount || 0);
    const savingsActual = Number((effectiveIncome - totalExpenses).toFixed(2));

    planRuntime = {
      plan_id: activePlan.plan_id,
      source: 'active_onboarding_plan',
      planned_total: plannedTotal,
      actual_total: actualTotal,
      variance: Number((actualTotal - plannedTotal).toFixed(2)),
      debt_target: debtTarget,
      debt_actual: debtActual,
      savings_target: savingsTarget,
      savings_actual: savingsActual,
      category_adherence: categoryAdherence,
    };
  }

  // 50/30/20 metrics
  const needsTotal = sumCategories(categoryBreakdown, NEEDS_CATEGORIES);
  const wantsTotal = sumCategories(categoryBreakdown, WANTS_CATEGORIES);

  const needsRate = effectiveIncome > 0 ? needsTotal / effectiveIncome : 0;
  const wantsRate = effectiveIncome > 0 ? wantsTotal / effectiveIncome : 0;

  const overspendingFlags = [];

  if (needsRate > 0.50) {
    overspendingFlags.push({
      rule: '50/30/20 — Needs',
      message: `Essential spending is ${Math.round(needsRate * 100)}% of income (limit: 50%)`,
      severity: needsRate > 0.65 ? 'critical' : 'warning',
      amount: needsTotal,
    });
  }

  if (wantsRate > 0.30) {
    overspendingFlags.push({
      rule: '50/30/20 — Wants',
      message: `Discretionary spending is ${Math.round(wantsRate * 100)}% of income (limit: 30%)`,
      severity: wantsRate > 0.45 ? 'critical' : 'warning',
      amount: wantsTotal,
    });
  }

  if (savingsRate < 0.20 && effectiveIncome > 0) {
    overspendingFlags.push({
      rule: '50/30/20 — Savings',
      message: `Savings rate is ${Math.round(savingsRate * 100)}% of income (target: 20%)`,
      severity: savingsRate < 0.05 ? 'critical' : 'info',
      amount: savings,
    });
  }

  // Trigger metrics
  const foodTotal = sumCategories(categoryBreakdown, FOOD_CATEGORIES);
  const foodRate = effectiveIncome > 0 ? foodTotal / effectiveIncome : 0;

  const subscriptionsTotal = sumCategories(categoryBreakdown, SUBSCRIPTION_CATEGORIES);
  const subscriptionsRate = effectiveIncome > 0 ? subscriptionsTotal / effectiveIncome : 0;

  const transportTotal = sumCategories(categoryBreakdown, TRANSPORT_CATEGORIES);
  const prev = getPreviousMonth(month, year);

  const previousTransportResult = await db.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN categories c ON t.category_id = c.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND EXTRACT(MONTH FROM t.date) = $2
       AND EXTRACT(YEAR  FROM t.date) = $3
       AND c.name = ANY($4::text[])`,
    [userId, prev.month, prev.year, TRANSPORT_CATEGORIES]
  );

  const previousTransportTotal = Number(previousTransportResult.rows[0].total);
  const transportIncreaseRate = previousTransportTotal > 0
    ? (transportTotal - previousTransportTotal) / previousTransportTotal
    : 0;

  // Recent transactions for context
  const recentResult = await db.query(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.category_id
     WHERE t.user_id = $1
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 5`,
    [userId]
  );

  return {
    user_id: userId,
    month,
    year,
    monthly_income: monthlyIncome,
    city,
    occupation,
    preferred_currency: preferredCurrency,
    income: effectiveIncome,
    total_expenses: totalExpenses,
    savings,
    savings_rate: Math.round(savingsRate * 100),
    needs_total: needsTotal,
    needs_rate: needsRate,
    wants_total: wantsTotal,
    wants_rate: wantsRate,
    food_total: foodTotal,
    food_rate: foodRate,
    subscriptions_total: subscriptionsTotal,
    subscriptions_rate: subscriptionsRate,
    transport_total: transportTotal,
    previous_transport_total: previousTransportTotal,
    transport_increase_rate: transportIncreaseRate,
    category_breakdown: categoryBreakdown,
    overspending_flags: overspendingFlags,
    recent_transactions: recentResult.rows,
    plan_runtime: planRuntime,
  };
};

const generateSuggestions = (analysis) => {
  const suggestions = [];

  const income = Number(analysis.income || 0);

  if (analysis.needs_rate > 0.50 && income > 0) {
    const overBy = analysis.needs_total - income * 0.50;
    suggestions.push({
      title: 'Reduce essential spending pressure',
      description: `Needs spending is ${Math.round(analysis.needs_rate * 100)}% of income. Cut roughly ${formatCurrency(overBy, analysis.preferred_currency)} to return under 50%.`,
      severity: analysis.needs_rate > 0.65 ? 'critical' : 'warning',
    });
  }

  if (analysis.wants_rate > 0.30 && income > 0) {
    const overBy = analysis.wants_total - income * 0.30;
    suggestions.push({
      title: 'Trim discretionary categories',
      description: `Wants spending is ${Math.round(analysis.wants_rate * 100)}% of income. Reduce around ${formatCurrency(overBy, analysis.preferred_currency)} from non-essentials to hit 30%.`,
      severity: analysis.wants_rate > 0.45 ? 'critical' : 'warning',
    });
  }

  if (analysis.savings_rate < 20 && income > 0) {
    const needed = income * 0.20 - Number(analysis.savings || 0);
    suggestions.push({
      title: 'Increase monthly savings buffer',
      description: `Current savings rate is ${analysis.savings_rate}%. Save about ${formatCurrency(needed, analysis.preferred_currency)} more this month to reach the 20% target.`,
      severity: analysis.savings_rate < 5 ? 'critical' : 'info',
    });
  }

  if (analysis.food_rate > 0.30 && income > 0) {
    const foodOverBy = analysis.food_total - income * 0.30;
    suggestions.push({
      title: 'Control food and dining spend',
      description: `Food-related spending is ${Math.round(analysis.food_rate * 100)}% of income. Aim to reduce by about ${formatCurrency(foodOverBy, analysis.preferred_currency)} this month.`,
      severity: analysis.food_rate > 0.40 ? 'critical' : 'warning',
    });
  }

  if (analysis.subscriptions_rate > 0.10 && income > 0) {
    const subOverBy = analysis.subscriptions_total - income * 0.10;
    suggestions.push({
      title: 'Audit recurring subscriptions',
      description: `Subscriptions are ${Math.round(analysis.subscriptions_rate * 100)}% of income. Cancel or downgrade plans worth about ${formatCurrency(subOverBy, analysis.preferred_currency)}.`,
      severity: analysis.subscriptions_rate > 0.15 ? 'warning' : 'info',
    });
  }

  if (analysis.previous_transport_total > 0 && analysis.transport_increase_rate > 0.40) {
    suggestions.push({
      title: 'Transport costs jumped month-over-month',
      description: `Transport spending increased ${Math.round(analysis.transport_increase_rate * 100)}% compared with last month. Review ride-hailing and fuel-heavy trips.`,
      severity: analysis.transport_increase_rate > 0.60 ? 'critical' : 'warning',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Spending pattern is on track',
      description: 'No major 50/30/20 violations detected this month. Keep current spending discipline and continue tracking weekly.',
      severity: 'info',
    });
  }

  return suggestions;
};

const persistSuggestions = async (userId, suggestions) => {
  await db.query('DELETE FROM suggestions WHERE user_id = $1', [userId]);

  const inserted = [];

  for (const s of suggestions) {
    const result = await db.query(
      `INSERT INTO suggestions (user_id, title, description, severity, is_read)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING suggestion_id, user_id, title, description, severity, is_read, created_at`,
      [userId, s.title, s.description, s.severity || 'info']
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
};

const getPersistedSuggestions = async (userId, { limit = 20, unreadOnly = false } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  let query = `
    SELECT suggestion_id, title, description, severity, is_read, created_at
    FROM suggestions
    WHERE user_id = $1
  `;

  const params = [userId];
  let paramIndex = 2;

  if (unreadOnly) {
    query += ' AND is_read = FALSE';
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  params.push(safeLimit);

  const result = await db.query(query, params);
  return result.rows;
};

const markSuggestionRead = async (userId, suggestionId) => {
  const result = await db.query(
    `UPDATE suggestions
     SET is_read = TRUE
     WHERE suggestion_id = $1 AND user_id = $2
     RETURNING suggestion_id, title, description, severity, is_read, created_at`,
    [suggestionId, userId]
  );

  return result.rows[0] || null;
};

const refreshSuggestionsForUser = async (userId, monthInput, yearInput) => {
  const analysis = await analyzeSpending(userId, monthInput, yearInput);
  const generated = generateSuggestions(analysis);
  const persisted = await persistSuggestions(userId, generated);

  return {
    analysis,
    suggestions: persisted,
  };
};

module.exports = {
  parseMonthYear,
  analyzeSpending,
  generateSuggestions,
  persistSuggestions,
  getPersistedSuggestions,
  markSuggestionRead,
  refreshSuggestionsForUser,
};
