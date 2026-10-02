const assert = require('assert');

const extractionPath = require.resolve('../../services/import/extractionService');
const normalizationPath = require.resolve('../../services/import/normalizationService');
const categorizationPath = require.resolve('../../services/import/categorizationService');
const sessionPath = require.resolve('../../services/import/sessionService');
const dedupePath = require.resolve('../../services/import/dedupeService');
const transactionWritePath = require.resolve('../../services/transactions/transactionWriteService');
const feedbackPath = require.resolve('../../services/transactions/feedbackLearningService');
const anomalyPath = require.resolve('../../services/anomalies/anomalyOrchestratorService');
const dbPath = require.resolve('../../db/db');

const calls = {
  extraction: [],
  normalize: [],
  categorize: [],
  createImportSession: [],
  setSessionMetadata: [],
  setSessionState: [],
  replaceSessionRows: [],
  getImportSession: [],
  mergeSessionRows: [],
  annotateRowDedupe: [],
  createTransactionsBatch: [],
  buildImportFeedbackCandidates: [],
  evaluateImportRowsForAnomalies: [],
  dbQuery: [],
};

const resetCalls = () => {
  Object.values(calls).forEach((arr) => {
    arr.length = 0;
  });

  createTransactionsBatchImpl = null;
};

let previewSessionResponse = null;
let confirmSessionResponses = [];
let createTransactionsBatchImpl = null;

const extractionStub = {
  extractRowsFromUpload: async (payload) => {
    calls.extraction.push(payload);
    return {
      sourceType: 'csv',
      sourceBank: 'sadapay',
      parserName: 'sadapay_parser',
      detectionConfidence: 0.77,
      usedOcr: true,
      extractionProvider: 'textract',
      pagesProcessed: 2,
      warnings: ['extraction warning', 'duplicate warning'],
      rows: [
        { transaction_date: '2026-03-01', description: 'wallet transfer', amount: 1200, direction: 'debit' },
        { transaction_date: '2026-03-02', description: 'salary', amount: 95000, direction: 'credit' },
      ],
    };
  },
};

const normalizationStub = {
  normalizeExtractedRows: async (payload) => {
    calls.normalize.push(payload);
    return {
      rows: [
        {
          row_index: 0,
          review_payload: { description: 'wallet transfer', amount: 1200, needs_review: true },
          normalized_payload: { description: 'wallet transfer', amount: 1200 },
          extraction_confidence: 0.61,
          needs_review: true,
          dedupe_fingerprint: 'fp-1',
          dedupe_status: 'clear',
          duplicate_reason: null,
          top_predictions: [],
          is_excluded: false,
        },
        {
          row_index: 1,
          review_payload: { description: 'salary', amount: 95000, needs_review: false },
          normalized_payload: { description: 'salary', amount: 95000 },
          extraction_confidence: 0.9,
          needs_review: false,
          dedupe_fingerprint: 'fp-2',
          dedupe_status: 'blocked_exact',
          duplicate_reason: 'Duplicate row detected inside uploaded file',
          top_predictions: [],
          is_excluded: true,
        },
      ],
      warnings: ['normalization warning', 'duplicate warning'],
    };
  },
};

const categorizationStub = {
  enrichRowsWithCategories: async (payload) => {
    calls.categorize.push(payload);
    return {
      rows: payload.rows,
      warnings: ['categorization warning', 'normalization warning'],
    };
  },
};

const sessionStub = {
  createImportSession: async (payload) => {
    calls.createImportSession.push(payload);
    return 'sess-100';
  },
  setSessionMetadata: async (payload) => {
    calls.setSessionMetadata.push(payload);
  },
  setSessionState: async (payload) => {
    calls.setSessionState.push(payload);
  },
  replaceSessionRows: async (payload) => {
    calls.replaceSessionRows.push(payload);
  },
  getImportSession: async (payload) => {
    calls.getImportSession.push(payload);

    if (confirmSessionResponses.length > 0) {
      return confirmSessionResponses.shift();
    }

    return previewSessionResponse;
  },
  mergeSessionRows: async (payload) => {
    calls.mergeSessionRows.push(payload);
  },
};

