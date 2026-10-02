const db = require('../../db/db');

const MIN_YEAR = 2000;

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const toNonNegativeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const parseYearMonth = (value) => {
  if (typeof value !== 'string') return null;
  const [yearPart, monthPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (year < MIN_YEAR || month < 1 || month > 12) return null;
  return { year, month };
};

const sortMonthRowsAsc = (rows = []) => {
  return [...rows].sort((a, b) => {
    const aKey = Number(a.year) * 100 + Number(a.month);
    const bKey = Number(b.year) * 100 + Number(b.month);
    return aKey - bKey;
  });
};

const buildRecentYearMonthWindow = (monthsBack = 18) => {
  const safeMonthsBack = Number.isInteger(Number(monthsBack)) && Number(monthsBack) > 0
    ? Number(monthsBack)
    : 18;

  const now = new Date();
  const points = [];

  for (let offset = safeMonthsBack - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    points.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }

  return points;
};

const classifyTopCategories = (categories = [], limit = 5) => {
  const cappedLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Number(limit)
    : 5;

  return categories
    .map((row) => ({
      category: row.category,
      total: Number(Number(row.total || 0).toFixed(2)),
    }))
    .filter((row) => row.category && row.total > 0)
    .slice(0, cappedLimit);
};

const getForecastHistoryForUser = async ({ userId, monthsBack = 18 }) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    const err = new Error('userId must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  const userResult = await db.query(
    `SELECT user_id, monthly_income
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [numericUserId]
  );

  if (!userResult.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const profileMonthlyIncome = toNonNegativeNumber(userResult.rows[0].monthly_income);

  const statusStatsResult = await db.query(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count
     FROM transactions
     WHERE user_id = $1
       AND amount > 0
       AND date <= CURRENT_DATE`,
    [numericUserId]
  );

  const monthlyRowsResult = await db.query(
    `SELECT
       EXTRACT(YEAR FROM t.date)::int AS year,
       EXTRACT(MONTH FROM t.date)::int AS month,
       SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)::numeric AS expense_total,
       SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)::numeric AS income_total_from_transactions,
       COUNT(*)::int AS transaction_count,
       COUNT(*) FILTER (WHERE t.type = 'expense')::int AS expense_count,
       COUNT(*) FILTER (WHERE t.type = 'income')::int AS income_count,
       SUM(
         CASE
           WHEN t.type = 'expense' AND c.name = 'Transfers' THEN t.amount
           ELSE 0
         END
       )::numeric AS transfer_total
     FROM transactions t
     LEFT JOIN categories c ON c.category_id = t.category_id
     WHERE t.user_id = $1
       AND t.status = 'completed'
       AND t.amount > 0
       AND t.date <= CURRENT_DATE
       AND t.type IN ('income', 'expense')
     GROUP BY EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
     ORDER BY year ASC, month ASC`,
    [numericUserId]
  );

  const categoryRowsResult = await db.query(
    `SELECT
       c.name AS category,
       SUM(t.amount)::numeric AS total
     FROM transactions t
     JOIN categories c ON c.category_id = t.category_id
     WHERE t.user_id = $1
       AND t.status = 'completed'
       AND t.amount > 0
       AND t.date <= CURRENT_DATE
       AND t.type = 'expense'
     GROUP BY c.name
     ORDER BY total DESC`,
    [numericUserId]
  );

  const monthRowsAsc = sortMonthRowsAsc(monthlyRowsResult.rows.map((row) => ({
    year: Number(row.year),
    month: Number(row.month),
    expense_total: toPositiveNumber(row.expense_total),
    income_total_from_transactions: toPositiveNumber(row.income_total_from_transactions),
    transaction_count: Number(row.transaction_count) || 0,
    expense_count: Number(row.expense_count) || 0,
    income_count: Number(row.income_count) || 0,
    transfer_total: toPositiveNumber(row.transfer_total),
  })));

  const monthWindow = buildRecentYearMonthWindow(monthsBack);
  const rowByKey = new Map(
    monthRowsAsc.map((row) => [`${row.year}-${String(row.month).padStart(2, '0')}`, row])
  );

  const monthsWithFallbackIncome = [];
  const monthlySeries = monthWindow.map((slot) => {
    const row = rowByKey.get(slot.key);
    const incomeFromTransactions = row ? row.income_total_from_transactions : 0;
    const effectiveIncome = incomeFromTransactions > 0 ? incomeFromTransactions : profileMonthlyIncome;

    if (incomeFromTransactions <= 0 && effectiveIncome > 0) {
      monthsWithFallbackIncome.push(slot.key);
    }

    const expenseTotal = row ? row.expense_total : 0;
    const savings = Number((effectiveIncome - expenseTotal).toFixed(2));
    const savingsRate = effectiveIncome > 0
      ? Number(((savings / effectiveIncome) * 100).toFixed(2))
      : 0;

    return {
      year: slot.year,
      month: slot.month,
      year_month: slot.key,
      expense_total: Number(expenseTotal.toFixed(2)),
      income_total_from_transactions: Number(incomeFromTransactions.toFixed(2)),
      effective_income: Number(effectiveIncome.toFixed(2)),
      savings,
      savings_rate: savingsRate,
      transaction_count: row ? row.transaction_count : 0,
      expense_count: row ? row.expense_count : 0,
      income_count: row ? row.income_count : 0,
      transfer_total: Number((row ? row.transfer_total : 0).toFixed(2)),
      used_profile_income_fallback: incomeFromTransactions <= 0 && effectiveIncome > 0,
      has_observed_activity: Boolean(row && row.transaction_count > 0),
    };
  });

  const observedMonths = monthlySeries.filter((row) => row.has_observed_activity);
  const historyStart = observedMonths[0] || null;
  const historyEnd = observedMonths[observedMonths.length - 1] || null;

  const pendingCount = Number(statusStatsResult.rows[0]?.pending_count || 0);
  const completedCount = Number(statusStatsResult.rows[0]?.completed_count || 0);

  const qualityFlags = [];
  if (observedMonths.length === 0) {
    qualityFlags.push('no_observed_history');
  } else if (observedMonths.length < 3) {
    qualityFlags.push('sparse_history');
  }

  if (pendingCount > completedCount && pendingCount > 0) {
    qualityFlags.push('pending_heavy_dataset');
  }

  if (monthsWithFallbackIncome.length > 0) {
    qualityFlags.push('profile_income_fallback_used');
  }

  return {
    user_id: numericUserId,
    generated_at: new Date().toISOString(),
    profile_monthly_income: Number(profileMonthlyIncome.toFixed(2)),
    history: {
      start_year_month: historyStart ? historyStart.year_month : null,
      end_year_month: historyEnd ? historyEnd.year_month : null,
      total_observed_months: observedMonths.length,
      total_window_months: monthlySeries.length,
      months_with_profile_income_fallback: monthsWithFallbackIncome,
      completed_transactions_count: completedCount,
      excluded_pending_transactions_count: pendingCount,
      quality_flags: qualityFlags,
    },
    monthly_series: monthlySeries,
    category_totals: classifyTopCategories(categoryRowsResult.rows, 8),
  };
};

module.exports = {
  getForecastHistoryForUser,
  parseYearMonth,
};
