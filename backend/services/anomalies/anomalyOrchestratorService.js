const db = require('../../db/db');
const { annotateRowDedupe } = require('../import/dedupeService');
const {
  getUserAmountBaseline,
  getCategoryAmountBaseline,
  getMerchantHistory,
  getRecurringMerchantBaseline,
  getMonthlyTotalsWindow,
  getCategoryMonthlyBaseline,
} = require('./anomalyBaselineService');
const { evaluateTransactionAnomalies, evaluateMonthlyAnomalies } = require('./anomalyRuleEngine');
const { buildAnomalyNarrative } = require('./anomalyExplanationBuilder');
const {
  upsertAnomaly,
  markAnomaliesResolvedForTransaction,
  getAnomalySummaryForUser,
} = require('./anomalyRepository');
const { logServiceEvent } = require('../observability/eventLogger');

const SUPPORTED_CURRENCIES = new Set(['USD', 'PKR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY']);

const normalizeCurrency = (value, fallback = 'USD') => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SUPPORTED_CURRENCIES.has(code) ? code : fallback;
};

const getUserPreferredCurrency = async (userId) => {
  if (!userId) return 'USD';

  try {
    const result = await db.query('SELECT preferred_currency FROM users WHERE user_id = $1 LIMIT 1', [userId]);
    return normalizeCurrency(result.rows[0]?.preferred_currency, 'USD');
  } catch {
    return 'USD';
  }
};