const dedupeStub = {
  annotateRowDedupe: async ({ row }) => {
    calls.annotateRowDedupe.push({ row });

    if (String(row.description || '').toLowerCase().includes('duplicate')) {
      return {
        dedupe_status: 'blocked_exact',
        duplicate_reason: 'Exact duplicate fingerprint already exists in transactions',
        dedupe_fingerprint: 'dup-blocked',
      };
    }

    return {
      dedupe_status: 'clear',
      duplicate_reason: null,
      dedupe_fingerprint: 'dup-clear',
    };
  },
};

const transactionWriteStub = {
  createTransactionsBatch: async (userId, items) => {
    calls.createTransactionsBatch.push({ userId, items });

    if (typeof createTransactionsBatchImpl === 'function') {
      return createTransactionsBatchImpl(userId, items);
    }

    return {
      total: items.length,
      created_count: items.length,
      failed_count: 0,
      errors: [],
      transactions: items.map((item, index) => ({
        transaction_id: 9000 + index,
        description: item.description,
        amount: item.amount,
      })),
    };
  },
};

const feedbackStub = {
  buildImportFeedbackCandidates: ({ rows }) => {
    calls.buildImportFeedbackCandidates.push({ rows });
    return rows.map((row) => ({
      interactionKind: 'manual_labeling',
      category_final: row.category_final || 'Misc',
      row_index: row.__row_index,
    }));
  },
};

const anomalyStub = {
  evaluateImportRowsForAnomalies: async ({ rows, currency }) => {
    calls.evaluateImportRowsForAnomalies.push({ rows, currency });
    return rows.map((row) => ({
      row_index: row.row_index,
      anomaly_type: 'smoke_anomaly',
      transaction_id: row.transaction.transaction_id,
    }));
  },
};

const dbStub = {
  query: async (sql, params = []) => {
    calls.dbQuery.push({ sql, params });
    return { rows: [{ preferred_currency: 'EUR' }] };
  },
};

require.cache[extractionPath] = { id: extractionPath, filename: extractionPath, loaded: true, exports: extractionStub };
require.cache[normalizationPath] = { id: normalizationPath, filename: normalizationPath, loaded: true, exports: normalizationStub };
require.cache[categorizationPath] = { id: categorizationPath, filename: categorizationPath, loaded: true, exports: categorizationStub };
require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: sessionStub };
require.cache[dedupePath] = { id: dedupePath, filename: dedupePath, loaded: true, exports: dedupeStub };
require.cache[transactionWritePath] = { id: transactionWritePath, filename: transactionWritePath, loaded: true, exports: transactionWriteStub };
require.cache[feedbackPath] = { id: feedbackPath, filename: feedbackPath, loaded: true, exports: feedbackStub };
require.cache[anomalyPath] = { id: anomalyPath, filename: anomalyPath, loaded: true, exports: anomalyStub };
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbStub };

const {
  previewImportSession,
  confirmImportSession,
} = require('../../services/import/importPipelineService');

