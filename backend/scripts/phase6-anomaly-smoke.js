const db = require('../db/db');
const { createTransaction, fetchTransactionById } = require('../services/transactions/transactionWriteService');
const {
  getAnomaliesForUser,
  getAnomalySummaryForUser,
  getTransactionAnomalies,
  updateAnomalyStatus,
} = require('../services/anomalies/anomalyRepository');
const {
  evaluateTransactionForAnomalies,
  evaluateMonthlyAnomaliesForSummary,
} = require('../services/anomalies/anomalyOrchestratorService');

const toMonthYear = (dateValue = new Date()) => {
  const parsed = new Date(dateValue);
  return {
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
};

const ensureCategory = async ({ type, fallbackName }) => {
  const result = await db.query(
    `SELECT category_id, name
     FROM categories
     WHERE type = $1
     ORDER BY category_id ASC
     LIMIT 1`,
    [type]
  );

  if (result.rows[0]) {
    return {
      id: Number(result.rows[0].category_id),
      name: result.rows[0].name,
    };
  }

  const inserted = await db.query(
    `INSERT INTO categories (name, type, icon, color)
     VALUES ($1, $2, '🧪', '#6B7280')
     RETURNING category_id, name`,
    [fallbackName, type]
  );

  return {
    id: Number(inserted.rows[0].category_id),
    name: inserted.rows[0].name,
  };
};

const pickSmokeUser = async () => {
  const byVolume = await db.query(
    `SELECT user_id, COUNT(*)::int AS tx_count
     FROM transactions
     GROUP BY user_id
     HAVING COUNT(*) >= 5
     ORDER BY tx_count DESC, user_id ASC
     LIMIT 1`
  );

  if (byVolume.rows[0]) {
    return {
      userId: Number(byVolume.rows[0].user_id),
      baselineTransactionCount: Number(byVolume.rows[0].tx_count) || 0,
    };
  }

  const firstUser = await db.query(
    `SELECT user_id
     FROM users
     ORDER BY user_id ASC
     LIMIT 1`
  );

  if (!firstUser.rows[0]) {
    throw new Error('No users available for anomaly smoke test');
  }

  const userId = Number(firstUser.rows[0].user_id);

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS tx_count
     FROM transactions
     WHERE user_id = $1`,
    [userId]
  );

  return {
    userId,
    baselineTransactionCount: Number(countResult.rows[0]?.tx_count || 0),
  };
};

const seedBaselineTransactionsIfNeeded = async ({ userId, baselineTransactionCount, expenseCategoryId }) => {
  if (baselineTransactionCount >= 5) return;

  const required = 5 - baselineTransactionCount;
  const baseDate = new Date();

  for (let i = 0; i < required; i += 1) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() - (i + 1));

    await createTransaction(userId, {
      description: `anomaly smoke baseline ${i + 1}`,
      merchant: 'anomaly smoke baseline merchant',
      amount: 350 + i * 15,
      type: 'expense',
      date: date.toISOString().slice(0, 10),
      category_id: expenseCategoryId,
      status: 'completed',
      source: 'Smoke',
      notes: 'phase6 anomaly baseline seed',
    });
  }
};

const run = async () => {
  const { userId, baselineTransactionCount } = await pickSmokeUser();

  const expenseCategory = await ensureCategory({
    type: 'expense',
    fallbackName: 'Smoke Expense',
  });

  await seedBaselineTransactionsIfNeeded({
    userId,
    baselineTransactionCount,
    expenseCategoryId: expenseCategory.id,
  });

  const testDate = new Date();
  const testMerchant = `anomaly smoke high ${Date.now()}`;

  const created = await createTransaction(userId, {
    description: testMerchant,
    merchant: testMerchant,
    amount: 9500,
    type: 'expense',
    date: testDate.toISOString().slice(0, 10),
    category_id: expenseCategory.id,
    status: 'completed',
    source: 'Smoke',
    notes: 'phase6 anomaly smoke',
  });

  const createdTransactionId = Number(created.transaction.transaction_id);

  if (!createdTransactionId) {
    throw new Error('Failed to create smoke transaction');
  }

  await evaluateTransactionForAnomalies({
    userId,
    transaction: created.transaction,
    context: {
      source: 'smoke.phase6.create',
    },
  });

  const anomaliesForTransaction = await getTransactionAnomalies({
    userId,
    transactionId: createdTransactionId,
  });

  if (!Array.isArray(anomaliesForTransaction) || anomaliesForTransaction.length === 0) {
    throw new Error('No transaction anomalies generated for smoke transaction');
  }

  const listActive = await getAnomaliesForUser({
    userId,
    status: 'active',
    limit: 50,
    offset: 0,
  });

  if (!Array.isArray(listActive) || listActive.length === 0) {
    throw new Error('Anomaly list endpoint returned no active anomalies');
  }

  const firstAnomaly = anomaliesForTransaction[0];

  const markedRead = await updateAnomalyStatus({
    userId,
    anomalyId: firstAnomaly.anomaly_id,
    status: 'read',
  });

  if (!markedRead || markedRead.status !== 'read') {
    throw new Error('Failed to mark anomaly as read');
  }

  const dismissed = await updateAnomalyStatus({
    userId,
    anomalyId: firstAnomaly.anomaly_id,
    status: 'dismissed',
  });

  if (!dismissed || dismissed.status !== 'dismissed') {
    throw new Error('Failed to dismiss anomaly');
  }

  const { month, year } = toMonthYear(testDate);

  await evaluateMonthlyAnomaliesForSummary({
    userId,
    month,
    year,
  });

  const summary = await getAnomalySummaryForUser({
    userId,
    month,
    year,
    limit: 5,
  });

  if (!summary || typeof summary.total_active !== 'number') {
    throw new Error('Invalid anomaly summary response');
  }

  const refreshedTransaction = await fetchTransactionById(userId, createdTransactionId);

  return {
    user_id: userId,
    smoke_transaction_id: createdTransactionId,
    smoke_transaction_merchant: refreshedTransaction?.merchant || testMerchant,
    transaction_anomaly_count: anomaliesForTransaction.length,
    active_list_count: listActive.length,
    summary_active_total: summary.total_active,
    summary_highlights_count: Array.isArray(summary.highlights) ? summary.highlights.length : 0,
    first_anomaly_status_after_updates: dismissed.status,
    month,
    year,
  };
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 6 anomaly smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Phase 6 anomaly smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { run };
