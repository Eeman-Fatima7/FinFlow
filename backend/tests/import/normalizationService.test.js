const assert = require('assert');

const dbPath = require.resolve('../../db/db');
const dedupePath = require.resolve('../../services/import/dedupeService');

delete require.cache[dbPath];
delete require.cache[dedupePath];

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

const { normalizeExtractedRows } = require('../../services/import/normalizationService');

const enqueue = (handler) => {
  queryQueue.push(handler);
};

const resetQueues = () => {
  queryQueue.length = 0;
  queryCalls.length = 0;
};

const testRows = [
  {
    transaction_date: '2026-03-01',
    description: 'ATM Withdrawal - Main Branch',
    merchant: 'Main ATM',
    amount: 5000,
    direction: 'debit',
    extraction_confidence: 0.92,
    source_bank: 'myabl',
    warnings: [],
  },
  {
    transaction_date: '2026-03-02',
    description: 'Salary payment',
    merchant: 'Employer Pvt Ltd',
    amount: 150000,
    direction: 'credit',
    extraction_confidence: 0.91,
    source_bank: 'myabl',
    warnings: [],
  },
  {
    transaction_date: '2026-03-01',
    description: 'ATM Withdrawal - Main Branch',
    merchant: 'Main ATM',
    amount: 5000,
    direction: 'debit',
    extraction_confidence: 0.78,
    source_bank: 'myabl',
    warnings: [],
  },
  {
    transaction_date: 'invalid-date',
    description: 'Malformed date row',
    merchant: 'Coffee Shop',
    amount: 450,
    direction: 'debit',
    extraction_confidence: 0.41,
    source_bank: 'myabl',
    warnings: ['raw warning'],
  },
];

const runTests = async () => {
  // No existing duplicates for first two rows, same fingerprint for third row should trigger in-file duplicate block.
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [] }));
  enqueue(() => ({ rows: [] }));

  const result = await normalizeExtractedRows({
    userId: 42,
    importSessionId: 'sess-abc',
    sourceType: 'csv',
    sourceBank: 'myabl',
    rows: testRows,
  });

  assert.strictEqual(Array.isArray(result.rows), true, 'rows should be an array');
  assert.strictEqual(result.rows.length, 4, 'should normalize all rows');

  const row0 = result.rows[0];
  const row1 = result.rows[1];
  const row2 = result.rows[2];
  const row3 = result.rows[3];

  assert.strictEqual(row0.row_index, 0, 'first row index must be 0');
  assert.strictEqual(row0.review_payload.transaction_date, '2026-03-01', 'date should normalize to YYYY-MM-DD');
  assert.strictEqual(row0.review_payload.amount, 5000, 'amount should be normalized');
  assert.strictEqual(row0.review_payload.direction, 'debit', 'direction should stay debit');
  assert.strictEqual(row0.review_payload.needs_review, false, 'clean row should not need review');
  assert.strictEqual(row0.review_payload.canonical_payload.date, '2026-03-01', 'canonical payload should preserve valid normalized date');

  assert.strictEqual(row1.review_payload.direction, 'credit', 'credit direction should be preserved');
  assert.strictEqual(row1.review_payload.amount, 150000, 'credit amount should be normalized');

  assert.strictEqual(row2.dedupe_status, 'blocked_exact', 'duplicate fingerprint in same file should be blocked');
  assert.strictEqual(row2.is_excluded, true, 'blocked duplicate should be excluded');
  assert.ok(
    Array.isArray(row2.review_payload.warnings) &&
      row2.review_payload.warnings.includes('Duplicate row detected inside uploaded file'),
    'duplicate warning should be attached'
  );

  assert.strictEqual(row3.review_payload.transaction_date, null, 'invalid date should become null');
  assert.strictEqual(row3.review_payload.canonical_payload.date, null, 'canonical payload should keep null date for invalid row');
  assert.strictEqual(row3.review_payload.needs_review, true, 'invalid date row must need review');

  assert.ok(
    result.warnings.includes('Row 4: missing/invalid date'),
    'normalization warnings should include invalid date'
  );

  assert.strictEqual(queryQueue.length, 0, 'all queued DB handlers should be consumed');
  assert.strictEqual(queryCalls.length, 7, 'dedupe checks should issue expected DB queries');
};

(async () => {
  try {
    await runTests();
    console.log('normalizationService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('normalizationService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    resetQueues();
    delete require.cache[require.resolve('../../services/import/normalizationService')];
    delete require.cache[require.resolve('../../services/import/dedupeService')];
    delete require.cache[dbPath];
  }
})();
