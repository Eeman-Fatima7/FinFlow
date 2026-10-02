const assert = require('assert');

const dbPath = require.resolve('../../db/db');
const axiosPath = require.resolve('axios');
const merchantRulesPath = require.resolve('../../services/transactions/merchantCategoryRuleService');
const memoryPath = require.resolve('../../services/transactions/merchantPatternMemoryService');

const dbStub = { query: async () => ({ rows: [] }) };
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: dbStub,
};

let axiosResponse = null;
let axiosShouldThrow = false;
const axiosCalls = [];

const axiosStub = {
  post: async (url, payload) => {
    axiosCalls.push({ url, payload });
    if (axiosShouldThrow) {
      throw new Error('ML offline');
    }
    return { data: axiosResponse };
  },
};

require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: axiosStub,
};

const loadMerchantCategoryRules = async () => [
  {
    id: 7,
    pattern: 'NAYAPAY TOPUP',
    category_id: 3,
    category_name: 'Transfers',
    match_type: 'contains',
    source: 'user_correction',
    use_count: 9,
    confidence: 1,
  },
];

const findMatchingMerchantRule = ({ description, merchant, rules }) => {
  const key = `${merchant || ''} ${description || ''}`.toUpperCase();
  return rules.find((r) => key.includes(r.pattern)) || null;
};

const findBestMemoryMatch = async ({ merchant }) => {
  if (String(merchant || '').toUpperCase().includes('CAREEM')) {
    return {
      category_id: 5,
      category_name: 'Transport',
      confidence: 0.93,
      source: 'override',
    };
  }
  return null;
};

require.cache[merchantRulesPath] = {
  id: merchantRulesPath,
  filename: merchantRulesPath,
  loaded: true,
  exports: {
    loadMerchantCategoryRules,
    findMatchingMerchantRule,
  },
};

require.cache[memoryPath] = {
  id: memoryPath,
  filename: memoryPath,
  loaded: true,
  exports: {
    findBestMemoryMatch,
  },
};

const { enrichRowsWithCategories } = require('../../services/import/categorizationService');

const baseRows = [
  {
    row_index: 0,
    review_payload: {
      description: 'Careem ride to office',
      merchant: 'Careem',
      amount: 1250,
      direction: 'debit',
      source_bank: 'sadapay',
      channel: 'wallet_transfer',
      warnings: [],
    },
    normalized_payload: {},
    needs_review: false,
    top_predictions: [],
  },
  {
    row_index: 1,
    review_payload: {
      description: 'NayaPay topup successful',
      merchant: 'NayaPay',
      amount: 2200,
      direction: 'debit',
      source_bank: 'myabl',
      channel: 'card_purchase',
      warnings: [],
    },
    normalized_payload: {},
    needs_review: false,
    top_predictions: [],
  },
  {
    row_index: 2,
    review_payload: {
      description: 'Unknown merchant utility',
      merchant: 'Utility Vendor',
      amount: 1800,
      direction: 'debit',
      source_bank: 'unknown',
      channel: 'unknown',
      warnings: [],
    },
    normalized_payload: {},
    needs_review: false,
    top_predictions: [],
  },
];

