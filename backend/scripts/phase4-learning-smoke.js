const db = require('../db/db');
const { createTransaction } = require('../services/transactions/transactionWriteService');
const { recordFeedbackEvent } = require('../services/transactions/feedbackLearningService');

const toId = (value) => Number(value);

const run = async () => {
  const userResult = await db.query('SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1');
  if (!userResult.rows[0]) {
    throw new Error('No users available for smoke test');
  }

  const userId = toId(userResult.rows[0].user_id);

  const groceriesResult = await db.query(
    "SELECT category_id, name FROM categories WHERE LOWER(name)=LOWER('Groceries') LIMIT 1"
  );
  if (!groceriesResult.rows[0]) {
    throw new Error('Groceries category missing');
  }

  const groceriesCategoryId = toId(groceriesResult.rows[0].category_id);

  const createPayload = {
    description: 'Imtiaz Super Market F11',
    merchant: 'Imtiaz Super Market',
    amount: 3200,
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
    source: 'Bank',
    source_bank: 'easypaisa',
    channel: 'card_purchase',
  };

  const firstCreated = await createTransaction(userId, createPayload);

  await recordFeedbackEvent({
    userId,
    transactionId: firstCreated.transaction.transaction_id,
    interactionKind: 'post_save_edit',
    predictedCategoryName: firstCreated.transaction.category_name || null,
    finalCategoryId: groceriesCategoryId,
    finalCategoryName: groceriesResult.rows[0].name,
    merchant: createPayload.merchant,
    description: createPayload.description,
    amount: createPayload.amount,
    direction: createPayload.type,
    sourceBank: createPayload.source_bank,
    channel: createPayload.channel,
    metadata: {
      smoke: true,
      origin: 'phase4-learning-smoke',
    },
  });

  const secondCreated = await createTransaction(userId, {
    ...createPayload,
    description: 'Imtiaz Super Market G13',
    amount: 1800,
  });

  const feedbackCountResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM category_feedback_events
     WHERE user_id = $1
       AND metadata->>'origin' = 'phase4-learning-smoke'`,
    [userId]
  );

  const memoryResult = await db.query(
    `SELECT memory_id, category_id, correction_count, confirmation_count, total_evidence_count
     FROM merchant_pattern_memory
     WHERE user_id = $1
       AND normalized_merchant = $2
       AND is_active = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, 'IMTIAZ SUPER MARKET']
  );

  const summary = {
    user_id: userId,
    first_transaction: {
      id: firstCreated.transaction.transaction_id,
      category: firstCreated.transaction.category_name,
      source: firstCreated.resolved.source,
    },
    second_transaction: {
      id: secondCreated.transaction.transaction_id,
      category: secondCreated.transaction.category_name,
      source: secondCreated.resolved.source,
    },
    feedback_events_logged: toId(feedbackCountResult.rows[0]?.count || 0),
    memory_entry: memoryResult.rows[0] || null,
  };

  await db.query(
    `DELETE FROM category_feedback_events
     WHERE user_id = $1
       AND metadata->>'origin' = 'phase4-learning-smoke'`,
    [userId]
  );

  await db.query(
    `DELETE FROM merchant_pattern_memory
     WHERE user_id = $1
       AND normalized_merchant = $2
       AND metadata->>'origin' = 'phase4-learning-smoke'`,
    [userId, 'IMTIAZ SUPER MARKET']
  );

  await db.query(
    `DELETE FROM transactions
     WHERE user_id = $1
       AND transaction_id = ANY($2::int[])`,
    [userId, [firstCreated.transaction.transaction_id, secondCreated.transaction.transaction_id]]
  );

  return summary;
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 4 learning smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Phase 4 learning smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { run };
