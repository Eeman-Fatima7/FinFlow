const db = require('../../db/db');

const toNumeric = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeMerchant = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

const getMedian = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

const getMad = (values = [], median = getMedian(values)) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const deviations = values.map((value) => Math.abs(value - median));
  return getMedian(deviations);
};

const getPercentile = (values = [], percentile = 0.95) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  const bounded = Math.min(1, Math.max(0, percentile));
  const index = (sorted.length - 1) * bounded;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
};

const getUserAmountBaseline = async ({ userId, type, excludingTransactionId = null, lookbackLimit = 60 }) => {
  const result = await db.query(
    `SELECT amount
     FROM transactions
     WHERE user_id = $1
       AND type = $2
       AND status = 'completed'
       AND amount > 0
       AND ($3::int IS NULL OR transaction_id <> $3)
     ORDER BY date DESC, created_at DESC
     LIMIT $4`,
    [userId, type, excludingTransactionId, lookbackLimit]
  );

  const values = result.rows.map((row) => toNumeric(row.amount)).filter((value) => value > 0);
  const median = getMedian(values);
  const mad = getMad(values, median);

  return {
    sampleSize: values.length,
    values,
    median,
    mad,
    p90: getPercentile(values, 0.9),
    p95: getPercentile(values, 0.95),
  };
};

const getCategoryAmountBaseline = async ({
  userId,
  type,
  categoryId,
  excludingTransactionId = null,
  lookbackLimit = 50,
}) => {
  if (!categoryId) {
    return {
      sampleSize: 0,
      values: [],
      median: 0,
      mad: 0,
      p90: 0,
      p95: 0,
    };
  }

  const result = await db.query(
    `SELECT amount
     FROM transactions
     WHERE user_id = $1
       AND type = $2
       AND category_id = $3
       AND status = 'completed'
       AND amount > 0
       AND ($4::int IS NULL OR transaction_id <> $4)
     ORDER BY date DESC, created_at DESC
     LIMIT $5`,
    [userId, type, categoryId, excludingTransactionId, lookbackLimit]
  );

  const values = result.rows.map((row) => toNumeric(row.amount)).filter((value) => value > 0);
  const median = getMedian(values);
  const mad = getMad(values, median);

  return {
    sampleSize: values.length,
    values,
    median,
    mad,
    p90: getPercentile(values, 0.9),
    p95: getPercentile(values, 0.95),
  };
};

const getMerchantHistory = async ({ userId, merchant, excludingTransactionId = null, lookbackLimit = 80 }) => {
  const normalizedMerchant = normalizeMerchant(merchant);
  if (!normalizedMerchant) {
    return {
      merchant: normalizedMerchant,
      occurrences: 0,
      amounts: [],
      median: 0,
      mad: 0,
      p90: 0,
      p95: 0,
      latestDate: null,
      firstDate: null,
    };
  }

  const result = await db.query(
    `SELECT amount, date
     FROM transactions
     WHERE user_id = $1
       AND status = 'completed'
       AND LOWER(TRIM(COALESCE(merchant, description, ''))) = $2
       AND ($3::int IS NULL OR transaction_id <> $3)
     ORDER BY date DESC, created_at DESC
     LIMIT $4`,
    [userId, normalizedMerchant, excludingTransactionId, lookbackLimit]
  );

  const amounts = result.rows
    .map((row) => toNumeric(row.amount))
    .filter((value) => value > 0);
  const median = getMedian(amounts);
  const mad = getMad(amounts, median);

  return {
    merchant: normalizedMerchant,
    occurrences: result.rows.length,
    amounts,
    median,
    mad,
    p90: getPercentile(amounts, 0.9),
    p95: getPercentile(amounts, 0.95),
    latestDate: result.rows[0]?.date || null,
    firstDate: result.rows[result.rows.length - 1]?.date || null,
  };
};