const testPreviewStateTransitions = async () => {
  resetCalls();

  previewSessionResponse = {
    session: {
      import_session_id: 'sess-100',
      state: 'review_ready',
      source_type: 'csv',
      source_bank: 'sadapay',
      parser_name: 'sadapay_parser',
      detection_confidence: 0.77,
      file_name: 'statement.csv',
      mime_type: 'text/csv',
      warnings: JSON.stringify(['extraction warning', 'normalization warning', 'categorization warning']),
      summary: JSON.stringify({
        uploaded_rows: 2,
        normalized_rows: 2,
        included_rows: 1,
        needs_review_rows: 1,
        used_ocr: true,
      }),
    },
    rows: [
      {
        row_index: 0,
        review_payload: { description: 'wallet transfer' },
        normalized_payload: { description: 'wallet transfer' },
        extraction_confidence: 0.61,
        needs_review: true,
        dedupe_fingerprint: 'fp-1',
        dedupe_status: 'clear',
        duplicate_reason: null,
        top_predictions: '[]',
        is_excluded: false,
      },
      {
        row_index: 1,
        review_payload: { description: 'salary' },
        normalized_payload: { description: 'salary' },
        extraction_confidence: 0.9,
        needs_review: false,
        dedupe_fingerprint: 'fp-2',
        dedupe_status: 'blocked_exact',
        duplicate_reason: 'Duplicate row detected inside uploaded file',
        top_predictions: '[]',
        is_excluded: true,
      },
    ],
  };

  const response = await previewImportSession({
    userId: 55,
    file: {
      originalname: 'statement.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from('a,b\n1,2\n', 'utf-8'),
    },
    bankHint: 'sadapay',
  });

  assert.strictEqual(calls.extraction.length, 1, 'preview should call extraction once');
  assert.strictEqual(calls.normalize.length, 1, 'preview should call normalization once');
  assert.strictEqual(calls.categorize.length, 1, 'preview should call categorization once');
  assert.strictEqual(calls.replaceSessionRows.length, 1, 'preview should persist categorized rows');

  const states = calls.setSessionState.map((item) => item.state);
  assert.deepStrictEqual(
    states,
    ['detected', 'extracted', 'normalized', 'categorized', 'review_ready'],
    'preview should set expected state sequence'
  );

  assert.strictEqual(calls.createImportSession.length, 1, 'preview should create import session before extraction');
  assert.strictEqual(calls.createImportSession[0].state, 'uploaded', 'initial session should be uploaded');

  assert.strictEqual(calls.setSessionMetadata.length, 1, 'preview should persist detected extraction metadata');
  assert.strictEqual(calls.setSessionMetadata[0].sourceType, 'csv', 'session metadata should keep source type');
  assert.strictEqual(calls.setSessionMetadata[0].sourceBank, 'sadapay', 'session metadata should keep source bank');
  assert.strictEqual(calls.setSessionMetadata[0].parserName, 'sadapay_parser', 'session metadata should keep parser name');
  assert.strictEqual(calls.setSessionMetadata[0].detectionConfidence, 0.77, 'session metadata should keep detection confidence');

  assert.strictEqual(calls.extraction[0].userId, 55, 'preview should pass user id to extraction service');
  assert.strictEqual(calls.extraction[0].importSessionId, 'sess-100', 'preview should pass session id to extraction service');
  assert.strictEqual(calls.normalize[0].defaultCurrency, 'EUR', 'preview should pass user preferred currency to normalization');

  const detectedState = calls.setSessionState.find((item) => item.state === 'detected');
  assert.ok(detectedState, 'detected state must be set');
  assert.strictEqual(detectedState.summary.extraction_provider, 'textract', 'detected summary should include extraction provider');
  assert.strictEqual(detectedState.summary.pages_processed, 2, 'detected summary should include pages processed');

  const reviewReady = calls.setSessionState.find((item) => item.state === 'review_ready');
  assert.ok(reviewReady, 'review_ready state must be set');
  assert.strictEqual(reviewReady.summary.uploaded_rows, 2, 'uploaded rows should be tracked');
  assert.strictEqual(reviewReady.summary.included_rows, 1, 'included rows should exclude blocked rows');
  assert.strictEqual(reviewReady.summary.needs_review_rows, 1, 'needs review count should include only included rows');
  assert.strictEqual(reviewReady.summary.extraction_provider, 'textract', 'review summary should include extraction provider');
  assert.strictEqual(reviewReady.summary.pages_processed, 2, 'review summary should include pages processed');

  assert.strictEqual(response.session_id, 'sess-100', 'session id should be returned');
  assert.strictEqual(response.state, 'review_ready', 'response should expose review_ready state');
  assert.ok(Array.isArray(response.warnings), 'response warnings should be parsed as array');
  assert.strictEqual(response.rows.length, 2, 'response should include mapped rows');
};

