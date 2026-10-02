const assert = require('assert');

const dbPath = require.resolve('../../db/db');

const queryQueue = [];
const queryCalls = [];

const dbStub = {
  query: async (sql, params = []) => {
    queryCalls.push({ sql, params });
    if (queryQueue.length > 0) {
      const handler = queryQueue.shift();
      return handler(sql, params);
    }
    return { rows: [] };
  },
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: dbStub,
};

const { annotateRowDedupe } = require('../../services/import/dedupeService');

const enqueue = (handler) => {
  queryQueue.push(handler);
};

const clearState = () => {
  queryQueue.length = 0;
  queryCalls.length = 0;
};

const baseRow = {
  transaction_date: '2026-03-01',
  amount: 1200,
  direction: 'debit',
  merchant: 'Careem',
  description: 'Careem ride',
  reference_id: 'ref-123',
  source_bank: 'sadapay',
};

const testExactDuplicate = async () => {
  enqueue(() => ({ rows: [{ transaction_id: 1 }] }));

  const result = await annotateRowDedupe({
    userId: 11,
    row: baseRow,
  });

  assert.strictEqual(result.dedupe_status, 'blocked_exact', 'exact fingerprint match should block');
  assert.ok(
    String(result.duplicate_reason || '').includes('Exact duplicate fingerprint'),
    'exact duplicate reason should be present'
  );
  assert.ok(result.dedupe_fingerprint, 'fingerprint should be generated');
};

const testReferenceDuplicate = async () => {
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [{ transaction_id: 2 }] }));

  const result = await annotateRowDedupe({
    userId: 11,
    row: baseRow,
  });

  assert.strictEqual(result.dedupe_status, 'probable_duplicate', 'existing reference id should mark probable duplicate');
  assert.ok(
    String(result.duplicate_reason || '').includes('reference ID already exists'),
    'reference duplicate reason should be present'
  );
};

const testProbableDateAmountMerchantDuplicate = async () => {
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [{ transaction_id: 9 }] }));

  const result = await annotateRowDedupe({
    userId: 11,
    row: {
      ...baseRow,
      reference_id: null,
      description: 'Uber ride fallback',
      merchant: 'Uber',
    },
  });

  assert.strictEqual(result.dedupe_status, 'probable_duplicate', 'date+amount+merchant similarity should mark probable duplicate');
  assert.ok(
    String(result.duplicate_reason || '').includes('Similar transaction exists'),
    'probable duplicate reason should be present'
  );
};

const testClearStatus = async () => {
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [] }));

  const result = await annotateRowDedupe({
    userId: 11,
    row: {
      ...baseRow,
      reference_id: null,
      description: 'Completely unique description',
      merchant: 'Unique Merchant',
      amount: 3333,
      transaction_date: '2026-03-22',
    },
  });

  assert.strictEqual(result.dedupe_status, 'clear', 'non-matching rows should remain clear');
  assert.strictEqual(result.duplicate_reason, null, 'clear row should not have duplicate reason');
  assert.ok(result.dedupe_fingerprint, 'fingerprint should still be present for clear rows');
};

(async () => {
  try {
    await testExactDuplicate();
    await testReferenceDuplicate();
    await testProbableDateAmountMerchantDuplicate();
    await testClearStatus();

    assert.strictEqual(queryQueue.length, 0, 'all queued DB expectations should be consumed');
    assert.ok(queryCalls.length >= 7, 'expected multiple dedupe queries to run');

    console.log('dedupeService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('dedupeService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    clearState();
    delete require.cache[require.resolve('../../services/import/dedupeService')];
    delete require.cache[dbPath];
  }
})();
