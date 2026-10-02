const axios = require('axios');
const db = require('../db/db');
const {
  previewImportSession,
  confirmImportSession,
} = require('../services/import/importPipelineService');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const normalizeCategoryLabel = (value) => (typeof value === 'string' ? value.trim() : '');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 15000,
});

const createCsvFixtureBuffer = ({ runTag }) => {
  const safeTag = String(runTag || Date.now());
  const csv = [
    'Date,Merchant,Description,Amount,Direction,ReferenceId',
    `2026-03-01,K-ELECTRIC ${safeTag},K-ELECTRIC Bill Payment ${safeTag},-1250.00,debit,SMK-${safeTag}-001`,
    `,NayaPay ${safeTag},RAAST P2P Missing Date ${safeTag},-450.00,debit,SMK-${safeTag}-002`,
  ].join('\n');

  return Buffer.from(csv, 'utf-8');
};

const pickUser = async () => {
  const userResult = await db.query(
    `SELECT user_id
     FROM users
     ORDER BY user_id ASC
     LIMIT 1`
  );

  if (!userResult.rows[0]) {
    throw new Error('No users available for import smoke test');
  }

  return Number(userResult.rows[0].user_id);
};

const ensureTextractConfig = () => {
  const missing = [];

  if (!process.env.AWS_REGION && !process.env.AWS_DEFAULT_REGION) missing.push('AWS_REGION');
  if (!process.env.TEXTRACT_S3_BUCKET) missing.push('TEXTRACT_S3_BUCKET');

  if (missing.length > 0) {
    throw new Error(`Missing required Textract configuration: ${missing.join(', ')}`);
  }

  return {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    bucket: process.env.TEXTRACT_S3_BUCKET,
    provider: process.env.IMPORT_DOCUMENT_PROVIDER || 'textract',
  };
};

const ensureMlHealth = async () => {
  const health = await mlClient.get('/health');
  assert(health.status === 200, 'ML health endpoint returned non-200 status');

  return {
    status: health.data?.status || 'unknown',
    model_version: health.data?.model_version || null,
    model_loaded: Boolean(health.data?.model_loaded),
  };
};

const runCsvPreview = async ({ userId }) => {
  const runTag = Date.now();
  const csvBuffer = createCsvFixtureBuffer({ runTag });
  const csvFile = {
    originalname: 'smoke-statement.csv',
    mimetype: 'text/csv',
    size: csvBuffer.length,
    buffer: csvBuffer,
  };

  const preview = await previewImportSession({
    userId,
    file: csvFile,
    bankHint: 'sadapay',
    correlationId: `smoke-csv-${runTag}`,
  });

  assert(preview && typeof preview === 'object', 'CSV preview payload missing');
  assert(preview.session_id, 'CSV preview session_id missing');
  assert(Array.isArray(preview.rows), 'CSV preview rows must be array');
  assert(preview.rows.length > 0, 'CSV preview produced no rows');
  assert(preview.extraction_provider === 'legacy', 'CSV preview should use legacy extraction provider');

  const reviewedDates = preview.rows
    .map((row) => row?.review_payload?.transaction_date)
    .filter((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));

  assert(reviewedDates.length >= 1, 'CSV preview should include at least one normalized date row');

  return preview;
};

const runPdfExtractionProbe = async () => {
  const response = await mlClient.post('/ml/extract/statement-fixture', {
    fixture_name: 'line_fallback.json',
    source_type: 'pdf',
    source_bank: 'sadapay',
  });

  assert(response.status === 200, 'Document probe extraction returned non-200 status');
  assert(Array.isArray(response.data?.rows), 'Document probe rows must be array');
  assert(response.data.rows.length >= 2, 'Document probe should return at least two reconstructed rows');
  assert(response.data.extraction_provider === 'textract', 'Document probe should report textract provider');
  assert(response.data.parser_name === 'textract_statement_adapter', 'Document probe should use textract adapter parser');

  const first = response.data.rows[0];
  assert(first.transaction_date === '2026-03-01', 'Document probe should preserve first reconstructed date');
  assert(Number(first.amount) === 2200, 'Document probe should reconstruct first row amount');

  return {
    parser_name: response.data.parser_name,
    extraction_provider: response.data.extraction_provider,
    pages_processed: response.data.pages_processed ?? null,
    row_count: response.data.rows.length,
  };
};