const getRecurringMerchantBaseline = async ({
  userId,
  merchant,
  type,
  excludingTransactionId = null,
  lookbackMonths = 9,
}) => {
  const normalizedMerchant = normalizeMerchant(merchant);

  if (!normalizedMerchant) {
    return {
      sampleSize: 0,
      monthly: [],
      median: 0,
      mad: 0,
      p90: 0,
      p95: 0,
      activeMonths: 0,
      recurringLikely: false,
    };
  }

  const result = await db.query(
    `SELECT
       EXTRACT(YEAR FROM date)::int AS year,
       EXTRACT(MONTH FROM date)::int AS month,
       AVG(amount)::numeric AS avg_amount,
       COUNT(*)::int AS entries
     FROM transactions
     WHERE user_id = $1
       AND type = $2
       AND status = 'completed'
       AND amount > 0
       AND LOWER(TRIM(COALESCE(merchant, description, ''))) = $3
       AND date >= (CURRENT_DATE - ($4::int || ' months')::interval)
       AND ($5::int IS NULL OR transaction_id <> $5)
     GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
     ORDER BY year DESC, month DESC`,
    [userId, type, normalizedMerchant, lookbackMonths, excludingTransactionId]
  );

  const monthly = result.rows.map((row) => ({
    year: Number(row.year),
    month: Number(row.month),
    avgAmount: toNumeric(row.avg_amount),
    entries: Number(row.entries) || 0,
  }));

  const values = monthly.map((row) => row.avgAmount).filter((value) => value > 0);
  const median = getMedian(values);
  const mad = getMad(values, median);

  return {
    sampleSize: values.length,
    monthly,
    median,
    mad,
    p90: getPercentile(values, 0.9),
    p95: getPercentile(values, 0.95),
    activeMonths: monthly.length,
    recurringLikely: monthly.length >= 3,
  };
};

const getMonthlyTotalsWindow = async ({ userId, monthsBack = 12, month = null, year = null }) => {
  const months = Number.isInteger(Number(monthsBack)) && Number(monthsBack) > 0
    ? Number(monthsBack)
    : 12;

  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);

  const anchorMonth = Number.isInteger(normalizedMonth) && normalizedMonth >= 1 && normalizedMonth <= 12
    ? normalizedMonth
    : null;
  const anchorYear = Number.isInteger(normalizedYear) && normalizedYear >= 2000
    ? normalizedYear
    : null;

  const result = await db.query(
    `WITH anchor AS (
       SELECT CASE
         WHEN $3::int IS NOT NULL AND $4::int IS NOT NULL
           THEN make_date($4::int, $3::int, 1)::date
         ELSE date_trunc('month', CURRENT_DATE)::date
       END AS month_start
     )
     SELECT
       EXTRACT(YEAR FROM t.date)::int AS year,
       EXTRACT(MONTH FROM t.date)::int AS month,
       SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)::numeric AS total_expense,
       SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)::numeric AS total_income,
       COUNT(*) FILTER (WHERE t.type = 'expense')::int AS expense_count,
       COUNT(*) FILTER (WHERE t.type = 'income')::int AS income_count,
       COUNT(*)::int AS transaction_count
     FROM transactions t
     CROSS JOIN anchor a
     WHERE t.user_id = $1
       AND t.status = 'completed'
       AND t.amount > 0
       AND t.date >= (a.month_start - (($2::int - 1) || ' months')::interval)
       AND t.date < (a.month_start + INTERVAL '1 month')
     GROUP BY EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
     ORDER BY year ASC, month ASC`,
    [userId, months, anchorMonth, anchorYear]
  );

  const rows = result.rows.map((row) => {
    const totalExpense = toNumeric(row.total_expense);
    const totalIncome = toNumeric(row.total_income);
    const savings = Number((totalIncome - totalExpense).toFixed(2));
    const savingsRate = totalIncome > 0
      ? Number(((savings / totalIncome) * 100).toFixed(2))
      : 0;

    return {
      year: Number(row.year),
      month: Number(row.month),
      totalExpense,
      totalIncome,
      savings,
      savingsRate,
      expenseCount: Number(row.expense_count) || 0,
      incomeCount: Number(row.income_count) || 0,
      transactionCount: Number(row.transaction_count) || 0,
    };
  });

  const expenseValues = rows.map((row) => row.totalExpense).filter((value) => value > 0);
  const incomeValues = rows.map((row) => row.totalIncome).filter((value) => value > 0);
  const savingsRateValues = rows.map((row) => row.savingsRate);

  return {
    rows,
    expenseStats: {
      sampleSize: expenseValues.length,
      median: getMedian(expenseValues),
      mad: getMad(expenseValues),
      p90: getPercentile(expenseValues, 0.9),
      p95: getPercentile(expenseValues, 0.95),
    },
    incomeStats: {
      sampleSize: incomeValues.length,
      median: getMedian(incomeValues),
      mad: getMad(incomeValues),
      p90: getPercentile(incomeValues, 0.9),
      p95: getPercentile(incomeValues, 0.95),
    },
    savingsRateStats: {
      sampleSize: savingsRateValues.length,
      median: getMedian(savingsRateValues),
      mad: getMad(savingsRateValues),
      p10: getPercentile(savingsRateValues, 0.1),
      p25: getPercentile(savingsRateValues, 0.25),
    },
  };
};

