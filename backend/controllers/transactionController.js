const db = require('../db/db');
const {
  normalizeUpdatePayload,
  ensureCategoryExists,
  fetchTransactionById,
  createTransaction,
  createTransactionsBatch,
} = require('../services/transactions/transactionWriteService');
const { upsertUserCorrectionRule } = require('../services/transactions/merchantCategoryRuleService');
const { recordFeedbackEvent } = require('../services/transactions/feedbackLearningService');
const { evaluateTransactionForAnomalies } = require('../services/anomalies/anomalyOrchestratorService');

const withAnomalyEvaluation = async ({ userId, transaction, source }) => {
  try {
    return await evaluateTransactionForAnomalies({
      userId,
      transaction,
      context: {
        source,
      },
    });
  } catch (anomalyErr) {
    console.warn(`Transaction anomaly evaluation failed after ${source}:`, anomalyErr.message);
    return [];
  }
};

// ─── ADD TRANSACTION ─────────────────────────────────────────
const addTransaction = async (req, res) => {
  try {
    const requestBody = req.body || {};
    const created = await createTransaction(req.userId, requestBody);

    const manualCategoryProvided =
      Object.prototype.hasOwnProperty.call(requestBody, 'category_id') ||
      Object.prototype.hasOwnProperty.call(requestBody, 'category_name');

    if (manualCategoryProvided && created?.transaction?.category_name) {
      try {
        await recordFeedbackEvent({
          userId: req.userId,
          transactionId: created.transaction.transaction_id,
          interactionKind: 'manual_labeling',
          predictedCategoryName: null,
          finalCategoryName: created.transaction.category_name,
          merchant: created.transaction.merchant || requestBody.merchant,
          description: created.transaction.description || requestBody.description,
          amount: created.transaction.amount || requestBody.amount,
          direction: created.transaction.type,
          sourceBank: requestBody.source_bank || requestBody.source,
          channel: requestBody.channel,
          modelVersion: created?.resolved?.modelVersion || null,
          metadata: {
            origin: 'transactions.add',
          },
        });
      } catch (feedbackErr) {
        console.warn('Failed to record manual labeling feedback:', feedbackErr.message);
      }
    }

    const anomalies = await withAnomalyEvaluation({
      userId: req.userId,
      transaction: created.transaction,
      source: 'transactions.create',
    });

    return res.status(201).json({
      message: 'Transaction added successfully',
      transaction: created.transaction,
      anomalies,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    console.error('addTransaction error:', err.message);
    return res.status(500).json({ error: 'Server error adding transaction' });
  }
};

// ─── ADD TRANSACTIONS BATCH ─────────────────────────────────
const addTransactionsBatch = async (req, res) => {
  const userId = req.userId;
  const items = req.body?.transactions;

  try {
    const result = await createTransactionsBatch(userId, items);

    if (result.created_count === 0) {
      return res.status(400).json({
        message: 'No transactions were created',
        ...result,
      });
    }

    const status = result.failed_count > 0 ? 207 : 201;

    return res.status(status).json({
      message: result.failed_count > 0 ? 'Batch processed with partial failures' : 'Batch created successfully',
      ...result,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    console.error('addTransactionsBatch error:', err.message);
    return res.status(500).json({ error: 'Server error adding transactions batch' });
  }
};

// ─── GET TRANSACTIONS ─────────────────────────────────────────
const getTransactions = async (req, res) => {
  const userId = req.userId;
  const { month, year, category_id, type, limit = 100, offset = 0 } = req.query;

  try {
    const whereClauses = ['t.user_id = $1'];
    const filterParams = [userId];
    let paramIndex = 2;

    if (month) {
      whereClauses.push(`EXTRACT(MONTH FROM t.date) = $${paramIndex++}`);
      filterParams.push(Number(month));
    }
    if (year) {
      whereClauses.push(`EXTRACT(YEAR FROM t.date) = $${paramIndex++}`);
      filterParams.push(Number(year));
    }
    if (category_id) {
      whereClauses.push(`t.category_id = $${paramIndex++}`);
      filterParams.push(Number(category_id));
    }
    if (type) {
      whereClauses.push(`t.type = $${paramIndex++}`);
      filterParams.push(type);
    }

    const whereClause = whereClauses.join(' AND ');

    const query = `
      SELECT
        t.*,
        c.name  AS category_name,
        c.icon  AS category_icon,
        c.color AS category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.category_id
      WHERE ${whereClause}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const params = [...filterParams, Number(limit), Number(offset)];
    const result = await db.query(query, params);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM transactions t
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, filterParams);

    return res.status(200).json({
      transactions: result.rows,
      total: Number(countResult.rows[0].total),
    });
  } catch (err) {
    console.error('getTransactions error:', err.message);
    return res.status(500).json({ error: 'Server error fetching transactions' });
  }
};

// ─── UPDATE TRANSACTION ───────────────────────────────────────
const updateTransaction = async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  try {
    const existingResult = await db.query(
      `SELECT transaction_id, category_id, merchant, description
       FROM transactions
       WHERE transaction_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updates = normalizeUpdatePayload(req.body || {});

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    if (updates.category_id !== undefined && updates.category_id !== null) {
      await ensureCategoryExists(updates.category_id);
    }

    const setClauses = [];
    const values = [];

    Object.entries(updates).forEach(([field, value], index) => {
      setClauses.push(`${field} = $${index + 1}`);
      values.push(value);
    });

    setClauses.push('updated_at = NOW()');

    values.push(id);
    values.push(userId);

    await db.query(
      `UPDATE transactions
       SET ${setClauses.join(', ')}
       WHERE transaction_id = $${values.length - 1} AND user_id = $${values.length}`,
      values
    );

    const previous = existingResult.rows[0];
    const categoryChanged =
      updates.category_id !== undefined &&
      updates.category_id !== null &&
      Number(updates.category_id) !== Number(previous.category_id);

    if (categoryChanged) {
      const merchantSource =
        (typeof updates.merchant === 'string' && updates.merchant.trim()) ||
        (typeof previous.merchant === 'string' && previous.merchant.trim()) ||
        (typeof updates.description === 'string' && updates.description.trim()) ||
        (typeof previous.description === 'string' && previous.description.trim()) ||
        '';

      if (merchantSource) {
        await upsertUserCorrectionRule({
          userId,
          pattern: merchantSource,
          categoryId: updates.category_id,
        });
      }

      const previousCategoryResult = Number(previous.category_id)
        ? await db.query('SELECT name FROM categories WHERE category_id = $1 LIMIT 1', [previous.category_id])
        : { rows: [] };
      const nextCategoryResult = await db.query(
        'SELECT name FROM categories WHERE category_id = $1 LIMIT 1',
        [updates.category_id]
      );

      try {
        await recordFeedbackEvent({
          userId,
          transactionId: Number(id),
          interactionKind: 'post_save_edit',
          predictedCategoryId: previous.category_id,
          predictedCategoryName: previousCategoryResult.rows[0]?.name || null,
          finalCategoryId: updates.category_id,
          finalCategoryName: nextCategoryResult.rows[0]?.name || null,
          merchant: merchantSource,
          description:
            (typeof updates.description === 'string' && updates.description.trim()) ||
            (typeof previous.description === 'string' && previous.description.trim()) ||
            merchantSource,
          sourceBank: typeof updates.source === 'string' ? updates.source : null,
          direction: typeof updates.type === 'string' ? updates.type : null,
          metadata: {
            origin: 'transactions.update',
          },
        });
      } catch (feedbackErr) {
        console.warn('Failed to record post-save edit feedback:', feedbackErr.message);
      }
    }

    const transaction = await fetchTransactionById(userId, Number(id));

    const anomalies = await withAnomalyEvaluation({
      userId,
      transaction,
      source: 'transactions.update',
    });

    return res.status(200).json({
      message: 'Transaction updated successfully',
      transaction,
      anomalies,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    console.error('updateTransaction error:', err.message);
    return res.status(500).json({ error: 'Server error updating transaction' });
  }
};

// ─── DELETE TRANSACTION ───────────────────────────────────────
const deleteTransaction = async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  try {
    const check = await db.query(
      'SELECT transaction_id FROM transactions WHERE transaction_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await db.query('DELETE FROM transactions WHERE transaction_id = $1', [id]);

    return res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    console.error('deleteTransaction error:', err.message);
    return res.status(500).json({ error: 'Server error deleting transaction' });
  }
};

module.exports = {
  addTransaction,
  addTransactionsBatch,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};