const confirmCsvPreview = async ({ userId, preview, expectedCategory }) => {
  const includedRows = preview.rows.filter((row) => !row.is_excluded);
  assert(includedRows.length > 0, 'CSV preview has no rows to confirm');

  const validDateRows = includedRows.filter((row) => {
    const value = row.review_payload?.transaction_date;
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  });
  const invalidDateRows = includedRows.filter((row) => {
    const value = row.review_payload?.transaction_date;
    return !value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value));
  });

  assert(validDateRows.length >= 1, 'CSV preview fixture should include at least one valid-date row');
  assert(invalidDateRows.length >= 1, 'CSV preview fixture should include at least one invalid-date row');

  const validRow = validDateRows[0];
  const expectedPersistedDate = validRow.review_payload.transaction_date;

  const validRowPreviewCategory = normalizeCategoryLabel(
    validRow.review_payload?.category_final ||
      validRow.review_payload?.extracted_category ||
      validRow.review_payload?.ml_predicted_category
  );
  assert(validRowPreviewCategory, 'valid fixture row should carry a preview category label');
  if (expectedCategory) {
    assert(
      validRowPreviewCategory.toLowerCase() === String(expectedCategory).toLowerCase(),
      `valid fixture row category should resolve to ${expectedCategory}, got ${validRowPreviewCategory}`
    );
  }

  const baseAmount = Number(validRow.review_payload?.amount || 0);
  const safeAmount = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 1250;

  const updates = [
    {
      row_index: validRow.row_index,
      action: 'update',
      patch: {
        amount: safeAmount,
        status: 'completed',
        notes: 'phase8 import textract smoke',
      },
    },
  ];

  const confirm = await confirmImportSession({
    userId,
    sessionId: preview.session_id,
    updates,
    correlationId: `smoke-confirm-${Date.now()}`,
  });

  assert(confirm && typeof confirm === 'object', 'confirm payload missing');
  assert(confirm.created_count >= 1, 'confirm should create at least one transaction');
  assert(Array.isArray(confirm.errors), 'confirm errors must be array');
  assert(Number(confirm.validation_blocked || 0) >= 1, 'confirm should report at least one validation-blocked row for invalid date fixture');
  assert(Array.isArray(confirm.validation_blocks), 'confirm validation blocks must be array');

  const dateValidationBlocks = confirm.validation_blocks.filter(
    (item) => item && item.field === 'transaction_date'
  );
  assert(dateValidationBlocks.length >= 1, 'confirm should include transaction_date validation block');

  const blockedIndexes = new Set(dateValidationBlocks.map((item) => Number(item.row_index)).filter((value) => Number.isInteger(value)));
  assert(invalidDateRows.some((row) => blockedIndexes.has(Number(row.row_index))), 'validation block should reference invalid-date fixture row');

  return {
    confirm,
    expectedPersistedDate,
    expectedPersistedCategory: validRowPreviewCategory,
    validRowIndex: validRow.row_index,
    invalidRowIndexes: invalidDateRows.map((row) => row.row_index),
  };
};