const testConfirmFlowWithDedupeRecheck = async () => {
  resetCalls();

  const currentSession = {
    session: {
      import_session_id: 'sess-200',
      state: 'review_ready',
      warnings: JSON.stringify(['previous warning']),
      summary: JSON.stringify({ uploaded_rows: 2, extraction_provider: 'textract', pages_processed: 2 }),
    },
    rows: [
      {
        row_index: 0,
        is_excluded: false,
        review_payload: {
          transaction_date: '2026-03-02',
          description: 'Salary from employer',
          merchant: 'Employer',
          amount: 100000,
          direction: 'credit',
          category_final: 'Salary',
          category_touched: true,
          source: 'Bank',
          source_bank: 'myabl',
          status: 'completed',
        },
        normalized_payload: {
          source_import_session_id: 'sess-200',
          source_reference_id: 'ref-1',
        },
        top_predictions: [],
      },
      {
        row_index: 1,
        is_excluded: false,
        review_payload: {
          transaction_date: '2026-03-03',
          description: 'Duplicate utility payment',
          merchant: 'Utility Co',
          amount: 3100,
          direction: 'debit',
          category_final: 'Bills',
          category_touched: true,
          source: 'Bank',
          source_bank: 'myabl',
          status: 'completed',
        },
        normalized_payload: {
          source_import_session_id: 'sess-200',
          source_reference_id: 'ref-2',
        },
        top_predictions: [],
      },
    ],
  };

  const latestSession = {
    session: currentSession.session,
    rows: currentSession.rows,
  };

  confirmSessionResponses = [currentSession, latestSession];

  const response = await confirmImportSession({
    userId: 55,
    sessionId: 'sess-200',
    updates: [
      {
        row_index: 0,
        action: 'update',
        patch: {
          description: 'Salary from employer updated',
          amount: 100500,
          type: 'income',
          transaction_date: 'invalid-date',
          status: 'completed',
        },
      },
    ],
  });

  assert.strictEqual(calls.mergeSessionRows.length, 1, 'confirm should merge incoming row updates');
  assert.strictEqual(calls.mergeSessionRows[0].updates.length, 1, 'one normalized update should be applied');

  const mergedPatch = calls.mergeSessionRows[0].updates[0].patch;
  assert.strictEqual(mergedPatch.type, 'income', 'patch should preserve normalized type');
  assert.strictEqual(mergedPatch.direction, 'credit', 'income patch should force credit direction');
  assert.strictEqual(mergedPatch.amount, 100500, 'patch amount should normalize to absolute positive value');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(mergedPatch, 'transaction_date'), true, 'transaction_date should be preserved in normalized patch when explicitly edited');
  assert.strictEqual(mergedPatch.transaction_date, null, 'invalid edited date should normalize to null so confirm can validation-block it');

  const stateSequence = calls.setSessionState.map((item) => item.state);
  assert.strictEqual(stateSequence[0], 'confirming', 'confirm flow should enter confirming state first');
  assert.strictEqual(stateSequence[stateSequence.length - 1], 'failed', 'blocked duplicate should end in failed state');

  assert.strictEqual(calls.annotateRowDedupe.length, 2, 'dedupe should recheck each confirm candidate row');
  assert.strictEqual(calls.createTransactionsBatch.length, 1, 'accepted rows should be written once');
  assert.strictEqual(calls.createTransactionsBatch[0].items.length, 1, 'blocked duplicate row should not be inserted');

  const createdPayload = calls.createTransactionsBatch[0].items[0];
  assert.strictEqual(createdPayload.description, 'Salary from employer', 'confirm should persist reviewed description');
  assert.strictEqual(createdPayload.merchant, 'Employer', 'confirm should persist reviewed merchant');
  assert.strictEqual(createdPayload.date, '2026-03-02', 'confirm should persist reviewed date');
  assert.strictEqual(createdPayload.category_name, 'Salary', 'confirm should persist reviewed final category');
  assert.strictEqual(createdPayload.source_import_session_id, 'sess-200', 'confirm should keep import session link');
  assert.strictEqual(createdPayload.source_reference_id, 'ref-1', 'confirm should preserve row reference id');

  assert.strictEqual(calls.buildImportFeedbackCandidates.length, 1, 'feedback candidates should be built for successful rows');
  assert.strictEqual(calls.evaluateImportRowsForAnomalies.length, 1, 'anomaly evaluation should run for saved rows');
  assert.strictEqual(calls.evaluateImportRowsForAnomalies[0].currency, 'EUR', 'anomaly evaluation should receive preferred currency');

  assert.strictEqual(response.state, 'failed', 'response should surface failed state when duplicates blocked');
  assert.strictEqual(response.created_count, 1, 'one transaction should be created');
  assert.strictEqual(response.blocked_duplicates, 1, 'one duplicate block should be reported');
  assert.strictEqual(response.validation_blocked, 0, 'no validation blocks expected in this scenario');
  assert.ok(Array.isArray(response.validation_blocks), 'validation blocks should be returned as an array');
  assert.deepStrictEqual(response.validation_blocks, [], 'validation blocks should be empty when all rows are structurally valid');
  assert.ok(Array.isArray(response.created_row_indexes), 'created row indexes should be returned');
  assert.deepStrictEqual(response.created_row_indexes, [0], 'created row indexes should map to successful row indexes');
  assert.ok(Array.isArray(response.errors), 'errors should be returned as an array');
  assert.deepStrictEqual(response.errors, [], 'no persistence errors expected in this scenario');
  assert.strictEqual(response.duplicate_blocks[0].row_index, 1, 'blocked duplicate should reference original row index');
  assert.ok(Array.isArray(response.correction_candidates), 'correction candidates should be returned');
  assert.ok(Array.isArray(response.anomalies), 'anomalies list should be returned');

  const completionCall = calls.setSessionState[calls.setSessionState.length - 1];
  assert.ok(
    Array.isArray(completionCall.warnings) &&
      completionCall.warnings.some((message) => message.includes('Exact duplicate fingerprint already exists')),
    'completion warnings should include dedupe block reason'
  );
};

