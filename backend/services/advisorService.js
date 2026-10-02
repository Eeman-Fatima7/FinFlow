const axios = require('axios');
const db = require('../db/db');
const budgetService = require('./budgetService');
const { getForecastHistoryForUser } = require('./forecast/forecastHistoryService');
const { getDashboardAnomalySummary } = require('./anomalies/anomalyOrchestratorService');
const { getLatestImportSessionSnapshotForUser } = require('./import/sessionService');
const { AMBIGUITY_MARGIN } = require('../config/mlConfig');
const { logServiceEvent, makeCorrelationId } = require('./observability/eventLogger');

const ECOMAGENT_API_BASE_URL = (process.env.ECOMAGENT_BASE_URL || 'https://api.ecomagent.in/v1').trim().replace(/\/+$/, '');
const ECOMAGENT_DEFAULT_MODEL = 'claude-opus-4.6';
const ECOMAGENT_FALLBACK_MODEL = 'mmodel';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const MAX_ITEMS_PER_BAND = 8;
const MAX_ITEMS_PER_PROMPT_SECTION = 6;
const MAX_IMPORT_ROWS_FOR_CONTEXT = 120;
const MAX_ALL_TIME_CATEGORY_ITEMS = 8;
const MAX_RECURRING_MERCHANT_ITEMS = 6;
const MAX_ACTIVE_GOAL_ITEMS = 6;
const MAX_RECENT_TRANSACTIONS_ITEMS = 12;
const MAX_PROMPT_TREND_ITEMS = 6;
const ACTION_PROPOSAL_PROMPT_KEY = '[ACTION_PROPOSAL_JSON]';
const EMPTY_LLM_FALLBACK_REPLY = `I'm temporarily unable to retrieve a reliable AI-generated answer from the provider.

What I can still do right now:
- explain your current confidence view (confirmed/predicted/uncertain),
- walk through your latest budget metrics and flags,
- give deterministic budgeting guidance based on your actual dashboard data.

If you want, ask: "Explain my confidence view" and I'll break it down.`;

/** Returns true when the string looks like a real assistant reply, not a provider fragment. */
const isValidModelReply = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  // Reject obvious loading/fragment artifacts
  if (/^<[^>]+>$/.test(trimmed)) return false;
  if (/^(load|Loading|LOADING|loading|please wait)/i.test(trimmed)) return false;
  return true;
};

const EMPTY_ANOMALY_SUMMARY = {
  total_active: 0,
  high_count: 0,
  medium_count: 0,
  low_count: 0,
  highlights: [],
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toRounded = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
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

const formatCategoryBreakdown = (categoryBreakdown, currency = 'USD') => {
  if (!categoryBreakdown || categoryBreakdown.length === 0) {
    return '- No expense transactions found for this month.';
  }

  return categoryBreakdown
    .slice(0, 10)
    .map((item) => `- ${item.category}: ${formatCurrency(item.amount, currency)} (${Math.round(toNumber(item.percentage) * 100)}%)`)
    .join('\n');
};

const formatOverspendingFlags = (flags) => {
  if (!flags || flags.length === 0) {
    return '- None';
  }

  return flags
    .map((flag) => `- [${flag.severity}] ${flag.message}`)
    .join('\n');
};

const parseJsonObject = (value, fallback = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const uniqueNonEmpty = (values = []) => {
  const normalized = values
    .map((value) => toTrimmedString(value))
    .filter(Boolean);

  return [...new Set(normalized)];
};

const toConfidenceBucket = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'medium';
};

const mapForecastConfidence = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'high' || normalized === 'strong') return 'high';
  if (normalized === 'low' || normalized === 'weak') return 'low';
  return 'medium';
};

const severityToConfidence = (severity) => {
  const normalized = toTrimmedString(severity).toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'low') return 'low';
  return 'medium';
};

const normalizeIsoDate = (value = new Date().toISOString()) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const createContextItem = ({
  id,
  kind,
  statement,
  value,
  confidence,
  provenance,
  timeScope,
}) => ({
  id,
  kind,
  statement,
  value,
  confidence: toConfidenceBucket(confidence),
  provenance: {
    service: toTrimmedString(provenance?.service) || 'unknown',
    method: toTrimmedString(provenance?.method) || null,
    as_of: normalizeIsoDate(provenance?.as_of),
    quality_flags: uniqueNonEmpty(provenance?.quality_flags || []),
  },
  time_scope: toTrimmedString(timeScope) || 'current_month',
});

const safeTopPredictions = (value) => {
  return parseJsonArray(value)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const category = toTrimmedString(item.category);
      const confidence = Number(item.confidence);

      if (!category || !Number.isFinite(confidence)) return null;
      return {
        category,
        confidence,
      };
    })
    .filter(Boolean)
    .slice(0, 5);
};

const inferMlAmbiguousFromRow = (row) => {
  if (!row || typeof row !== 'object') return false;

  const reviewPayload = parseJsonObject(row.review_payload, {});
  const normalizedPayload = parseJsonObject(row.normalized_payload, {});

  if (typeof reviewPayload.ml_ambiguous === 'boolean') return reviewPayload.ml_ambiguous;
  if (typeof normalizedPayload.ml_ambiguous === 'boolean') return normalizedPayload.ml_ambiguous;

  const marginCandidates = [
    reviewPayload.ml_margin,
    normalizedPayload.ml_margin,
  ];

  for (const candidate of marginCandidates) {
    const margin = Number(candidate);
    if (Number.isFinite(margin)) {
      return margin < AMBIGUITY_MARGIN;
    }
  }

  const predictions = safeTopPredictions(row.top_predictions);
  if (predictions.length > 1) {
    const gap = Number(predictions[0].confidence) - Number(predictions[1].confidence);
    if (Number.isFinite(gap)) return gap < AMBIGUITY_MARGIN;
  }

  return false;
};

const getForecastQualityFlags = ({ forecastHistory = null, forecast = null }) => {
  const historyFlags = forecastHistory?.history?.quality_flags || [];
  const forecastFlags = forecast?.reliability?.quality_flags || [];
  return uniqueNonEmpty([...historyFlags, ...forecastFlags]);
};

