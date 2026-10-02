const assert = require('assert');

const dbPath = require.resolve('../../db/db');
const merchantRulesPath = require.resolve('../../services/transactions/merchantCategoryRuleService');
const merchantMemoryPath = require.resolve('../../services/transactions/merchantPatternMemoryService');
const mlConfigPath = require.resolve('../../config/mlConfig');
const axiosPath = require.resolve('axios');

delete require.cache[dbPath];
delete require.cache[merchantRulesPath];
delete require.cache[merchantMemoryPath];
delete require.cache[mlConfigPath];
delete require.cache[axiosPath];

const queryCalls = [];

const dbStub = {
  query: async (sql, params = []) => {
    queryCalls.push({ sql, params });

    if (/SELECT category_id FROM categories WHERE category_id = \$1/i.test(sql)) {
      return { rows: [{ category_id: params[0] }] };
    }

    if (/SELECT\s+category_id,\s*name\s+FROM\s+categories\s+WHERE\s+LOWER\(name\)\s*=\s*LOWER\(\$1\)\s+LIMIT\s+1/i.test(sql)) {
      const requested = String(params[0] || '').trim().toLowerCase();

      if (requested === 'bills') {
        return { rows: [{ category_id: 10, name: 'Bills' }] };
      }

      if (requested === 'fees & charges') {
        return { rows: [{ category_id: 32, name: 'Fees & Charges' }] };
      }

      return { rows: [] };
    }

    if (/regexp_replace\(LOWER\(name\), '\[\^a-z0-9\]\+', '', 'g'\) = \$1/i.test(sql)) {
      const requested = String(params[0] || '').trim().toLowerCase();

      if (requested === 'feesandcharges') {
        return { rows: [{ category_id: 32, name: 'Fees & Charges' }] };
      }

      return { rows: [] };
    }

    if (/INSERT INTO transactions/i.test(sql)) {
      return { rows: [{ transaction_id: 12345 }] };
    }

    if (/SELECT\s+t\.\*/i.test(sql)) {
      return {
        rows: [
          {
            transaction_id: params[0],
            user_id: params[1],
            category_id: 10,
            description: 'stubbed transaction',
            merchant: 'stubbed merchant',
            amount: '2500.00',
            type: 'expense',
            date: '2026-03-10',
            status: 'completed',
            source: 'Bank',
            notes: null,
            ml_confidence: null,
            category_name: 'Bills',
            category_icon: '🧾',
            category_color: '#000000',
          },
        ],
      };
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

require.cache[merchantRulesPath] = {
  id: merchantRulesPath,
  filename: merchantRulesPath,
  loaded: true,
  exports: {
    loadMerchantCategoryRules: async () => [],
    findMatchingMerchantRule: () => null,
  },
};

require.cache[merchantMemoryPath] = {
  id: merchantMemoryPath,
  filename: merchantMemoryPath,
  loaded: true,
  exports: {
    findBestMemoryMatch: async () => null,
  },
};

require.cache[mlConfigPath] = {
  id: mlConfigPath,
  filename: mlConfigPath,
  loaded: true,
  exports: {
    CONFIDENCE_HIGH: 0.8,
    CONFIDENCE_MEDIUM: 0.6,
    AMBIGUITY_MARGIN: 0.08,
  },
};

require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: {
    post: async () => ({
      data: {
        category: 'Bills',
        confidence: 0.95,
        source: 'model',
        top_predictions: [{ category: 'Bills', confidence: 0.95 }],
        margin: 0.4,
        ambiguous: false,
        model_version: 'stub-model',
      },
    }),
  },
};

const {
  normalizeCreatePayload,
  normalizeUpdatePayload,
  createTransactionsBatch,
} = require('../../services/transactions/transactionWriteService');

const resetCalls = () => {
  queryCalls.length = 0;
};

const assertThrowsWithMessage = (fn, expectedMessage) => {
  let threw = false;

  try {
    fn();
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, expectedMessage);
    assert.strictEqual(err.statusCode, 400);
  }

  assert.strictEqual(threw, true, `Expected error message: ${expectedMessage}`);
};

const testNormalizeCreatePayloadAllowsDefaultDateForManualCreate = () => {
  resetCalls();

  const payload = normalizeCreatePayload({
    description: 'Manual wallet top up',
    merchant: 'Cash Counter',
    amount: 1500,
    type: 'expense',
    status: 'completed',
    source: 'Cash',
  });

  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(payload.date), 'manual create path should default date to YYYY-MM-DD');
};