const verifyPersistedRows = async ({
  userId,
  confirm,
  expectedPersistedDate,
  expectedPersistedCategory,
  validRowIndex,
  invalidRowIndexes,
}) => {
  const txResult = await db.query(
    `SELECT
       t.transaction_id,
       t.user_id,
       t.date,
       t.description,
       t.merchant,
       t.amount,
       t.type,
       t.source,
       t.notes,
       t.source_import_session_id,
       t.category_id,
       c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.category_id = t.category_id
     WHERE t.user_id = $1
       AND t.source_import_session_id = $2
     ORDER BY t.transaction_id ASC`,
    [userId, confirm.session_id]
  );

  const rows = txResult.rows || [];
  assert(rows.length === confirm.created_count, 'persisted rows count should match confirm created_count');

  const normalizeDateOnly = (value) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const asDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(asDate.getTime())) return null;

    const year = asDate.getFullYear();
    const month = String(asDate.getMonth() + 1).padStart(2, '0');
    const day = String(asDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  rows.forEach((row, index) => {
    assert(Number(row.user_id) === userId, `persisted row ${index} owner mismatch`);

    const normalizedDate = normalizeDateOnly(row.date);
    assert(typeof normalizedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate), `persisted row ${index} date invalid`);

    assert(typeof row.description === 'string' && row.description.trim(), `persisted row ${index} description missing`);
    assert(typeof row.amount === 'string' || typeof row.amount === 'number', `persisted row ${index} amount missing`);
    assert(row.type === 'income' || row.type === 'expense', `persisted row ${index} type invalid`);
  });

  assert(rows.length >= 1, 'at least one row should persist from valid fixture row');
  assert(rows.some((row) => normalizeDateOnly(row.date) === expectedPersistedDate), 'persisted date should exactly match reviewed valid-date row');

  if (expectedPersistedCategory) {
    const normalizedExpectedCategory = String(expectedPersistedCategory).trim().toLowerCase();
    assert(
      rows.some((row) => normalizeCategoryLabel(row.category_name).toLowerCase() === normalizedExpectedCategory),
      `persisted category should exactly match reviewed category ${expectedPersistedCategory}`
    );
  }

  const createdRowIndexes = Array.isArray(confirm.created_row_indexes) ? confirm.created_row_indexes : [];
  assert(createdRowIndexes.includes(validRowIndex), 'confirm created_row_indexes should include valid fixture row index');
  assert(
    !createdRowIndexes.some((index) => invalidRowIndexes.includes(index)),
    'invalid-date fixture rows must not appear in created_row_indexes'
  );

  const apiResult = await db.query(
    `SELECT transaction_id, date, description, merchant, amount, type
     FROM transactions
     WHERE user_id = $1
       AND source_import_session_id = $2
     ORDER BY transaction_id ASC`,
    [userId, confirm.session_id]
  );

  assert(apiResult.rows.length === rows.length, 'API/DB verification set mismatch');

  return rows.map((row) => ({
    transaction_id: Number(row.transaction_id),
    date: normalizeDateOnly(row.date),
    description: row.description,
    merchant: row.merchant,
    amount: Number(row.amount),
    type: row.type,
    category_id: Number.isInteger(Number(row.category_id)) ? Number(row.category_id) : null,
    category_name: normalizeCategoryLabel(row.category_name) || null,
  }));
};

const runFailurePathProbe = async ({ userId }) => {
  let message = null;

  try {
    await previewImportSession({
      userId,
      file: {
        originalname: 'smoke-unsupported.txt',
        mimetype: 'text/plain',
        size: 22,
        buffer: Buffer.from('unsupported content', 'utf-8'),
      },
      correlationId: `smoke-fail-${Date.now()}`,
    });
  } catch (error) {
    message = error?.message || String(error);
  }

  assert(message && /unsupported file type/i.test(message), 'failure path should return unsupported file type error');
  return message;
};

const run = async () => {
  const userId = await pickUser();
  const config = ensureTextractConfig();
  const mlHealth = await ensureMlHealth();

  const csvPreview = await runCsvPreview({ userId });
  const pdfProbe = await runPdfExtractionProbe();
  const confirmResult = await confirmCsvPreview({
    userId,
    preview: csvPreview,
    expectedCategory: 'Bills',
  });
  const persistedRows = await verifyPersistedRows({
    userId,
    confirm: confirmResult.confirm,
    expectedPersistedDate: confirmResult.expectedPersistedDate,
    expectedPersistedCategory: confirmResult.expectedPersistedCategory,
    validRowIndex: confirmResult.validRowIndex,
    invalidRowIndexes: confirmResult.invalidRowIndexes,
  });
  const failureProbe = await runFailurePathProbe({ userId });

  return {
    user_id: userId,
    textract_config: config,
    ml_health: mlHealth,
    csv_preview: {
      session_id: csvPreview.session_id,
      state: csvPreview.state,
      extraction_provider: csvPreview.extraction_provider,
      row_count: csvPreview.rows.length,
    },
    pdf_probe: pdfProbe,
    confirm: {
      session_id: confirmResult.confirm.session_id,
      created_count: confirmResult.confirm.created_count,
      failed_count: confirmResult.confirm.failed_count,
      blocked_duplicates: confirmResult.confirm.blocked_duplicates,
      validation_blocked: confirmResult.confirm.validation_blocked,
    },
    persisted_rows: persistedRows,
    failure_probe: {
      message: failureProbe,
    },
  };
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 8 import textract smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Phase 8 import textract smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { run };
