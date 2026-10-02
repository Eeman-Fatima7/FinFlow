const { createFingerprint } = require('../import/fingerprintService');
const {
  ANOMALY_TYPES,
  ANOMALY_SCOPE,
  ANOMALY_SEVERITY,
} = require('./anomalyTypes');

const MIN_SPIKE_AMOUNT = 500;
const MIN_HIGH_AMOUNT_FIRST_MERCHANT = 2000;
const MIN_RARE_MERCHANT_AMOUNT = 1000;
const MIN_MONTH_EXPENSE_FOR_PRESSURE = 1000;

const toNumeric = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getRobustScore = ({ value, median, mad }) => {
  const safeMad = mad > 0 ? mad : Math.max(1, median * 0.1);
  return (value - median) / safeMad;
};

const severityFromScore = ({ score, mediumThreshold = 3, highThreshold = 6 }) => {
  if (score >= highThreshold) return ANOMALY_SEVERITY.HIGH;
  if (score >= mediumThreshold) return ANOMALY_SEVERITY.MEDIUM;
  return ANOMALY_SEVERITY.LOW;
};

const resolveTransactionId = (transaction) => {
  const numeric = Number(transaction?.transaction_id || transaction?.id || 0);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const evaluateDuplicateSignals = ({
  userId,
  transaction,
  dedupe,
}) => {
  const anomalies = [];

  if (!transaction) return anomalies;

  const dedupeStatus = dedupe?.dedupe_status || '';
  if (dedupeStatus !== 'blocked_exact' && dedupeStatus !== 'probable_duplicate') {
    return anomalies;
  }

  const dedupeFingerprint = dedupe?.dedupe_fingerprint || createFingerprint({
    userId,
    date: transaction.date,
    amount: transaction.amount,
    type: transaction.type,
    merchant: transaction.merchant,
    description: transaction.description,
    referenceId: transaction.source_reference_id,
    sourceBank: transaction.source,
  });

  const transactionId = resolveTransactionId(transaction);

  const type = dedupeStatus === 'blocked_exact'
    ? ANOMALY_TYPES.DUPLICATE_EXACT
    : ANOMALY_TYPES.DUPLICATE_PROBABLE;

  anomalies.push({
    type,
    scope: ANOMALY_SCOPE.TRANSACTION,
    severity: dedupeStatus === 'blocked_exact' ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
    transactionId,
    dedupeKey: `${type}|${dedupeFingerprint}`,
    evidence: {
      dedupe_status: dedupeStatus,
      dedupe_fingerprint: dedupeFingerprint,
      duplicate_reason: dedupe?.duplicate_reason || null,
      amount: toNumeric(transaction.amount),
      date: transaction.date,
      merchant: transaction.merchant || null,
      source: transaction.source || null,
    },
  });

  return anomalies;
};

const evaluateAmountSpikeUser = ({ transaction, userBaseline }) => {
  if (!transaction || !userBaseline) return null;

  const amount = toNumeric(transaction.amount);
  if (amount < MIN_SPIKE_AMOUNT) return null;
  if (userBaseline.sampleSize < 4) return null;

  const score = getRobustScore({
    value: amount,
    median: userBaseline.median,
    mad: userBaseline.mad,
  });

  if (score < 3 && amount < userBaseline.p95 * 1.1) return null;

  return {
    type: ANOMALY_TYPES.AMOUNT_SPIKE_USER,
    scope: ANOMALY_SCOPE.TRANSACTION,
    severity: severityFromScore({ score, mediumThreshold: 3, highThreshold: 7 }),
    transactionId: resolveTransactionId(transaction),
    evidence: {
      amount,
      type: transaction.type,
      baseline_median: Number(userBaseline.median.toFixed(2)),
      baseline_mad: Number(userBaseline.mad.toFixed(2)),
      baseline_p95: Number(userBaseline.p95.toFixed(2)),
      robust_score: Number(score.toFixed(2)),
      sample_size: userBaseline.sampleSize,
    },
  };
};

const evaluateAmountSpikeCategory = ({ transaction, categoryBaseline }) => {
  if (!transaction || !categoryBaseline || !transaction.category_id) return null;

  const amount = toNumeric(transaction.amount);
  if (amount < MIN_SPIKE_AMOUNT) return null;
  if (categoryBaseline.sampleSize < 3) return null;

  const score = getRobustScore({
    value: amount,
    median: categoryBaseline.median,
    mad: categoryBaseline.mad,
  });

  if (score < 2.8 && amount < categoryBaseline.p95 * 1.08) return null;

  return {
    type: ANOMALY_TYPES.AMOUNT_SPIKE_CATEGORY,
    scope: ANOMALY_SCOPE.TRANSACTION,
    severity: severityFromScore({ score, mediumThreshold: 2.8, highThreshold: 6.5 }),
    transactionId: resolveTransactionId(transaction),
    evidence: {
      amount,
      category_id: transaction.category_id,
      category_name: transaction.category_name || null,
      baseline_median: Number(categoryBaseline.median.toFixed(2)),
      baseline_mad: Number(categoryBaseline.mad.toFixed(2)),
      baseline_p95: Number(categoryBaseline.p95.toFixed(2)),
      robust_score: Number(score.toFixed(2)),
      sample_size: categoryBaseline.sampleSize,
    },
  };
};

const evaluateFirstTimeMerchantHighAmount = ({ transaction, merchantHistory, userBaseline }) => {
  if (!transaction || !merchantHistory || !userBaseline) return null;

  const amount = toNumeric(transaction.amount);
  if (amount < MIN_HIGH_AMOUNT_FIRST_MERCHANT) return null;
  if (merchantHistory.occurrences > 0) return null;
  if (userBaseline.sampleSize < 5) return null;

  const ratio = userBaseline.median > 0 ? amount / userBaseline.median : 0;
  if (ratio < 2.5 && amount < userBaseline.p95) return null;

  return {
    type: ANOMALY_TYPES.FIRST_TIME_MERCHANT_HIGH_AMOUNT,
    scope: ANOMALY_SCOPE.TRANSACTION,
    severity: ratio >= 4 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
    transactionId: resolveTransactionId(transaction),
    evidence: {
      merchant: transaction.merchant || transaction.description || null,
      amount,
      baseline_median: Number(userBaseline.median.toFixed(2)),
      baseline_p95: Number(userBaseline.p95.toFixed(2)),
      first_time_merchant: true,
      ratio_vs_user_median: Number(ratio.toFixed(2)),
      sample_size: userBaseline.sampleSize,
    },
  };
};

const evaluateRareMerchant = ({ transaction, merchantHistory, userBaseline }) => {
  if (!transaction || !merchantHistory || !userBaseline) return null;

  const amount = toNumeric(transaction.amount);
  if (amount < MIN_RARE_MERCHANT_AMOUNT) return null;
  if (merchantHistory.occurrences === 0 || merchantHistory.occurrences > 2) return null;
  if (userBaseline.sampleSize < 4) return null;

  const ratio = userBaseline.median > 0 ? amount / userBaseline.median : 0;
  if (ratio < 1.8 && amount < userBaseline.p90) return null;

  return {
    type: ANOMALY_TYPES.RARE_MERCHANT,
    scope: ANOMALY_SCOPE.TRANSACTION,
    severity: ratio >= 3 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
    transactionId: resolveTransactionId(transaction),
    evidence: {
      merchant: transaction.merchant || transaction.description || null,
      amount,
      merchant_occurrences: merchantHistory.occurrences,
      baseline_median: Number(userBaseline.median.toFixed(2)),
      baseline_p90: Number(userBaseline.p90.toFixed(2)),
      ratio_vs_user_median: Number(ratio.toFixed(2)),
      sample_size: userBaseline.sampleSize,
    },
  };
};

const evaluateRecurringAmountDrift = ({ transaction, recurringBaseline }) => {
  if (!transaction || !recurringBaseline) return null;

  const amount = toNumeric(transaction.amount);
  if (!recurringBaseline.recurringLikely || recurringBaseline.sampleSize < 3) return null;
  if (amount < MIN_SPIKE_AMOUNT) return null;

  const score = getRobustScore({
    value: amount,
    median: recurringBaseline.median,
    mad: recurringBaseline.mad,
  });

  if (score < 2.5 && amount < recurringBaseline.p95 * 1.05) return null;

  return {
    type: ANOMALY_TYPES.RECURRING_AMOUNT_DRIFT,
    scope: ANOMALY_SCOPE.TRANSACTION,
    severity: severityFromScore({ score, mediumThreshold: 2.5, highThreshold: 5.5 }),
    transactionId: resolveTransactionId(transaction),
    evidence: {
      merchant: transaction.merchant || transaction.description || null,
      amount,
      baseline_median: Number(recurringBaseline.median.toFixed(2)),
      baseline_mad: Number(recurringBaseline.mad.toFixed(2)),
      baseline_p95: Number(recurringBaseline.p95.toFixed(2)),
      robust_score: Number(score.toFixed(2)),
      recurring_months: recurringBaseline.activeMonths,
      sample_size: recurringBaseline.sampleSize,
    },
  };
};

const evaluateTransactionAnomalies = ({
  userId,
  transaction,
  dedupe,
  userBaseline,
  categoryBaseline,
  merchantHistory,
  recurringBaseline,
}) => {
  if (!transaction) return [];

  const anomalies = [
    ...evaluateDuplicateSignals({ userId, transaction, dedupe }),
  ];

  const candidates = [
    evaluateAmountSpikeUser({ transaction, userBaseline }),
    evaluateAmountSpikeCategory({ transaction, categoryBaseline }),
    evaluateFirstTimeMerchantHighAmount({ transaction, merchantHistory, userBaseline }),
    evaluateRareMerchant({ transaction, merchantHistory, userBaseline }),
    evaluateRecurringAmountDrift({ transaction, recurringBaseline }),
  ].filter(Boolean);

  return [...anomalies, ...candidates];
};

const evaluateCategorySpikeMonth = ({
  currentCategory,
  baselineCategory,
  year,
  month,
}) => {
  if (!currentCategory || !baselineCategory) return null;
  if (!baselineCategory.totals || baselineCategory.totals.length < 3) return null;

  const currentTotal = toNumeric(currentCategory.monthTotal);
  if (currentTotal < MIN_MONTH_EXPENSE_FOR_PRESSURE) return null;

  const score = getRobustScore({
    value: currentTotal,
    median: baselineCategory.median,
    mad: baselineCategory.mad,
  });

  if (score < 2.7 && currentTotal < baselineCategory.p95 * 1.05) return null;

  return {
    type: ANOMALY_TYPES.CATEGORY_SPIKE_MONTH,
    scope: ANOMALY_SCOPE.MONTH,
    severity: severityFromScore({ score, mediumThreshold: 2.7, highThreshold: 5.8 }),
    year,
    month,
    evidence: {
      category_id: currentCategory.categoryId,
      category_name: currentCategory.categoryName,
      current_month_total: Number(currentTotal.toFixed(2)),
      baseline_median: Number(baselineCategory.median.toFixed(2)),
      baseline_mad: Number(baselineCategory.mad.toFixed(2)),
      baseline_p95: Number(baselineCategory.p95.toFixed(2)),
      robust_score: Number(score.toFixed(2)),
      sample_size: baselineCategory.totals.length,
    },
  };
};

const evaluateCashflowPressure = ({ monthlyWindow, year, month }) => {
  if (!monthlyWindow || !Array.isArray(monthlyWindow.rows) || monthlyWindow.rows.length < 3) {
    return null;
  }

  const current = monthlyWindow.rows.find((row) => Number(row.year) === Number(year) && Number(row.month) === Number(month));
  if (!current || current.totalExpense < MIN_MONTH_EXPENSE_FOR_PRESSURE) return null;

  const expenseScore = getRobustScore({
    value: current.totalExpense,
    median: monthlyWindow.expenseStats.median,
    mad: monthlyWindow.expenseStats.mad,
  });

  const savingsStress = current.savingsRate < monthlyWindow.savingsRateStats.p25;
  const highExpense = expenseScore >= 2.6 || current.totalExpense >= monthlyWindow.expenseStats.p95;

  if (!highExpense || !savingsStress) return null;

  return {
    type: ANOMALY_TYPES.CASHFLOW_PRESSURE,
    scope: ANOMALY_SCOPE.MONTH,
    severity: expenseScore >= 4 || current.savingsRate < 0 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
    year,
    month,
    evidence: {
      total_expenses: Number(current.totalExpense.toFixed(2)),
      total_income: Number(current.totalIncome.toFixed(2)),
      savings: Number(current.savings.toFixed(2)),
      savings_rate: Number(current.savingsRate.toFixed(2)),
      baseline_expense_median: Number(monthlyWindow.expenseStats.median.toFixed(2)),
      baseline_expense_p95: Number(monthlyWindow.expenseStats.p95.toFixed(2)),
      baseline_savings_rate_p25: Number(monthlyWindow.savingsRateStats.p25.toFixed(2)),
      robust_score: Number(expenseScore.toFixed(2)),
      sample_size: monthlyWindow.rows.length,
    },
  };
};

const evaluateIncomeMissingExpectedCycle = ({ monthlyWindow, year, month }) => {
  if (!monthlyWindow || !Array.isArray(monthlyWindow.rows) || monthlyWindow.rows.length < 5) {
    return null;
  }

  const current = monthlyWindow.rows.find((row) => Number(row.year) === Number(year) && Number(row.month) === Number(month));
  if (!current) return null;

  const baselineMedian = monthlyWindow.incomeStats.median;
  if (baselineMedian <= 0) return null;

  const currentIncome = toNumeric(current.totalIncome);
  const ratio = baselineMedian > 0 ? currentIncome / baselineMedian : 1;

  if (ratio >= 0.35) return null;

  const severity = ratio <= 0.1 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM;

  return {
    type: ANOMALY_TYPES.INCOME_MISSING_EXPECTED_CYCLE,
    scope: ANOMALY_SCOPE.MONTH,
    severity,
    year,
    month,
    evidence: {
      current_income: Number(currentIncome.toFixed(2)),
      baseline_income_median: Number(baselineMedian.toFixed(2)),
      baseline_income_p90: Number(monthlyWindow.incomeStats.p90.toFixed(2)),
      ratio_vs_median: Number(ratio.toFixed(2)),
      sample_size: monthlyWindow.incomeStats.sampleSize,
    },
  };
};

const evaluateMonthlyAnomalies = ({
  year,
  month,
  monthlyWindow,
  categoryMonthly,
}) => {
  const anomalies = [];

  if (categoryMonthly && Array.isArray(categoryMonthly.current)) {
    for (const currentCategory of categoryMonthly.current) {
      const baselineCategory = categoryMonthly.byCategory.get(currentCategory.categoryId);
      const candidate = evaluateCategorySpikeMonth({
        currentCategory,
        baselineCategory,
        year,
        month,
      });

      if (candidate) {
        anomalies.push(candidate);
      }
    }
  }

  const cashflowPressure = evaluateCashflowPressure({ monthlyWindow, year, month });
  if (cashflowPressure) anomalies.push(cashflowPressure);

  const missingIncome = evaluateIncomeMissingExpectedCycle({ monthlyWindow, year, month });
  if (missingIncome) anomalies.push(missingIncome);

  return anomalies;
};

module.exports = {
  evaluateTransactionAnomalies,
  evaluateMonthlyAnomalies,
};