const testConfirmFlowWithValidationBlocks = async () => {
  resetCalls();

  const currentSession = {
    session: {
      import_session_id: 'sess-210',
      state: 'review_ready',
      warnings: JSON.stringify([]),
      summary: JSON.stringify({ uploaded_rows: 2 }),
    },
    rows: [
      {
        row_index: 0,
        is_excluded: false,
        review_payload: {
          transaction_date: '2026-03-04',
          description: 'Valid grocery purchase',
          merchant: 'Fresh Mart',
          amount: 2200,
          direction: 'debit',
          category_final: 'Groceries',
          category_touched: true,
          source: 'Bank',
          source_bank: 'myabl',
          status: 'completed',
        },
        normalized_payload: {
          source_import_session_id: 'sess-210',
          source_reference_id: 'ref-valid-1',
        },
        top_predictions: [],
      },
      {
        row_index: 1,
        is_excluded: false,
        review_payload: {
          transaction_date: null,
          description: 'Date missing purchase',
          merchant: 'Corner Shop',
          amount: 450,
          direction: 'debit',
          category_final: 'Other',
          category_touched: true,
          source: 'Bank',
          source_bank: 'myabl',
          status: 'completed',
        },
        normalized_payload: {
          source_import_session_id: 'sess-210',
          source_reference_id: 'ref-invalid-1',
        },
        top_predictions: [],
      },
    ],
  };

  const latestSession = {
    session: currentSession.session,
    rows: currentSession.rows,
  };

  confirmSessionResponses = [currentSession, latestSession];

  const response = await confirmImportSession({
    userId: 55,
    sessionId: 'sess-210',
    updates: [],
  });

  assert.strictEqual(calls.annotateRowDedupe.length, 1, 'dedupe should only recheck structurally valid rows');
  assert.strictEqual(calls.createTransactionsBatch.length, 1, 'valid rows should still be persisted');
  assert.strictEqual(calls.createTransactionsBatch[0].items.length, 1, 'only valid rows should be sent to create batch');

  assert.strictEqual(response.state, 'failed', 'validation blocks should keep completion state failed');
  assert.strictEqual(response.total_candidates, 2, 'total candidates should include blocked validation rows');
  assert.strictEqual(response.accepted_candidates, 1, 'accepted candidates should only include rows that passed structural validation');
  assert.strictEqual(response.created_count, 1, 'one valid row should be created');
  assert.strictEqual(response.validation_blocked, 1, 'exactly one row should be validation blocked');
  assert.strictEqual(response.validation_blocks.length, 1, 'one validation block should be returned');
  assert.deepStrictEqual(
    response.validation_blocks[0],
    {
      row_index: 1,
      field: 'transaction_date',
      reason: 'Missing/invalid date',
    },
    'validation block should map to original row index and date field'
  );

  assert.deepStrictEqual(response.created_row_indexes, [0], 'created row indexes should only include successful rows');

  const completionCall = calls.setSessionState[calls.setSessionState.length - 1];
  assert.strictEqual(completionCall.summary.validation_blocked, 1, 'completion summary should include validation blocked count');
  assert.ok(
    Array.isArray(completionCall.warnings) && completionCall.warnings.some((message) => message.includes('Row 2: Missing/invalid date')),
    'completion warnings should include date validation reason'
  );
};