const toMonthYearFromDate = (dateValue) => {
  const parsed = new Date(dateValue || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  return {
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
};

const persistCandidates = async ({ userId, candidates = [], currency = null }) => {
  const saved = [];
  const resolvedCurrency = normalizeCurrency(currency, await getUserPreferredCurrency(userId));

  for (const candidate of candidates) {
    const narrative = buildAnomalyNarrative({
      type: candidate.type,
      evidence: candidate.evidence || {},
      currency: resolvedCurrency,
    });

    const persisted = await upsertAnomaly({
      userId,
      transactionId: candidate.transactionId || null,
      anomalyType: candidate.type,
      scope: candidate.scope,
      severity: candidate.severity,
      title: candidate.title || narrative.title,
      explanation: candidate.explanation || narrative.explanation,
      evidence: candidate.evidence || {},
      dedupeKey: candidate.dedupeKey,
      year: candidate.year || null,
      month: candidate.month || null,
      status: 'active',
    });

    saved.push(persisted);
  }

  return saved;
};

const evaluateTransactionForAnomalies = async ({
  userId,
  transaction,
  dedupeStatus = null,
  context = null,
  currency = null,
}) => {
  if (!transaction || !userId) return [];

  const transactionId = Number(transaction.transaction_id || transaction.id || 0) || null;

  await markAnomaliesResolvedForTransaction({
    userId,
    transactionId,
  });

  const evaluatedType = String(transaction.type || 'expense').toLowerCase();

  const dedupe = dedupeStatus || await annotateRowDedupe({
    userId,
    row: {
      transaction_date: transaction.date,
      amount: transaction.amount,
      direction: evaluatedType === 'income' ? 'credit' : 'debit',
      merchant: transaction.merchant,
      description: transaction.description,
      reference_id: transaction.source_reference_id,
      source_bank: transaction.source,
    },
    excludeTransactionId: transactionId,
  });

  const [
    userBaseline,
    categoryBaseline,
    merchantHistory,
    recurringBaseline,
  ] = await Promise.all([
    getUserAmountBaseline({
      userId,
      type: evaluatedType,
      excludingTransactionId: transactionId,
      lookbackLimit: 60,
    }),
    getCategoryAmountBaseline({
      userId,
      type: evaluatedType,
      categoryId: transaction.category_id,
      excludingTransactionId: transactionId,
      lookbackLimit: 50,
    }),
    getMerchantHistory({
      userId,
      merchant: transaction.merchant || transaction.description,
      excludingTransactionId: transactionId,
      lookbackLimit: 80,
    }),
    getRecurringMerchantBaseline({
      userId,
      merchant: transaction.merchant || transaction.description,
      type: evaluatedType,
      excludingTransactionId: transactionId,
      lookbackMonths: 9,
    }),
  ]);

  const candidates = evaluateTransactionAnomalies({
    userId,
    transaction,
    dedupe,
    userBaseline,
    categoryBaseline,
    merchantHistory,
    recurringBaseline,
    context,
  });

  return persistCandidates({ userId, candidates, currency });
};

const evaluateImportRowsForAnomalies = async ({ userId, rows = [], correlationId = null, currency = null }) => {
  const startedAt = Date.now();

  if (!Array.isArray(rows) || rows.length === 0) {
    logServiceEvent({
      service: 'anomaly.import',
      operation: 'evaluate_import_rows',
      status: 'ok',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: correlationId ? { correlationId } : null,
      details: {
        input_rows: 0,
        evaluated_rows: 0,
        anomaly_count: 0,
      },
    });

    return [];
  }

  const aggregated = [];

  const evaluableRows = rows
    .map((row) => ({
      rowIndex: row?.row_index,
      transaction: row?.transaction,
      dedupeStatus: row?.dedupe || null,
    }))
    .filter((row) => row.transaction);

  const batches = [];
  for (let index = 0; index < evaluableRows.length; index += 8) {
    batches.push(evaluableRows.slice(index, index + 8));
  }

  for (const batch of batches) {
    const resolved = await Promise.all(
      batch.map((row) => evaluateTransactionForAnomalies({
        userId,
        transaction: row.transaction,
        dedupeStatus: row.dedupeStatus,
        context: {
          source: 'import_confirm',
          row_index: row.rowIndex,
        },
        currency,
      }))
    );

    for (const item of resolved) {
      aggregated.push(...item);
    }
  }

  logServiceEvent({
    service: 'anomaly.import',
    operation: 'evaluate_import_rows',
    status: 'ok',
    userId,
    latencyMs: Date.now() - startedAt,
    fallbackUsed: false,
    requestLike: correlationId ? { correlationId } : null,
    details: {
      input_rows: rows.length,
      evaluated_rows: evaluableRows.length,
      anomaly_count: aggregated.length,
      batch_count: batches.length,
    },
  });

  return aggregated;
};

const evaluateMonthlyAnomaliesForSummary = async ({ userId, month, year, currency = null }) => {
  if (!userId) return [];

  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);
  const fallback = toMonthYearFromDate(new Date().toISOString());

  const finalMonth = Number.isInteger(normalizedMonth) && normalizedMonth >= 1 && normalizedMonth <= 12
    ? normalizedMonth
    : fallback.month;
  const finalYear = Number.isInteger(normalizedYear) && normalizedYear >= 2000
    ? normalizedYear
    : fallback.year;

  const [monthlyWindow, categoryMonthly] = await Promise.all([
    getMonthlyTotalsWindow({
      userId,
      monthsBack: 12,
      month: finalMonth,
      year: finalYear,
    }),
    getCategoryMonthlyBaseline({ userId, month: finalMonth, year: finalYear, lookbackMonths: 12 }),
  ]);

  const candidates = evaluateMonthlyAnomalies({
    year: finalYear,
    month: finalMonth,
    monthlyWindow,
    categoryMonthly,
  });

  return persistCandidates({ userId, candidates, currency });
};

const getDashboardAnomalySummary = async ({ userId, month, year, highlightLimit = 5, currency = null }) => {
  await evaluateMonthlyAnomaliesForSummary({ userId, month, year, currency });

  return getAnomalySummaryForUser({
    userId,
    month,
    year,
    limit: highlightLimit,
  });
};

module.exports = {
  evaluateTransactionForAnomalies,
  evaluateImportRowsForAnomalies,
  evaluateMonthlyAnomaliesForSummary,
  getDashboardAnomalySummary,
};