const getCategoryMonthlyBaseline = async ({ userId, month, year, lookbackMonths = 12 }) => {
  const targetMonth = Number(month);
  const targetYear = Number(year);

  if (!Number.isInteger(targetMonth) || !Number.isInteger(targetYear) || targetMonth < 1 || targetMonth > 12) {
    return {
      current: [],
      historical: [],
      byCategory: new Map(),
    };
  }

  const historyLimit = Number.isInteger(Number(lookbackMonths)) && Number(lookbackMonths) > 0
    ? Number(lookbackMonths)
    : 12;

  const currentResult = await db.query(
    `SELECT
       c.category_id,
       c.name AS category_name,
       COALESCE(SUM(t.amount), 0)::numeric AS month_total,
       COUNT(*)::int AS entry_count
     FROM categories c
     LEFT JOIN transactions t
       ON t.category_id = c.category_id
      AND t.user_id = $1
      AND t.type = 'expense'
      AND t.status = 'completed'
      AND EXTRACT(MONTH FROM t.date) = $2
      AND EXTRACT(YEAR FROM t.date) = $3
     GROUP BY c.category_id, c.name
     HAVING COALESCE(SUM(t.amount), 0) > 0
     ORDER BY month_total DESC`,
    [userId, targetMonth, targetYear]
  );

  const historicalResult = await db.query(
    `SELECT
       t.category_id,
       c.name AS category_name,
       EXTRACT(YEAR FROM t.date)::int AS year,
       EXTRACT(MONTH FROM t.date)::int AS month,
       SUM(t.amount)::numeric AS month_total,
       COUNT(*)::int AS entry_count
     FROM transactions t
     JOIN categories c ON c.category_id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.status = 'completed'
       AND t.amount > 0
       AND (EXTRACT(YEAR FROM t.date)::int * 100 + EXTRACT(MONTH FROM t.date)::int) < ($2::int * 100 + $3::int)
       AND t.date >= make_date($2, $3, 1) - (($4::int) || ' months')::interval
     GROUP BY t.category_id, c.name, EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
     ORDER BY year DESC, month DESC`,
    [userId, targetYear, targetMonth, historyLimit]
  );

  const current = currentResult.rows.map((row) => ({
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    monthTotal: toNumeric(row.month_total),
    entryCount: Number(row.entry_count) || 0,
  }));

  const historical = historicalResult.rows.map((row) => ({
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    year: Number(row.year),
    month: Number(row.month),
    monthTotal: toNumeric(row.month_total),
    entryCount: Number(row.entry_count) || 0,
  }));

  const grouped = new Map();

  for (const row of historical) {
    if (!grouped.has(row.categoryId)) {
      grouped.set(row.categoryId, {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        totals: [],
        months: 0,
      });
    }

    const bucket = grouped.get(row.categoryId);
    bucket.totals.push(row.monthTotal);
    bucket.months += 1;
  }

  grouped.forEach((bucket) => {
    bucket.median = getMedian(bucket.totals);
    bucket.mad = getMad(bucket.totals, bucket.median);
    bucket.p90 = getPercentile(bucket.totals, 0.9);
    bucket.p95 = getPercentile(bucket.totals, 0.95);
  });

  return {
    current,
    historical,
    byCategory: grouped,
  };
};

module.exports = {
  normalizeMerchant,
  getMedian,
  getMad,
  getPercentile,
  getUserAmountBaseline,
  getCategoryAmountBaseline,
  getMerchantHistory,
  getRecurringMerchantBaseline,
  getMonthlyTotalsWindow,
  getCategoryMonthlyBaseline,
};