const testNormalizeCreatePayloadRejectsMissingDateForImport = () => {
  resetCalls();

  assertThrowsWithMessage(
    () =>
      normalizeCreatePayload({
        description: 'Imported utility bill',
        merchant: 'Utility Co',
        amount: 2400,
        type: 'expense',
        source_import_session_id: 'sess-import-1',
      }),
    'date is required'
  );
};

const testNormalizeCreatePayloadRejectsInvalidDateForImport = () => {
  resetCalls();

  assertThrowsWithMessage(
    () =>
      normalizeCreatePayload({
        description: 'Imported invalid date row',
        merchant: 'Vendor X',
        amount: 800,
        type: 'expense',
        date: 'not-a-date',
        source_import_session_id: 'sess-import-2',
      }),
    'date must be a valid date'
  );
};

const testNormalizeUpdatePayloadRejectsInvalidDate = () => {
  resetCalls();

  assertThrowsWithMessage(
    () =>
      normalizeUpdatePayload({
        date: 'bad-date-value',
      }),
    'date must be a valid date'
  );
};

const testNormalizeUpdatePayloadRejectsEmptyDate = () => {
  resetCalls();

  assertThrowsWithMessage(
    () =>
      normalizeUpdatePayload({
        date: '',
      }),
    'date is required'
  );
};

const testCreateTransactionsBatchReportsDateValidationErrorWithIndex = async () => {
  resetCalls();

  const result = await createTransactionsBatch(77, [
    {
      description: 'Valid imported row',
      merchant: 'Store A',
      amount: 1200,
      type: 'expense',
      date: '2026-03-08',
      source_import_session_id: 'sess-import-3',
      category_name: 'Bills',
    },
    {
      description: 'Invalid imported row',
      merchant: 'Store B',
      amount: 900,
      type: 'expense',
      source_import_session_id: 'sess-import-3',
      category_name: 'Bills',
    },
  ]);

  assert.strictEqual(result.total, 2, 'batch total should match input length');
  assert.strictEqual(result.created_count, 1, 'only one valid row should be created');
  assert.strictEqual(result.failed_count, 1, 'one invalid row should fail');
  assert.strictEqual(result.errors.length, 1, 'one error should be reported');
  assert.strictEqual(result.errors[0].index, 1, 'error should reference original item index');
  assert.strictEqual(result.errors[0].error, 'date is required', 'missing import date should surface strict error');
  assert.strictEqual(result.errors[0].statusCode, 400, 'missing import date should return 400');
};

const testCreateTransactionsBatchResolvesNormalizedCategoryNameForImport = async () => {
  resetCalls();

  const result = await createTransactionsBatch(77, [
    {
      description: 'Bank fee entry from import',
      merchant: 'MyABL',
      amount: 300,
      type: 'expense',
      date: '2026-03-09',
      source_import_session_id: 'sess-import-4',
      category_name: 'Fees and Charges',
      ml_source: 'rule',
      ml_confidence: 0.94,
    },
  ]);

  assert.strictEqual(result.total, 1, 'batch total should match input length');
  assert.strictEqual(result.created_count, 1, 'normalized category import row should be created');
  assert.strictEqual(result.failed_count, 0, 'normalized category import row should not fail');

  const insertCall = queryCalls.find((entry) => /INSERT INTO transactions/i.test(entry.sql));
  assert.ok(insertCall, 'create transaction should issue insert statement');
  assert.strictEqual(insertCall.params[1], 32, 'normalized category name should resolve to canonical category id');
};

(async () => {
  try {
    testNormalizeCreatePayloadAllowsDefaultDateForManualCreate();
    testNormalizeCreatePayloadRejectsMissingDateForImport();
    testNormalizeCreatePayloadRejectsInvalidDateForImport();
    testNormalizeUpdatePayloadRejectsInvalidDate();
    testNormalizeUpdatePayloadRejectsEmptyDate();
    await testCreateTransactionsBatchReportsDateValidationErrorWithIndex();
    await testCreateTransactionsBatchResolvesNormalizedCategoryNameForImport();

    console.log('transactionWriteService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('transactionWriteService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    delete require.cache[require.resolve('../../services/transactions/transactionWriteService')];
    delete require.cache[dbPath];
    delete require.cache[merchantRulesPath];
    delete require.cache[merchantMemoryPath];
    delete require.cache[mlConfigPath];
    delete require.cache[axiosPath];
  }
})();