const testConfirmFlowMapsPersistenceErrorRowIndexes = async () => {
  resetCalls();

  createTransactionsBatchImpl = async (userId, items) => {
    assert.strictEqual(userId, 55, 'batch writer should receive user id');

    return {
      total: items.length,
      created_count: 1,
      failed_count: 1,
      errors: [
        {
          index: 1,
          error: 'date is required',
          statusCode: 400,
        },
      ],
      transactions: [
        {
          transaction_id: 9100,
          description: items[0].description,
          amount: items[0].amount,
        },
      ],
    };
  };

  const currentSession = {
    session: {
      import_session_id: 'sess-220',
      state: 'review_ready',
      warnings: JSON.stringify([]),
      summary: JSON.stringify({ uploaded_rows: 2 }),
    },
    rows: [
      {
        row_index: 4,
        is_excluded: false,
        review_payload: {
          transaction_date: '2026-03-05',
          description: 'Internet bill',
          merchant: 'ISP Ltd',
          amount: 5400,
          direction: 'debit',
          category_final: 'Bills',
          category_touched: true,
          source: 'Bank',
          source_bank: 'myabl',
          status: 'completed',
        },
        normalized_payload: {
          source_import_session_id: 'sess-220',
          source_reference_id: 'ref-bill-1',
        },
        top_predictions: [],
      },
      {
        row_index: 8,
        is_excluded: false,
        review_payload: {
          transaction_date: '2026-03-06',
          description: 'Gym membership',
          merchant: 'Fitness Hub',
          amount: 3200,
          direction: 'debit',
          category_final: 'Subscriptions',
          category_touched: true,
          source: 'Bank',
          source_bank: 'myabl',
          status: 'completed',
        },
        normalized_payload: {
          source_import_session_id: 'sess-220',
          source_reference_id: 'ref-gym-1',
        },
        top_predictions: [],
      },
    ],
  };

  const latestSession = {
    session: currentSession.session,
    rows: currentSession.rows,
  };

  confirmSessionResponses = [currentSession, latestSession];

  const response = await confirmImportSession({
    userId: 55,
    sessionId: 'sess-220',
    updates: [],
  });

  assert.strictEqual(response.failed_count, 1, 'one persistence failure should be surfaced');
  assert.strictEqual(response.errors.length, 1, 'persistence error list should be returned');
  assert.strictEqual(response.errors[0].index, 1, 'error index should be preserved from batch writer');
  assert.strictEqual(response.errors[0].row_index, 8, 'error should map to original import row index');
  assert.deepStrictEqual(response.created_row_indexes, [4], 'created row indexes should map to successful original row index');
};

const testConfirmFlowChunksLargeWritesOverBatchLimit = async () => {
  resetCalls();

  const rowCount = 685;

  const rows = Array.from({ length: rowCount }, (_, index) => ({
    row_index: index,
    is_excluded: false,
    review_payload: {
      transaction_date: '2026-03-07',
      description: `Bulk import row ${index + 1}`,
      merchant: 'Bulk Merchant',
      amount: 100 + index,
      direction: 'debit',
      category_final: 'Other',
      category_touched: true,
      source: 'Bank',
      source_bank: 'myabl',
      status: 'completed',
    },
    normalized_payload: {
      source_import_session_id: 'sess-230',
      source_reference_id: `ref-bulk-${index + 1}`,
    },
    top_predictions: [],
  }));

  const currentSession = {
    session: {
      import_session_id: 'sess-230',
      state: 'review_ready',
      warnings: JSON.stringify([]),
      summary: JSON.stringify({ uploaded_rows: rowCount }),
    },
    rows,
  };

  const latestSession = {
    session: currentSession.session,
    rows: currentSession.rows,
  };

  confirmSessionResponses = [currentSession, latestSession];

  const response = await confirmImportSession({
    userId: 55,
    sessionId: 'sess-230',
    updates: [],
  });

  assert.strictEqual(calls.createTransactionsBatch.length, 2, 'large confirm should be chunked into two batch writes');
  assert.strictEqual(calls.createTransactionsBatch[0].items.length, 500, 'first chunk should use max batch size limit');
  assert.strictEqual(calls.createTransactionsBatch[1].items.length, 185, 'second chunk should include remaining rows');

  assert.strictEqual(response.state, 'completed', 'large confirm without errors should complete successfully');
  assert.strictEqual(response.accepted_candidates, rowCount, 'accepted candidates should include all dedupe-cleared rows');
  assert.strictEqual(response.created_count, rowCount, 'created count should include all chunked inserts');
  assert.strictEqual(response.failed_count, 0, 'no failures expected for happy-path chunked insert');
  assert.strictEqual(response.created_row_indexes.length, rowCount, 'created row indexes should include each persisted row');
  assert.strictEqual(response.created_row_indexes[0], 0, 'first created row index should be preserved');
  assert.strictEqual(response.created_row_indexes[rowCount - 1], rowCount - 1, 'last created row index should be preserved');
};