const runTests = async () => {
  axiosShouldThrow = false;
  axiosCalls.length = 0;
  axiosResponse = {
    results: [
      {
        category: 'Utilities',
        confidence: 0.58,
        source: 'model',
        top_predictions: [
          { category: 'Utilities', confidence: 0.58 },
          { category: 'Groceries', confidence: 0.55 },
        ],
        margin: 0.03,
        ambiguous: true,
        model_version: 'v8.2.0',
      },
    ],
  };

  const first = await enrichRowsWithCategories({
    userId: 77,
    rows: baseRows,
  });

  assert.strictEqual(first.rows.length, 3, 'all rows should be returned');
  assert.strictEqual(axiosCalls.length, 1, 'exactly one row should go to ML batch');
  assert.strictEqual(axiosCalls[0].payload.length, 1, 'only unresolved rows should be sent to ML');

  const memoryRow = first.rows[0].review_payload;
  assert.strictEqual(memoryRow.category_final, 'Transport', 'memory match should set final category');
  assert.strictEqual(memoryRow.ml_source, 'override', 'memory path source should be override');
  assert.strictEqual(memoryRow.needs_review, false, 'memory match should not require review');

  const ruleRow = first.rows[1].review_payload;
  assert.strictEqual(ruleRow.category_final, 'Transfers', 'rule match should set final category');
  assert.strictEqual(ruleRow.ml_source, 'user_rule', 'rule path source should be user_rule');
  assert.strictEqual(ruleRow.needs_review, false, 'rule match should not require review');

  const mlRow = first.rows[2].review_payload;
  assert.strictEqual(mlRow.ml_predicted_category, 'Utilities', 'ML prediction should be assigned');
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(mlRow, 'category_final'),
    false,
    'ambiguous low confidence ML should not auto-finalize category'
  );
  assert.strictEqual(mlRow.needs_review, true, 'ambiguous row should require review');
  assert.ok(
    mlRow.warnings.includes('Low confidence ML category prediction'),
    'low confidence warning should be present'
  );
  assert.ok(
    mlRow.warnings.includes('Ambiguous ML category prediction'),
    'ambiguous warning should be present'
  );

  axiosShouldThrow = false;
  axiosCalls.length = 0;
  axiosResponse = {
    results: [
      {
        category: 'Bills',
        confidence: 1,
        source: 'rule',
        top_predictions: [{ category: 'Bills', confidence: 1 }],
        margin: 1,
        ambiguous: false,
        model_version: 'v8.2.0',
      },
    ],
  };

  const mlRule = await enrichRowsWithCategories({
    userId: 77,
    rows: [
      {
        row_index: 9,
        review_payload: {
          description: 'K-ELECTRIC monthly bill payment',
          merchant: 'K-ELECTRIC',
          amount: 2300,
          direction: 'debit',
          source_bank: 'myabl',
          channel: 'bill_payment',
          warnings: [],
        },
        normalized_payload: {},
        needs_review: false,
        top_predictions: [],
      },
    ],
  });

  assert.strictEqual(axiosCalls.length, 1, 'ML rule scenario should call batch once');
  const mlRuleRow = mlRule.rows[0].review_payload;
  assert.strictEqual(mlRuleRow.ml_source, 'rule', 'ML rule source should be preserved');
  assert.strictEqual(mlRuleRow.category_final, 'Bills', 'ML rule source should auto-finalize category');
  assert.strictEqual(mlRuleRow.needs_review, false, 'ML rule source row should not require review');

  axiosShouldThrow = true;
  axiosCalls.length = 0;

  const fallback = await enrichRowsWithCategories({
    userId: 77,
    rows: [
      {
        row_index: 4,
        review_payload: {
          description: 'Completely unknown row',
          merchant: 'Unknown X',
          amount: 90,
          direction: 'debit',
          source_bank: 'unknown',
          channel: 'unknown',
          warnings: [],
        },
        normalized_payload: {},
        needs_review: false,
        top_predictions: [],
      },
    ],
  });

  assert.strictEqual(axiosCalls.length, 1, 'ML should be attempted once');
  assert.ok(
    fallback.warnings.includes('ML categorization service unavailable during import preview'),
    'service outage warning should be returned'
  );
  assert.strictEqual(
    fallback.rows[0].review_payload.category_final,
    undefined,
    'without ML result row should remain uncategorized'
  );
};

(async () => {
  try {
    await runTests();
    console.log('categorizationService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('categorizationService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    delete require.cache[require.resolve('../../services/import/categorizationService')];
    delete require.cache[dbPath];
    delete require.cache[axiosPath];
    delete require.cache[merchantRulesPath];
    delete require.cache[memoryPath];
  }
})();