const callPersonalizedForecast = async ({
  userId,
  historyPayload,
  horizonMonths = 1,
  correlationId = null,
}) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/forecast/personalized`,
      {
        user_id: userId,
        horizon_months: horizonMonths,
        history_payload: historyPayload,
      },
      {
        timeout: 5000,
        headers: correlationId ? { 'x-correlation-id': correlationId } : undefined,
      }
    );

    return response.data || null;
  } catch (err) {
    console.warn('Advisor forecast context unavailable:', err.message);
    return null;
  }
};

const getMonthEndIsoDate = (year, month) => {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  const date = new Date(Date.UTC(year, month, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getAllTimeFinancialContext = async ({ userId, month, year }) => {
  const now = new Date();
  const referenceMonth = Number.isInteger(Number(month)) ? Number(month) : now.getMonth() + 1;
  const referenceYear = Number.isInteger(Number(year)) ? Number(year) : now.getFullYear();

  const [
    totalsResult,
    categoryTotalsResult,
    monthlyTrendResult,
    recurringMerchantsResult,
    budgetStatusResult,
    goalsResult,
    recentTransactionsResult,
  ] = await Promise.all([
    db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END), 0)::numeric AS income_total,
         COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END), 0)::numeric AS expense_total,
         COUNT(*)::int AS transaction_count,
         MIN(date) AS first_transaction_date,
         MAX(date) AS last_transaction_date
       FROM transactions
       WHERE user_id = $1
         AND amount > 0`,
      [userId]
    ),
    db.query(
      `SELECT
         c.name AS category,
         COALESCE(SUM(t.amount), 0)::numeric AS amount
       FROM transactions t
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = $1
         AND t.type = 'expense'
         AND t.status = 'completed'
         AND t.amount > 0
       GROUP BY c.name
       ORDER BY amount DESC
       LIMIT $2`,
      [userId, MAX_ALL_TIME_CATEGORY_ITEMS]
    ),
    db.query(
      `SELECT
         EXTRACT(YEAR FROM t.date)::int AS year,
         EXTRACT(MONTH FROM t.date)::int AS month,
         COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::numeric AS income_total,
         COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::numeric AS expense_total
       FROM transactions t
       WHERE t.user_id = $1
         AND t.status = 'completed'
         AND t.amount > 0
         AND t.type IN ('income', 'expense')
         AND t.date <= CURRENT_DATE
       GROUP BY EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
       ORDER BY year ASC, month ASC`,
      [userId]
    ),
    db.query(
      `SELECT
         t2.merchant AS merchant,
         COUNT(*)::int AS transaction_count,
         COALESCE(SUM(t2.amount), 0)::numeric AS total_spent,
         COALESCE(AVG(t2.amount), 0)::numeric AS average_amount,
         MAX(t2.date) AS last_seen
       FROM (
         SELECT
           t.amount,
           t.date,
           COALESCE(NULLIF(TRIM(t.merchant), ''), NULLIF(TRIM(t.description), '')) AS merchant
         FROM transactions t
         WHERE t.user_id = $1
           AND t.type = 'expense'
           AND t.status = 'completed'
           AND t.amount > 0
       ) t2
       WHERE t2.merchant IS NOT NULL
       GROUP BY t2.merchant
       HAVING COUNT(*) >= 2
       ORDER BY transaction_count DESC, total_spent DESC
       LIMIT $2`,
      [userId, MAX_RECURRING_MERCHANT_ITEMS]
    ),
    db.query(
      `SELECT
         b.budget_id,
         b.category_id,
         c.name AS category,
         b.month,
         b.year,
         b.monthly_limit,
         COALESCE(SUM(t.amount), 0)::numeric AS spent
       FROM budgets b
       JOIN categories c ON c.category_id = b.category_id
       LEFT JOIN transactions t
         ON t.user_id = b.user_id
        AND t.category_id = b.category_id
        AND t.type = 'expense'
        AND t.status = 'completed'
        AND EXTRACT(MONTH FROM t.date) = b.month
        AND EXTRACT(YEAR FROM t.date) = b.year
       WHERE b.user_id = $1
         AND b.month = $2
         AND b.year = $3
       GROUP BY b.budget_id, b.category_id, c.name, b.month, b.year, b.monthly_limit
       ORDER BY c.name ASC`,
      [userId, referenceMonth, referenceYear]
    ),
    db.query(
      `SELECT
         goal_id,
         title,
         target_amount,
         current_savings,
         deadline,
         status,
         created_at
       FROM goals
       WHERE user_id = $1
         AND status IN ('active', 'paused', 'completed')
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, MAX_ACTIVE_GOAL_ITEMS]
    ),
    db.query(
      `SELECT
         t.transaction_id,
         t.date,
         t.description,
         t.merchant,
         t.amount,
         t.type,
         t.status,
         c.name AS category
       FROM transactions t
       LEFT JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = $1
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $2`,
      [userId, MAX_RECENT_TRANSACTIONS_ITEMS]
    ),
  ]);

  const totals = totalsResult.rows[0] || {};
  const incomeTotal = toRounded(totals.income_total, 2);
  const expenseTotal = toRounded(totals.expense_total, 2);
  const netSavings = toRounded(incomeTotal - expenseTotal, 2);

  const monthlyTrend = monthlyTrendResult.rows
    .map((row) => {
      const income = toRounded(row.income_total, 2);
      const expenses = toRounded(row.expense_total, 2);
      const savings = toRounded(income - expenses, 2);
      const savingsRate = income > 0
        ? toRounded((savings / income) * 100, 2)
        : 0;

      return {
        year: Number(row.year),
        month: Number(row.month),
        year_month: `${row.year}-${String(row.month).padStart(2, '0')}`,
        income,
        expenses,
        savings,
        savings_rate: savingsRate,
      };
    })
    .filter((row) => Number.isInteger(row.year) && Number.isInteger(row.month));

  const boundedTrend = monthlyTrend.length > 36
    ? monthlyTrend.slice(monthlyTrend.length - 36)
    : monthlyTrend;

  const trendWithIncome = boundedTrend.filter((row) => row.income > 0);
  const avgSavingsRate = trendWithIncome.length > 0
    ? toRounded(
      trendWithIncome.reduce((sum, row) => sum + row.savings_rate, 0) / trendWithIncome.length,
      2
    )
    : 0;

  const avgMonthlySavings = boundedTrend.length > 0
    ? toRounded(
      boundedTrend.reduce((sum, row) => sum + row.savings, 0) / boundedTrend.length,
      2
    )
    : 0;

  const bestSavingsMonth = [...trendWithIncome]
    .sort((a, b) => b.savings_rate - a.savings_rate)[0] || null;

  const worstSavingsMonth = [...trendWithIncome]
    .sort((a, b) => a.savings_rate - b.savings_rate)[0] || null;

  const categoryTotals = categoryTotalsResult.rows.map((row) => ({
    category: row.category,
    amount: toRounded(row.amount, 2),
  }));

  const recurringMerchants = recurringMerchantsResult.rows.map((row) => ({
    merchant: toTrimmedString(row.merchant) || 'Unknown merchant',
    transaction_count: Number(row.transaction_count || 0),
    total_spent: toRounded(row.total_spent, 2),
    average_amount: toRounded(row.average_amount, 2),
    last_seen: row.last_seen || null,
  }));

  const budgetStatus = budgetStatusResult.rows.map((row) => {
    const limit = toRounded(row.monthly_limit, 2);
    const spent = toRounded(row.spent, 2);
    const utilizationPct = limit > 0 ? toRounded((spent / limit) * 100, 2) : 0;

    return {
      budget_id: Number(row.budget_id),
      category_id: Number(row.category_id),
      category: row.category,
      month: Number(row.month),
      year: Number(row.year),
      monthly_limit: limit,
      spent,
      remaining: toRounded(limit - spent, 2),
      utilization_pct: utilizationPct,
    };
  });

  const activeGoals = goalsResult.rows.map((row) => {
    const targetAmount = toRounded(row.target_amount, 2);
    const currentSavings = toRounded(row.current_savings, 2);
    const progressPct = targetAmount > 0
      ? toRounded((currentSavings / targetAmount) * 100, 2)
      : 0;

    return {
      goal_id: Number(row.goal_id),
      title: row.title,
      target_amount: targetAmount,
      current_savings: currentSavings,
      progress_pct: progressPct,
      deadline: row.deadline || null,
      status: row.status,
    };
  });

  const recentTransactions = recentTransactionsResult.rows.map((row) => ({
    transaction_id: Number(row.transaction_id),
    date: row.date,
    description: row.description,
    merchant: row.merchant,
    amount: toRounded(row.amount, 2),
    type: row.type,
    status: row.status,
    category: row.category || null,
  }));

  return {
    generated_at: new Date().toISOString(),
    lifetime_totals: {
      income: incomeTotal,
      expenses: expenseTotal,
      net_savings: netSavings,
      transaction_count: Number(totals.transaction_count || 0),
      first_transaction_date: totals.first_transaction_date || null,
      last_transaction_date: totals.last_transaction_date || null,
    },
    category_totals: categoryTotals,
    monthly_trend: boundedTrend,
    recurring_merchants: recurringMerchants,
    budget_status: {
      month: referenceMonth,
      year: referenceYear,
      items: budgetStatus,
    },
    active_goals: activeGoals,
    recent_transactions: recentTransactions,
    savings_patterns: {
      observed_months: boundedTrend.length,
      average_monthly_savings: avgMonthlySavings,
      average_savings_rate: avgSavingsRate,
      best_savings_month: bestSavingsMonth
        ? {
          year: bestSavingsMonth.year,
          month: bestSavingsMonth.month,
          savings_rate: bestSavingsMonth.savings_rate,
          savings: bestSavingsMonth.savings,
        }
        : null,
      worst_savings_month: worstSavingsMonth
        ? {
          year: worstSavingsMonth.year,
          month: worstSavingsMonth.month,
          savings_rate: worstSavingsMonth.savings_rate,
          savings: worstSavingsMonth.savings,
        }
        : null,
      projected_next_goal_milestone_date: bestSavingsMonth
        ? getMonthEndIsoDate(bestSavingsMonth.year, bestSavingsMonth.month)
        : null,
    },
  };
};

const buildConfirmedSignals = ({ analysis, anomalySummary, allTimeContext, generatedAt }) => {
  const signals = [];
  const currency = normalizeCurrency(analysis?.preferred_currency, 'USD');

  signals.push(
    createContextItem({
      id: 'confirmed_monthly_cashflow',
      kind: 'budget_metric',
      statement: `Recorded this month: income ${formatCurrency(analysis.income, currency)}, expenses ${formatCurrency(analysis.total_expenses, currency)}, savings ${formatCurrency(analysis.savings, currency)} (${analysis.savings_rate}%).`,
      value: {
        income: toRounded(analysis.income),
        total_expenses: toRounded(analysis.total_expenses),
        savings: toRounded(analysis.savings),
        savings_rate: toRounded(analysis.savings_rate),
      },
      confidence: 'high',
      provenance: {
        service: 'budgetService.analyzeSpending',
        method: 'deterministic_month_aggregation',
        as_of: generatedAt,
      },
      timeScope: 'current_month',
    })
  );

  const topCategory = Array.isArray(analysis.category_breakdown) && analysis.category_breakdown.length > 0
    ? analysis.category_breakdown[0]
    : null;

  if (topCategory) {
    signals.push(
      createContextItem({
        id: 'confirmed_top_expense_category',
        kind: 'budget_metric',
        statement: `Top expense category is ${topCategory.category} at ${formatCurrency(topCategory.amount, currency)}.`,
        value: {
          category: topCategory.category,
          amount: toRounded(topCategory.amount),
          percentage: Math.round(toNumber(topCategory.percentage) * 100),
        },
        confidence: 'high',
        provenance: {
          service: 'budgetService.analyzeSpending',
          method: 'category_aggregation',
          as_of: generatedAt,
        },
        timeScope: 'current_month',
      })
    );
  }

  if (toNumber(analysis.subscriptions_total) > 0) {
    signals.push(
      createContextItem({
        id: 'confirmed_recurring_subscription_spend',
        kind: 'recurring',
        statement: `Observed recurring subscription spend is ${formatCurrency(analysis.subscriptions_total, currency)} (${Math.round(toNumber(analysis.subscriptions_rate) * 100)}% of income).`,
        value: {
          subscriptions_total: toRounded(analysis.subscriptions_total),
          subscriptions_rate_percent: Math.round(toNumber(analysis.subscriptions_rate) * 100),
        },
        confidence: 'high',
        provenance: {
          service: 'budgetService.analyzeSpending',
          method: 'subscriptions_bucket_sum',
          as_of: generatedAt,
        },
        timeScope: 'current_month',
      })
    );
  }

  if (Array.isArray(analysis.overspending_flags) && analysis.overspending_flags.length > 0) {
    analysis.overspending_flags.slice(0, 3).forEach((flag, index) => {
      signals.push(
        createContextItem({
          id: `confirmed_overspending_${index + 1}`,
          kind: 'budget_metric',
          statement: flag.message,
          value: {
            rule: flag.rule,
            severity: flag.severity,
            amount: toRounded(flag.amount),
          },
          confidence: flag.severity === 'critical' ? 'high' : 'medium',
          provenance: {
            service: 'budgetService.generateSuggestions',
            method: 'rule_engine_50_30_20',
            as_of: generatedAt,
          },
          timeScope: 'current_month',
        })
      );
    });
  }

  if (toNumber(anomalySummary?.total_active) > 0) {
    signals.push(
      createContextItem({
        id: 'confirmed_anomaly_active_counts',
        kind: 'anomaly',
        statement: `Active anomaly signals this month: ${anomalySummary.total_active} (high: ${anomalySummary.high_count}, medium: ${anomalySummary.medium_count}, low: ${anomalySummary.low_count}).`,
        value: {
          total_active: toNumber(anomalySummary.total_active),
          high_count: toNumber(anomalySummary.high_count),
          medium_count: toNumber(anomalySummary.medium_count),
          low_count: toNumber(anomalySummary.low_count),
        },
        confidence: 'medium',
        provenance: {
          service: 'anomalyOrchestrator.getDashboardAnomalySummary',
          method: 'phase6_rule_engine_summary',
          as_of: generatedAt,
        },
        timeScope: 'current_month',
      })
    );
  }

  const recurringAnomaly = Array.isArray(anomalySummary?.highlights)
    ? anomalySummary.highlights.find((item) => item?.anomaly_type === 'recurring_amount_drift')
    : null;

  if (recurringAnomaly) {
    signals.push(
      createContextItem({
        id: `confirmed_recurring_anomaly_${recurringAnomaly.anomaly_id}`,
        kind: 'recurring',
        statement: recurringAnomaly.explanation || recurringAnomaly.title,
        value: {
          anomaly_id: recurringAnomaly.anomaly_id,
          severity: recurringAnomaly.severity,
          evidence: recurringAnomaly.evidence || {},
        },
        confidence: severityToConfidence(recurringAnomaly.severity),
        provenance: {
          service: 'anomalyRepository.highlights',
          method: 'anomaly_persistence_read',
          as_of: generatedAt,
        },
        timeScope: 'current_month',
      })
    );
  }

  const lifetimeTotals = allTimeContext?.lifetime_totals || null;
  if (lifetimeTotals && Number(lifetimeTotals.transaction_count || 0) > 0) {
    signals.push(
      createContextItem({
        id: 'confirmed_lifetime_totals',
        kind: 'budget_metric',
        statement: `All-time completed transactions show income ${formatCurrency(lifetimeTotals.income, currency)} and expenses ${formatCurrency(lifetimeTotals.expenses, currency)} (net savings ${formatCurrency(lifetimeTotals.net_savings, currency)}).`,
        value: lifetimeTotals,
        confidence: 'high',
        provenance: {
          service: 'advisorService.getAllTimeFinancialContext',
          method: 'lifetime_transaction_aggregation',
          as_of: generatedAt,
        },
        timeScope: 'all_time',
      })
    );
  }

  if (Array.isArray(allTimeContext?.category_totals) && allTimeContext.category_totals.length > 0) {
    const topLifetimeCategory = allTimeContext.category_totals[0];

    signals.push(
      createContextItem({
        id: 'confirmed_lifetime_top_expense_category',
        kind: 'budget_metric',
        statement: `Highest all-time expense category is ${topLifetimeCategory.category} at ${formatCurrency(topLifetimeCategory.amount, currency)}.`,
        value: {
          category: topLifetimeCategory.category,
          amount: topLifetimeCategory.amount,
        },
        confidence: 'high',
        provenance: {
          service: 'advisorService.getAllTimeFinancialContext',
          method: 'lifetime_category_totals',
          as_of: generatedAt,
        },
        timeScope: 'all_time',
      })
    );
  }

  if (Array.isArray(allTimeContext?.recurring_merchants) && allTimeContext.recurring_merchants.length > 0) {
    const topRecurringMerchant = allTimeContext.recurring_merchants[0];

    signals.push(
      createContextItem({
        id: 'confirmed_top_recurring_merchant',
        kind: 'recurring',
        statement: `Most frequent recurring merchant is ${topRecurringMerchant.merchant} (${topRecurringMerchant.transaction_count} transactions totaling ${formatCurrency(topRecurringMerchant.total_spent, currency)}).`,
        value: topRecurringMerchant,
        confidence: 'high',
        provenance: {
          service: 'advisorService.getAllTimeFinancialContext',
          method: 'merchant_frequency_summary',
          as_of: generatedAt,
        },
        timeScope: 'all_time',
      })
    );
  }

  if (Array.isArray(allTimeContext?.active_goals) && allTimeContext.active_goals.length > 0) {
    const nearestGoal = allTimeContext.active_goals[0];

    signals.push(
      createContextItem({
        id: `confirmed_active_goal_${nearestGoal.goal_id}`,
        kind: 'goal',
        statement: `Active goal "${nearestGoal.title}" is ${toRounded(nearestGoal.progress_pct)}% funded (${formatCurrency(nearestGoal.current_savings, currency)} / ${formatCurrency(nearestGoal.target_amount, currency)}).`,
        value: nearestGoal,
        confidence: 'high',
        provenance: {
          service: 'advisorService.getAllTimeFinancialContext',
          method: 'goals_snapshot',
          as_of: generatedAt,
        },
        timeScope: 'all_time',
      })
    );
  }

  return signals.slice(0, MAX_ITEMS_PER_BAND);
};

const buildPredictedSignals = ({ forecast, generatedAt, currency = 'USD' }) => {
  if (!forecast || typeof forecast !== 'object') return [];

  const signals = [];
  const resolvedCurrency = normalizeCurrency(currency, 'USD');

  const topProjection = Array.isArray(forecast.projections) && forecast.projections.length > 0
    ? forecast.projections[0]
    : {
      month: forecast.month,
      year: forecast.year,
      predicted_total_expenses: forecast.predicted_total_expenses,
      predicted_total_savings: forecast.predicted_total_savings,
      savings_rate: forecast.savings_rate,
    };

  const confidence = mapForecastConfidence(forecast?.reliability?.confidence_level);

  signals.push(
    createContextItem({
      id: 'predicted_next_month_cashflow',
      kind: 'forecast',
      statement: `Forecast suggests next month (${topProjection.month}/${topProjection.year}) expenses near ${formatCurrency(topProjection.predicted_total_expenses, resolvedCurrency)} with projected savings ${formatCurrency(topProjection.predicted_total_savings, resolvedCurrency)} (${toRounded(topProjection.savings_rate)}%).`,
      value: {
        month: Number(topProjection.month) || null,
        year: Number(topProjection.year) || null,
        predicted_total_expenses: toRounded(topProjection.predicted_total_expenses),
        predicted_total_savings: toRounded(topProjection.predicted_total_savings),
        savings_rate: toRounded(topProjection.savings_rate),
      },
      confidence,
      provenance: {
        service: 'ml.forecast.personalized',
        method: toTrimmedString(forecast.method) || 'personalized_weighted_trend',
        as_of: generatedAt,
        quality_flags: forecast?.reliability?.quality_flags || [],
      },
      timeScope: 'next_month',
    })
  );

  if (Array.isArray(forecast.category_outlook) && forecast.category_outlook.length > 0) {
    forecast.category_outlook.slice(0, 2).forEach((item, index) => {
      signals.push(
        createContextItem({
          id: `predicted_category_outlook_${index + 1}`,
          kind: 'forecast',
          statement: `Projected spend pressure may stay elevated in ${item.category} at about ${formatCurrency(item.predicted_amount, resolvedCurrency)} next month.`,
          value: {
            category: item.category,
            predicted_amount: toRounded(item.predicted_amount),
          },
          confidence,
          provenance: {
            service: 'ml.forecast.personalized',
            method: 'category_outlook_projection',
            as_of: generatedAt,
            quality_flags: forecast?.reliability?.quality_flags || [],
          },
          timeScope: 'next_month',
        })
      );
    });
  }

  return signals.slice(0, MAX_ITEMS_PER_BAND);
};

const buildForecastUncertainSignals = ({ forecastHistory, forecast, generatedAt }) => {
  const qualityFlags = getForecastQualityFlags({ forecastHistory, forecast });
  if (qualityFlags.length === 0) return [];

  const uncertain = [];

  if (qualityFlags.includes('no_observed_history')) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_forecast_no_history',
        kind: 'forecast',
        statement: 'Forecast confidence is limited because there is no observed completed-month history yet.',
        value: { quality_flag: 'no_observed_history' },
        confidence: 'low',
        provenance: {
          service: 'forecastHistoryService.getForecastHistoryForUser',
          method: 'history_quality_flags',
          as_of: generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'rolling_18m',
      })
    );
  }

  if (qualityFlags.includes('sparse_history')) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_forecast_sparse_history',
        kind: 'forecast',
        statement: 'Forecast uses sparse historical data (fewer than 3 observed months), so projected changes are tentative.',
        value: { quality_flag: 'sparse_history' },
        confidence: 'low',
        provenance: {
          service: 'forecastHistoryService.getForecastHistoryForUser',
          method: 'history_quality_flags',
          as_of: generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'rolling_18m',
      })
    );
  }

  if (qualityFlags.includes('profile_income_fallback_used')) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_forecast_income_fallback',
        kind: 'forecast',
        statement: 'Some months relied on profile income fallback instead of observed income transactions, reducing forecast certainty.',
        value: {
          quality_flag: 'profile_income_fallback_used',
          months_with_profile_income_fallback:
            forecastHistory?.history?.months_with_profile_income_fallback || [],
        },
        confidence: 'medium',
        provenance: {
          service: 'forecastHistoryService.getForecastHistoryForUser',
          method: 'income_fallback_detection',
          as_of: generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'rolling_18m',
      })
    );
  }

  if (qualityFlags.includes('pending_heavy_dataset')) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_forecast_pending_heavy',
        kind: 'forecast',
        statement: 'A pending-heavy transaction dataset may delay stable spending patterns in the forecast context.',
        value: { quality_flag: 'pending_heavy_dataset' },
        confidence: 'medium',
        provenance: {
          service: 'forecastHistoryService.getForecastHistoryForUser',
          method: 'status_distribution_check',
          as_of: generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'rolling_18m',
      })
    );
  }

  const fallbackMode = toTrimmedString(forecast?.reliability?.fallback_mode);
  if (fallbackMode) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_forecast_fallback_mode',
        kind: 'forecast',
        statement: `Forecast currently runs in fallback mode (${fallbackMode}), so directional guidance should be treated as approximate.`,
        value: { fallback_mode: fallbackMode },
        confidence: fallbackMode === 'none' ? 'medium' : 'low',
        provenance: {
          service: 'ml.forecast.personalized',
          method: 'reliability.fallback_mode',
          as_of: generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'next_month',
      })
    );
  }

  return uncertain.slice(0, MAX_ITEMS_PER_BAND);
};

const buildImportUncertainSignals = ({ importSnapshot, generatedAt }) => {
  if (!importSnapshot || !importSnapshot.session) return [];

  const session = importSnapshot.session;
  const rows = Array.isArray(importSnapshot.rows) ? importSnapshot.rows : [];
  const includedRows = rows.filter((row) => !Boolean(row?.is_excluded));

  const needsReviewCount = includedRows.filter((row) => Boolean(row?.needs_review)).length;
  const lowExtractionCount = includedRows.filter((row) => {
    const confidence = Number(row?.extraction_confidence);
    return Number.isFinite(confidence) && confidence > 0 && confidence < 0.6;
  }).length;
  const probableDuplicateCount = includedRows.filter((row) => row?.dedupe_status === 'probable_duplicate').length;
  const ambiguousMlCount = includedRows.filter((row) => inferMlAmbiguousFromRow(row)).length;

  const summary = parseJsonObject(session.summary, {});
  const warnings = parseJsonArray(session.warnings);

  const qualityFlags = [];
  if (needsReviewCount > 0) qualityFlags.push('import_rows_need_review');
  if (lowExtractionCount > 0) qualityFlags.push('low_extraction_confidence_rows');
  if (probableDuplicateCount > 0) qualityFlags.push('probable_duplicates_present');
  if (ambiguousMlCount > 0) qualityFlags.push('ambiguous_ml_predictions');
  if (warnings.length > 0) qualityFlags.push('import_session_warnings');

  if (qualityFlags.length === 0) return [];

  const uncertain = [];

  if (needsReviewCount > 0) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_import_needs_review',
        kind: 'import_finding',
        statement: `${needsReviewCount} recent import row(s) remain marked for review, so inferred patterns from that batch may be incomplete.`,
        value: {
          needs_review_rows: needsReviewCount,
          included_rows: Number(summary.included_rows || includedRows.length || 0),
        },
        confidence: 'low',
        provenance: {
          service: 'import.sessionService.getLatestImportSessionSnapshotForUser',
          method: 'session_row_flags',
          as_of: session.updated_at || session.created_at || generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'latest_import_session',
      })
    );
  }

  if (lowExtractionCount > 0) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_import_extraction_confidence',
        kind: 'import_finding',
        statement: `${lowExtractionCount} recent import row(s) have low extraction confidence (< 0.60).`,
        value: {
          low_extraction_rows: lowExtractionCount,
        },
        confidence: 'low',
        provenance: {
          service: 'import.sessionService.getLatestImportSessionSnapshotForUser',
          method: 'extraction_confidence_distribution',
          as_of: session.updated_at || session.created_at || generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'latest_import_session',
      })
    );
  }

  if (ambiguousMlCount > 0) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_import_ml_ambiguity',
        kind: 'import_finding',
        statement: `${ambiguousMlCount} recent import row(s) have ambiguous ML categorization margins.`,
        value: {
          ambiguous_ml_rows: ambiguousMlCount,
          ambiguity_margin: AMBIGUITY_MARGIN,
        },
        confidence: 'medium',
        provenance: {
          service: 'importPipeline.confirmImportSession',
          method: 'ml_margin_or_flag',
          as_of: session.updated_at || session.created_at || generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'latest_import_session',
      })
    );
  }

  if (probableDuplicateCount > 0) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_import_probable_duplicates',
        kind: 'import_finding',
        statement: `${probableDuplicateCount} recent import row(s) were marked as probable duplicates during review.`,
        value: {
          probable_duplicate_rows: probableDuplicateCount,
        },
        confidence: 'medium',
        provenance: {
          service: 'import.dedupeService',
          method: 'probable_duplicate_annotation',
          as_of: session.updated_at || session.created_at || generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'latest_import_session',
      })
    );
  }

  if (warnings.length > 0) {
    uncertain.push(
      createContextItem({
        id: 'uncertain_import_session_warnings',
        kind: 'import_finding',
        statement: `Latest import session reported warnings (${warnings.slice(0, 2).join(' | ')}).`,
        value: {
          warnings: warnings.slice(0, 5),
          state: session.state,
          session_id: session.import_session_id,
        },
        confidence: 'medium',
        provenance: {
          service: 'import.sessionService',
          method: 'session_warning_log',
          as_of: session.updated_at || session.created_at || generatedAt,
          quality_flags: qualityFlags,
        },
        timeScope: 'latest_import_session',
      })
    );
  }

  return uncertain.slice(0, MAX_ITEMS_PER_BAND);
};

const buildStructuredContext = ({
  analysis,
  anomalySummary,
  forecastHistory,
  forecast,
  importSnapshot,
  allTimeContext,
  generatedAt,
  sourceAvailability,
  currency = 'USD',
}) => {
  const confirmed = buildConfirmedSignals({
    analysis,
    anomalySummary,
    allTimeContext,
    generatedAt,
  });

  const predicted = buildPredictedSignals({
    forecast,
    generatedAt,
    currency,
  });

  const uncertain = [
    ...buildForecastUncertainSignals({
      forecastHistory,
      forecast,
      generatedAt,
    }),
    ...buildImportUncertainSignals({
      importSnapshot,
      generatedAt,
    }),
  ].slice(0, MAX_ITEMS_PER_BAND);

  const qualityFlags = uniqueNonEmpty([
    ...getForecastQualityFlags({ forecastHistory, forecast }),
    ...uncertain.flatMap((item) => item?.provenance?.quality_flags || []),
    sourceAvailability?.forecast_available ? [] : ['forecast_unavailable'],
    sourceAvailability?.anomaly_summary_available ? [] : ['anomaly_summary_unavailable'],
    sourceAvailability?.forecast_history_available ? [] : ['forecast_history_unavailable'],
  ]);

  return {
    confirmed,
    predicted,
    uncertain,
    meta: {
      generated_at: generatedAt,
      confirmed_count: confirmed.length,
      predicted_count: predicted.length,
      uncertain_count: uncertain.length,
      quality_flags: qualityFlags,
      sources: {
        anomaly_summary_available: sourceAvailability?.anomaly_summary_available ?? Boolean(anomalySummary),
        forecast_available: sourceAvailability?.forecast_available ?? Boolean(forecast),
        forecast_history_available: sourceAvailability?.forecast_history_available ?? Boolean(forecastHistory),
        latest_import_session_id: importSnapshot?.session?.import_session_id || null,
      },
    },
  };
};

const getUserSummary = async (userId, month, year, existingAnalysis = null, options = {}) => {
  const startedAt = Date.now();
  const correlationId = toTrimmedString(options?.correlationId) || makeCorrelationId();

  const analysis = existingAnalysis || await budgetService.analyzeSpending(userId, month, year);
  const generatedAt = new Date().toISOString();

  const [
    forecastHistoryResult,
    anomalySummaryResult,
    importSnapshotResult,
    allTimeContextResult,
  ] = await Promise.allSettled([
    getForecastHistoryForUser({ userId, monthsBack: 18 }),
    getDashboardAnomalySummary({
      userId,
      month: analysis.month,
      year: analysis.year,
      highlightLimit: 5,
      currency: analysis.preferred_currency,
    }),
    getLatestImportSessionSnapshotForUser({ userId, rowLimit: MAX_IMPORT_ROWS_FOR_CONTEXT }),
    getAllTimeFinancialContext({
      userId,
      month: analysis.month,
      year: analysis.year,
    }),
  ]);

  const forecastHistory = forecastHistoryResult.status === 'fulfilled'
    ? forecastHistoryResult.value
    : null;

  if (forecastHistoryResult.status === 'rejected') {
    console.warn('Advisor forecast history context unavailable:', forecastHistoryResult.reason?.message || 'unknown error');
  }

  const anomalySummary = anomalySummaryResult.status === 'fulfilled'
    ? anomalySummaryResult.value
    : EMPTY_ANOMALY_SUMMARY;

  if (anomalySummaryResult.status === 'rejected') {
    console.warn('Advisor anomaly context unavailable:', anomalySummaryResult.reason?.message || 'unknown error');
  }

  const importSnapshot = importSnapshotResult.status === 'fulfilled'
    ? importSnapshotResult.value
    : null;

  if (importSnapshotResult.status === 'rejected') {
    console.warn('Advisor import context unavailable:', importSnapshotResult.reason?.message || 'unknown error');
  }

  const allTimeContext = allTimeContextResult.status === 'fulfilled'
    ? allTimeContextResult.value
    : {
      generated_at: generatedAt,
      lifetime_totals: {
        income: 0,
        expenses: 0,
        net_savings: 0,
        transaction_count: 0,
        first_transaction_date: null,
        last_transaction_date: null,
      },
      category_totals: [],
      monthly_trend: [],
      recurring_merchants: [],
      budget_status: {
        month: analysis.month,
        year: analysis.year,
        items: [],
      },
      active_goals: [],
      recent_transactions: [],
      savings_patterns: {
        observed_months: 0,
        average_monthly_savings: 0,
        average_savings_rate: 0,
        best_savings_month: null,
        worst_savings_month: null,
        projected_next_goal_milestone_date: null,
      },
    };

  if (allTimeContextResult.status === 'rejected') {
    console.warn('Advisor all-time financial context unavailable:', allTimeContextResult.reason?.message || 'unknown error');
  }

  let forecast = null;
  if (forecastHistory) {
    forecast = await callPersonalizedForecast({
      userId,
      historyPayload: forecastHistory,
      horizonMonths: 1,
      correlationId,
    });
  }

  if (!forecast) {
    logServiceEvent({
      service: 'advisor.summary',
      operation: 'load_forecast_context',
      status: 'degraded',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      details: {
        month,
        year,
        forecast_history_available: Boolean(forecastHistory),
      },
    });
  }

  const currency = normalizeCurrency(analysis?.preferred_currency, 'USD');

  const structuredContext = buildStructuredContext({
    analysis,
    anomalySummary,
    forecastHistory,
    forecast,
    importSnapshot,
    allTimeContext,
    generatedAt,
    sourceAvailability: {
      anomaly_summary_available: anomalySummaryResult.status === 'fulfilled',
      forecast_history_available: forecastHistoryResult.status === 'fulfilled',
      forecast_available: Boolean(forecast),
    },
    currency,
  });

  const payload = {
    user_id: userId,
    month: analysis.month,
    year: analysis.year,
    monthly_income: Number(analysis.monthly_income || 0),
    city: analysis.city || null,
    occupation: analysis.occupation || null,
    preferred_currency: normalizeCurrency(analysis?.preferred_currency, 'USD'),
    income: Number(analysis.income || 0),
    total_expenses: Number(analysis.total_expenses || 0),
    savings: Number(analysis.savings || 0),
    savings_rate: Number(analysis.savings_rate || 0),
    category_breakdown: analysis.category_breakdown || [],
    overspending_flags: analysis.overspending_flags || [],
    recent_transactions: analysis.recent_transactions || [],
    all_time_context: allTimeContext,
    forecast: forecast || null,
    forecast_reliability: forecast?.reliability || null,
    anomaly_summary: anomalySummary || EMPTY_ANOMALY_SUMMARY,
    structured_context: structuredContext,
  };

  logServiceEvent({
    service: 'advisor.summary',
    operation: 'get_user_summary',
    status: 'ok',
    userId,
    latencyMs: Date.now() - startedAt,
    fallbackUsed: !forecast || anomalySummaryResult.status === 'rejected' || forecastHistoryResult.status === 'rejected',
    requestLike: { correlationId },
    details: {
      month: analysis.month,
      year: analysis.year,
      forecast_available: Boolean(forecast),
      anomaly_summary_available: anomalySummaryResult.status === 'fulfilled',
      forecast_history_available: forecastHistoryResult.status === 'fulfilled',
      import_snapshot_available: importSnapshotResult.status === 'fulfilled',
      all_time_context_available: allTimeContextResult.status === 'fulfilled',
      all_time_trend_months: Array.isArray(allTimeContext?.monthly_trend) ? allTimeContext.monthly_trend.length : 0,
      confirmed_count: Number(structuredContext?.meta?.confirmed_count || 0),
      predicted_count: Number(structuredContext?.meta?.predicted_count || 0),
      uncertain_count: Number(structuredContext?.meta?.uncertain_count || 0),
    },
  });

  return payload;
};

const formatStructuredItemsForPrompt = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '- None';
  }

  return items
    .slice(0, MAX_ITEMS_PER_PROMPT_SECTION)
    .map((item) => {
      const source = toTrimmedString(item?.provenance?.service) || 'unknown_source';
      const method = toTrimmedString(item?.provenance?.method);
      const scope = toTrimmedString(item?.time_scope);
      const qualityFlags = Array.isArray(item?.provenance?.quality_flags)
        ? item.provenance.quality_flags.filter(Boolean)
        : [];

      const tags = [
        `confidence: ${toConfidenceBucket(item?.confidence)}`,
        `source: ${source}`,
      ];

      if (method) tags.push(`method: ${method}`);
      if (scope) tags.push(`scope: ${scope}`);
      if (qualityFlags.length > 0) tags.push(`quality: ${qualityFlags.join(', ')}`);

      return `- ${item.statement} (${tags.join('; ')})`;
    })
    .join('\n');
};

const buildPrompt = (summary, userMessage) => {
  const structuredContext = summary?.structured_context || {
    confirmed: [],
    predicted: [],
    uncertain: [],
    meta: {},
  };
  const currency = normalizeCurrency(summary?.preferred_currency, 'USD');

  const actionInstruction = `When a user clearly asks to create or update a budget or goal, include exactly one action proposal line at the end using this exact marker: ${ACTION_PROPOSAL_PROMPT_KEY}{"type":"create_budget|update_budget|create_goal|update_goal","payload":{...},"confirmation_summary":"..."}.
If no actionable request exists, output ${ACTION_PROPOSAL_PROMPT_KEY}null.`;

  const systemPrompt = `You are a personal finance advisor.
All amounts are in ${currency}.
Prioritize recommendations grounded in confirmed facts.
Treat predicted outlook as probabilistic and uncertain signals as tentative.
Never present predicted or uncertain signals as guaranteed outcomes.
When confidence is medium or low, explicitly explain why and cite the source in plain language.
If uncertain signals dominate, ask one clarifying follow-up before high-commitment advice.
Keep the response under 150 words unless the user asks for more detail.
${actionInstruction}`;

  const allTimeContext = summary?.all_time_context || {};
  const allTimeLifetime = allTimeContext?.lifetime_totals || {};
  const topAllTimeCategories = Array.isArray(allTimeContext?.category_totals)
    ? allTimeContext.category_totals.slice(0, MAX_PROMPT_TREND_ITEMS)
    : [];
  const topRecurringMerchants = Array.isArray(allTimeContext?.recurring_merchants)
    ? allTimeContext.recurring_merchants.slice(0, MAX_PROMPT_TREND_ITEMS)
    : [];
  const budgetStatusRows = Array.isArray(allTimeContext?.budget_status?.items)
    ? allTimeContext.budget_status.items.slice(0, MAX_PROMPT_TREND_ITEMS)
    : [];
  const activeGoals = Array.isArray(allTimeContext?.active_goals)
    ? allTimeContext.active_goals.slice(0, MAX_PROMPT_TREND_ITEMS)
    : [];
  const trendRows = Array.isArray(allTimeContext?.monthly_trend)
    ? allTimeContext.monthly_trend.slice(-MAX_PROMPT_TREND_ITEMS)
    : [];

  const topCategoriesText = topAllTimeCategories.length > 0
    ? topAllTimeCategories
      .map((item) => `- ${item.category}: ${formatCurrency(item.amount, currency)}`)
      .join('\n')
    : '- None';

  const recurringMerchantText = topRecurringMerchants.length > 0
    ? topRecurringMerchants
      .map((item) => `- ${item.merchant}: ${item.transaction_count} txns, total ${formatCurrency(item.total_spent, currency)}, avg ${formatCurrency(item.average_amount, currency)}`)
      .join('\n')
    : '- None';

  const budgetStatusText = budgetStatusRows.length > 0
    ? budgetStatusRows
      .map((item) => `- ${item.category}: limit ${formatCurrency(item.monthly_limit, currency)}, spent ${formatCurrency(item.spent, currency)}, utilization ${toRounded(item.utilization_pct)}%`)
      .join('\n')
    : '- None';

  const activeGoalsText = activeGoals.length > 0
    ? activeGoals
      .map((item) => `- ${item.title}: ${formatCurrency(item.current_savings, currency)} / ${formatCurrency(item.target_amount, currency)} (${toRounded(item.progress_pct)}%)`)
      .join('\n')
    : '- None';

  const trendText = trendRows.length > 0
    ? trendRows
      .map((item) => `- ${item.year_month}: income ${formatCurrency(item.income, currency)}, expenses ${formatCurrency(item.expenses, currency)}, savings ${formatCurrency(item.savings, currency)} (${toRounded(item.savings_rate)}%)`)
      .join('\n')
    : '- None';

  const userPrompt = `User profile:
- City: ${summary.city || 'Not provided'}
- Occupation: ${summary.occupation || 'Not provided'}
- Monthly profile income: ${formatCurrency(summary.monthly_income, currency)}

Financial summary for ${summary.month}/${summary.year}:
- Income: ${formatCurrency(summary.income, currency)}
- Total expenses: ${formatCurrency(summary.total_expenses, currency)}
- Savings: ${formatCurrency(summary.savings, currency)} (${summary.savings_rate}%)

Spending breakdown:
${formatCategoryBreakdown(summary.category_breakdown, currency)}

Overspending flags:
${formatOverspendingFlags(summary.overspending_flags)}

All-time financial history:
- Lifetime income: ${formatCurrency(allTimeLifetime.income, currency)}
- Lifetime expenses: ${formatCurrency(allTimeLifetime.expenses, currency)}
- Lifetime net savings: ${formatCurrency(allTimeLifetime.net_savings, currency)}
- Completed transaction count: ${Number(allTimeLifetime.transaction_count || 0)}
- History range: ${allTimeLifetime.first_transaction_date || 'N/A'} to ${allTimeLifetime.last_transaction_date || 'N/A'}

All-time top spending categories:
${topCategoriesText}

Recent monthly trend snapshots:
${trendText}

Recurring merchants/payments:
${recurringMerchantText}

Current budget status (${allTimeContext?.budget_status?.month || summary.month}/${allTimeContext?.budget_status?.year || summary.year}):
${budgetStatusText}

Active goals:
${activeGoalsText}

Confirmed facts:
${formatStructuredItemsForPrompt(structuredContext.confirmed)}

Predicted outlook:
${formatStructuredItemsForPrompt(structuredContext.predicted)}

Uncertain signals:
${formatStructuredItemsForPrompt(structuredContext.uncertain)}

Context quality flags:
- ${Array.isArray(structuredContext?.meta?.quality_flags) && structuredContext.meta.quality_flags.length > 0
    ? structuredContext.meta.quality_flags.join(', ')
    : 'None'}

User question:
${userMessage}`;

  return { systemPrompt, userPrompt };
};

const extractTextFromContentValue = (content) => {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part.trim();
        if (typeof part?.text === 'string') return part.text.trim();
        if (typeof part?.content === 'string') return part.content.trim();
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text.trim();
    if (typeof content.content === 'string') return content.content.trim();
  }

  return '';
};

const extractAssistantReply = (data) => {
  const directContent = extractTextFromContentValue(data?.content);
  if (directContent) return directContent;

  const directText = toTrimmedString(data?.text)
    || toTrimmedString(data?.output_text);
  if (directText) return directText;

  const choices = Array.isArray(data?.choices) ? data.choices : [];
  const textParts = choices
    .map((choice) => {
      const choiceText = toTrimmedString(choice?.text);
      if (choiceText) return choiceText;

      const message = choice?.message;
      const messageContent = extractTextFromContentValue(message?.content);
      if (messageContent) return messageContent;

      const messageText = toTrimmedString(message?.text)
        || toTrimmedString(message?.output_text)
        || toTrimmedString(message?.reasoning_content);
      if (messageText) return messageText;

      const deltaContent = extractTextFromContentValue(choice?.delta?.content);
      if (deltaContent) return deltaContent;

      return '';
    })
    .filter(Boolean);

  if (textParts.length > 0) {
    return textParts.join('\n').trim();
  }

  return '';
};

const buildEcomAgentPayload = ({ systemPrompt, userPrompt, model }) => ({
  model,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  temperature: 0.4,
  max_tokens: 600,
});

const callEcomAgentModel = async ({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  correlationId = null,
}) => {
  const endpoint = `${baseUrl}/chat/completions`;

  const response = await axios.post(
    endpoint,
    buildEcomAgentPayload({
      systemPrompt,
      userPrompt,
      model,
    }),
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
      },
      timeout: 60000,
    }
  );

  return extractAssistantReply(response.data);
};

const callLLM = async ({ systemPrompt, userPrompt }, options = {}) => {
  const startedAt = Date.now();
  const correlationId = toTrimmedString(options?.correlationId) || makeCorrelationId();
  const userId = Number.isInteger(Number(options?.userId)) ? Number(options.userId) : null;
  const channel = toTrimmedString(options?.channel) || 'unknown';

  const apiKey = toTrimmedString(process.env.ECOMAGENT_API_KEY);
  if (!apiKey) {
    const err = new Error('LLM service unavailable: ECOMAGENT_API_KEY is not configured');
    err.statusCode = 503;

    logServiceEvent({
      service: 'advisor.llm',
      operation: 'call_llm',
      status: 'error',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        channel,
        stage: 'missing_api_key',
        provider: 'ecomagent',
      },
    });

    throw err;
  }

  const baseUrl = ECOMAGENT_API_BASE_URL;
  const primaryModel = toTrimmedString(process.env.ECOMAGENT_MODEL) || ECOMAGENT_DEFAULT_MODEL;
  const fallbackModel = ECOMAGENT_FALLBACK_MODEL;

  const devLog = (msg) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[advisor dev] ${msg}`);
    }
  };

  try {
    let reply = await callEcomAgentModel({
      baseUrl,
      apiKey,
      model: primaryModel,
      systemPrompt,
      userPrompt,
      correlationId,
    });

    let usedFallbackModel = false;

    if (!isValidModelReply(reply) && fallbackModel && fallbackModel !== primaryModel) {
      devLog(`Primary model "${primaryModel}" returned invalid reply (first 100: "${(reply || '').slice(0, 100).replace(/\n/g, '\\n')}"). Retrying with fallback model "${fallbackModel}".`);

      reply = await callEcomAgentModel({
        baseUrl,
        apiKey,
        model: fallbackModel,
        systemPrompt,
        userPrompt,
        correlationId,
      });

      if (isValidModelReply(reply)) {
        usedFallbackModel = true;
      }
    }

    if (!isValidModelReply(reply)) {
      devLog(`Both models returned invalid or empty replies. Using deterministic fallback. Primary: "${(reply || '').slice(0, 100).replace(/\n/g, '\\n')}".`);
      reply = EMPTY_LLM_FALLBACK_REPLY;
    }

    devLog(`Final reply — chars: ${reply.length}, first 100: "${reply.slice(0, 100).replace(/\n/g, '\\n')}"`);

    logServiceEvent({
      service: 'advisor.llm',
      operation: 'call_llm',
      status: 'ok',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: usedFallbackModel,
      requestLike: { correlationId },
      details: {
        channel,
        provider: 'ecomagent',
        endpoint: `${baseUrl}/chat/completions`,
        model: usedFallbackModel ? fallbackModel : primaryModel,
        primary_model: primaryModel,
        fallback_model: fallbackModel,
        used_fallback_model: usedFallbackModel,
      },
    });

    return reply;
  } catch (err) {
    if (err.statusCode) {
      logServiceEvent({
        service: 'advisor.llm',
        operation: 'call_llm',
        status: 'error',
        userId,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: true,
        requestLike: { correlationId },
        error: err,
        details: {
          channel,
          provider: 'ecomagent',
          model: primaryModel,
          fallback_model: fallbackModel,
          used_fallback_model: false,
        },
      });

      throw err;
    }

    const providerMessage = err.response?.data?.error?.message
      || err.response?.data?.error
      || err.response?.data?.message
      || err.message;

    const wrapped = new Error(`LLM service unavailable: ${providerMessage}`);
    wrapped.statusCode = 503;

    logServiceEvent({
      service: 'advisor.llm',
      operation: 'call_llm',
      status: 'error',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: wrapped,
      details: {
        channel,
        provider: 'ecomagent',
        endpoint: `${baseUrl}/chat/completions`,
        model: primaryModel,
        primary_model: primaryModel,
        fallback_model: fallbackModel,
        used_fallback_model: false,
      },
    });

    throw wrapped;
  }
};

const logInteraction = async (userId, inputText, responseText, channel = 'text') => {
  const result = await db.query(
    `INSERT INTO ai_logs (user_id, input_text, response_text, channel)
     VALUES ($1, $2, $3, $4)
     RETURNING log_id, user_id, input_text, response_text, channel, created_at`,
    [userId, inputText, responseText, channel]
  );

  return result.rows[0];
};

module.exports = {
  getUserSummary,
  buildPrompt,
  callLLM,
  logInteraction,
};