const testConfirmFlowMapsPersistenceErrorsAcrossChunks = async () => {
  resetCalls();

  const rowCount = 501;
  let batchCallCount = 0;

  createTransactionsBatchImpl = async (_userId, items) => {
    batchCallCount += 1;

    if (batchCallCount === 1) {
      return {
        total: items.length,
        created_count: items.length,
        failed_count: 0,
        errors: [],
        transactions: items.map((item, index) => ({
          transaction_id: 9200 + index,
          description: item.description,
          amount: item.amount,
        })),
      };
    }

    return {
      total: items.length,
      created_count: 0,
      failed_count: 1,
      errors: [
        {
          index: 0,
          error: 'amount validation failed',
          statusCode: 400,
        },
      ],
      transactions: [],
    };
  };

  const rows = Array.from({ length: rowCount }, (_, index) => ({
    row_index: index,
    is_excluded: false,
    review_payload: {
      transaction_date: '2026-03-08',
      description: `Chunked row ${index + 1}`,
      merchant: 'Chunk Merchant',
      amount: 200 + index,
      direction: 'debit',
      category_final: 'Other',
      category_touched: true,
      source: 'Bank',
      source_bank: 'myabl',
      status: 'completed',
    },
    normalized_payload: {
      source_import_session_id: 'sess-240',
      source_reference_id: `ref-chunk-${index + 1}`,
    },
    top_predictions: [],
  }));

  const currentSession = {
    session: {
      import_session_id: 'sess-240',
      state: 'review_ready',
      warnings: JSON.stringify([]),
      summary: JSON.stringify({ uploaded_rows: rowCount }),
    },
    rows,
  };

  const latestSession = {
    session: currentSession.session,
    rows: currentSession.rows,
  };

  confirmSessionResponses = [currentSession, latestSession];

  const response = await confirmImportSession({
    userId: 55,
    sessionId: 'sess-240',
    updates: [],
  });

  assert.strictEqual(calls.createTransactionsBatch.length, 2, 'chunked flow should call batch writer twice');
  assert.strictEqual(response.failed_count, 1, 'one failure from second chunk should be surfaced');
  assert.strictEqual(response.errors.length, 1, 'one persistence error should be returned');
  assert.strictEqual(response.errors[0].index, 500, 'error index should be remapped to global accepted-row index');
  assert.strictEqual(response.errors[0].row_index, 500, 'error should map to original row index across chunks');
  assert.strictEqual(response.created_count, 500, 'created count should aggregate successful chunked inserts');
  assert.strictEqual(response.created_row_indexes.length, 500, 'created rows should exclude failed global index');
  assert.strictEqual(response.created_row_indexes[0], 0, 'first created row index should remain intact');
  assert.strictEqual(response.created_row_indexes[499], 499, 'last created row index should be final successful row');
};

(async () => {
  try {
    await testPreviewStateTransitions();
    await testConfirmFlowWithDedupeRecheck();
    await testConfirmFlowWithValidationBlocks();
    await testConfirmFlowMapsPersistenceErrorRowIndexes();
    await testConfirmFlowChunksLargeWritesOverBatchLimit();
    await testConfirmFlowMapsPersistenceErrorsAcrossChunks();

    console.log('importPipelineService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('importPipelineService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    delete require.cache[require.resolve('../../services/import/importPipelineService')];
    delete require.cache[extractionPath];
    delete require.cache[normalizationPath];
    delete require.cache[categorizationPath];
    delete require.cache[sessionPath];
    delete require.cache[dedupePath];
    delete require.cache[transactionWritePath];
    delete require.cache[feedbackPath];
    delete require.cache[anomalyPath];
    delete require.cache[dbPath];
  }
})();
