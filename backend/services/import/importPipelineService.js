const db = require('../../db/db');
const { extractRowsFromUpload } = require('./extractionService');
const { normalizeExtractedRows } = require('./normalizationService');
const { enrichRowsWithCategories } = require('./categorizationService');
const {
  createImportSession,
  setSessionState,
  setSessionMetadata,
  replaceSessionRows,
  getImportSession,
  mergeSessionRows,
} = require('./sessionService');
const { annotateRowDedupe } = require('./dedupeService');
const {
  createTransactionsBatch,
  MAX_BATCH_SIZE: TRANSACTION_BATCH_SIZE_LIMIT = 500,
} = require('../transactions/transactionWriteService');
const { buildImportFeedbackCandidates } = require('../transactions/feedbackLearningService');
const { evaluateImportRowsForAnomalies } = require('../anomalies/anomalyOrchestratorService');
const { AMBIGUITY_MARGIN } = require('../../config/mlConfig');
const { logServiceEvent, makeCorrelationId } = require('../observability/eventLogger');

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

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseSessionWarnings = (sessionWarnings) => {
  if (Array.isArray(sessionWarnings)) return sessionWarnings;

  if (typeof sessionWarnings === 'string') {
    try {
      const parsed = JSON.parse(sessionWarnings);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const parseSessionSummary = (sessionSummary) => {
  if (sessionSummary && typeof sessionSummary === 'object' && !Array.isArray(sessionSummary)) {
    return sessionSummary;
  }

  if (typeof sessionSummary === 'string') {
    try {
      const parsed = JSON.parse(sessionSummary);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
};

const mergeUniqueWarnings = (...warningLists) => {
  const combined = [];
  const seen = new Set();

  warningLists.forEach((warnings) => {
    if (!Array.isArray(warnings)) return;

    warnings.forEach((warning) => {
      const text = toTrimmedString(warning);
      if (!text) return;
      if (seen.has(text)) return;
      seen.add(text);
      combined.push(text);
    });
  });

  return combined;
};

const chunkArray = (items, chunkSize) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const normalizedChunkSize = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 1;
  const chunks = [];

  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }

  return chunks;
};

const saveTransactionsInChunks = async ({ userId, items, chunkSize = TRANSACTION_BATCH_SIZE_LIMIT }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      total: 0,
      created_count: 0,
      failed_count: 0,
      errors: [],
      transactions: [],
    };
  }

  const chunks = chunkArray(items, chunkSize);
  const transactions = [];
  const errors = [];
  let createdCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (const chunk of chunks) {
    const chunkStartIndex = processedCount;
    const chunkResult = await createTransactionsBatch(userId, chunk);

    createdCount += Number(chunkResult?.created_count) || 0;
    failedCount += Number(chunkResult?.failed_count) || 0;

    if (Array.isArray(chunkResult?.transactions)) {
      transactions.push(...chunkResult.transactions);
    }

    if (Array.isArray(chunkResult?.errors) && chunkResult.errors.length > 0) {
      chunkResult.errors.forEach((errorItem) => {
        const localIndex = Number(errorItem?.index);
        const mappedIndex = Number.isInteger(localIndex) && localIndex >= 0
          ? chunkStartIndex + localIndex
          : null;

        errors.push({
          ...errorItem,
          index: mappedIndex,
        });
      });
    }

    processedCount += chunk.length;
  }

  return {
    total: items.length,
    created_count: createdCount,
    failed_count: failedCount,
    errors,
    transactions,
  };
};

const buildDateFromParts = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const normalizeToDateOnly = (value) => {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return buildDateFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s|T|$)/);
  if (slashMatch) {
    const partA = Number(slashMatch[1]);
    const partB = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;

    let day;
    let month;

    if (partA > 12 && partB <= 12) {
      day = partA;
      month = partB;
    } else if (partB > 12 && partA <= 12) {
      day = partB;
      month = partA;
    } else {
      day = partA;
      month = partB;
    }

    const normalized = buildDateFromParts(year, month, day);
    if (normalized) return normalized;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return buildDateFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};

const hasOwn = (obj, key) => Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));

const pickReviewedField = (review, canonical, reviewField, canonicalField = reviewField) => {
  if (hasOwn(review, reviewField)) {
    return review[reviewField];
  }

  return canonical?.[canonicalField];
};

const normalizeRowPatch = (patch = {}) => {
  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'transaction_date')) {
    const normalizedDate = normalizeToDateOnly(patch.transaction_date);
    normalized.transaction_date = normalizedDate;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
    normalized.description = toTrimmedString(patch.description);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'merchant')) {
    normalized.merchant = toTrimmedString(patch.merchant);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'amount')) {
    const amount = Number(patch.amount);
    if (Number.isFinite(amount) && amount > 0) {
      normalized.amount = Math.abs(amount);
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'type')) {
    const type = toTrimmedString(patch.type).toLowerCase();
    if (type === 'income' || type === 'expense') {
      normalized.type = type;
      normalized.direction = type === 'income' ? 'credit' : 'debit';
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'category_final')) {
    normalized.category_final = toTrimmedString(patch.category_final) || null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'category_touched')) {
    normalized.category_touched = Boolean(patch.category_touched);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    const status = toTrimmedString(patch.status).toLowerCase();
    if (status === 'completed' || status === 'pending') {
      normalized.status = status;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'source')) {
    normalized.source = toTrimmedString(patch.source) || 'Bank';
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'notes')) {
    normalized.notes = toTrimmedString(patch.notes) || null;
  }

  return normalized;
};

const toSessionResponse = ({ session, rows }) => {
  const warnings = parseSessionWarnings(session.warnings);
  const summary = parseSessionSummary(session.summary);
  const extractionProvider =
    typeof summary.extraction_provider === 'string' && summary.extraction_provider.trim()
      ? summary.extraction_provider.trim()
      : null;
  const pagesProcessed = Number.isFinite(Number(summary.pages_processed))
    ? Number(summary.pages_processed)
    : null;

  const mappedRows = rows.map((row) => ({
    row_index: row.row_index,
    review_payload: row.review_payload,
    normalized_payload: row.normalized_payload,
    extraction_confidence: row.extraction_confidence,
    needs_review: row.needs_review,
    dedupe_fingerprint: row.dedupe_fingerprint,
    dedupe_status: row.dedupe_status,
    duplicate_reason: row.duplicate_reason,
    top_predictions: Array.isArray(row.top_predictions)
      ? row.top_predictions
      : (() => {
          try {
            return JSON.parse(row.top_predictions || '[]');
          } catch {
            return [];
          }
        })(),
    is_excluded: row.is_excluded,
  }));

  return {
    session_id: session.import_session_id,
    state: session.state,
    source_type: session.source_type,
    source_bank: session.source_bank,
    parser_name: session.parser_name,
    detection_confidence:
      session.detection_confidence === null || session.detection_confidence === undefined
        ? null
        : Number(session.detection_confidence),
    extraction_provider: extractionProvider,
    pages_processed: pagesProcessed,
    file_name: session.file_name,
    mime_type: session.mime_type,
    warnings,
    summary,
    rows: mappedRows,
  };
};

const previewImportSession = async ({ userId, file, bankHint, correlationId = makeCorrelationId() }) => {
  const startedAt = Date.now();

  try {
    const sessionId = await createImportSession({
      userId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sourceType: 'unknown',
      sourceBank: 'unknown',
      parserName: null,
      detectionConfidence: null,
      state: 'uploaded',
      warnings: [],
      summary: {},
    });

    const extraction = await extractRowsFromUpload({
      file,
      bankHint,
      correlationId,
      userId,
      importSessionId: sessionId,
    });

    const initialSummary = {
      uploaded_rows: extraction.rows.length,
      used_ocr: extraction.usedOcr,
      extraction_provider: extraction.extractionProvider || null,
      pages_processed: extraction.pagesProcessed,
    };

    await setSessionMetadata({
      sessionId,
      sourceType: extraction.sourceType,
      sourceBank: extraction.sourceBank,
      parserName: extraction.parserName,
      detectionConfidence: extraction.detectionConfidence,
    });

    await setSessionState({
      sessionId,
      state: 'detected',
      warnings: extraction.warnings || [],
      summary: initialSummary,
    });

    await setSessionState({ sessionId, state: 'extracted' });

    const preferredCurrency = await getUserPreferredCurrency(userId);

    const normalized = await normalizeExtractedRows({
      userId,
      importSessionId: sessionId,
      sourceType: extraction.sourceType,
      sourceBank: extraction.sourceBank,
      rows: extraction.rows,
      defaultCurrency: preferredCurrency,
    });

    const normalizedWarnings = mergeUniqueWarnings(extraction.warnings, normalized.warnings);

    await setSessionState({
      sessionId,
      state: 'normalized',
      warnings: normalizedWarnings,
    });

    const categorized = await enrichRowsWithCategories({
      userId,
      rows: normalized.rows,
      correlationId,
    });

    const categorizedWarnings = mergeUniqueWarnings(normalizedWarnings, categorized.warnings);

    await setSessionState({
      sessionId,
      state: 'categorized',
      warnings: categorizedWarnings,
    });

    await replaceSessionRows({
      sessionId,
      rows: categorized.rows,
    });

    const includedRows = categorized.rows.filter((row) => !row.is_excluded);
    const needsReviewCount = includedRows.filter((row) => row.needs_review).length;

    await setSessionState({
      sessionId,
      state: 'review_ready',
      summary: {
        uploaded_rows: extraction.rows.length,
        normalized_rows: categorized.rows.length,
        included_rows: includedRows.length,
        needs_review_rows: needsReviewCount,
        used_ocr: extraction.usedOcr,
        extraction_provider: extraction.extractionProvider || null,
        pages_processed: extraction.pagesProcessed,
      },
      warnings: categorizedWarnings,
    });

    const fullSession = await getImportSession({ userId, sessionId });
    if (!fullSession) {
      const err = new Error('Import session was created but could not be reloaded');
      err.statusCode = 500;
      throw err;
    }

    logServiceEvent({
      service: 'import.pipeline',
      operation: 'preview_import_session',
      status: 'ok',
      userId,
      sessionId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        source_type: extraction.sourceType,
        source_bank: extraction.sourceBank,
        parser_name: extraction.parserName,
        extraction_provider: extraction.extractionProvider,
        pages_processed: extraction.pagesProcessed,
        row_count: categorized.rows.length,
        included_rows: includedRows.length,
        needs_review_rows: needsReviewCount,
        warning_count: categorizedWarnings.length,
      },
    });

    return toSessionResponse(fullSession);
  } catch (err) {
    logServiceEvent({
      service: 'import.pipeline',
      operation: 'preview_import_session',
      status: 'error',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        file_name: file?.originalname || null,
        mime_type: file?.mimetype || null,
      },
    });

    throw err;
  }
};

const getImportSessionForUser = async ({ userId, sessionId }) => {
  const fullSession = await getImportSession({ userId, sessionId });

  if (!fullSession) {
    const err = new Error('Import session not found');
    err.statusCode = 404;
    throw err;
  }

  return toSessionResponse(fullSession);
};

const buildConfirmInputRows = ({ rows }) => {
  const transactions = [];
  const validationBlocks = [];

  for (const row of rows) {
    if (row.is_excluded) continue;

    const review = row.review_payload || {};
    const canonical = row.normalized_payload || review.canonical_payload || {};
    const rowIndex = Number.isInteger(Number(row.row_index)) ? Number(row.row_index) : null;

    const description = toTrimmedString(
      pickReviewedField(review, canonical, 'description')
    );
    if (!description) {
      validationBlocks.push({
        row_index: rowIndex,
        field: 'description',
        reason: 'Missing description',
      });
      continue;
    }

    const amount = Number(pickReviewedField(review, canonical, 'amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      validationBlocks.push({
        row_index: rowIndex,
        field: 'amount',
        reason: 'Missing/invalid amount',
      });
      continue;
    }

    const direction = toTrimmedString(
      pickReviewedField(review, canonical, 'direction', 'type')
    ).toLowerCase();
    const type = direction === 'credit' || direction === 'income' ? 'income' : 'expense';

    const date = normalizeToDateOnly(
      pickReviewedField(review, canonical, 'transaction_date', 'date')
    );

    if (!date) {
      validationBlocks.push({
        row_index: rowIndex,
        field: 'transaction_date',
        reason: 'Missing/invalid date',
      });
      continue;
    }

    const merchant = toTrimmedString(
      pickReviewedField(review, canonical, 'merchant')
    );

    const topPredictions = Array.isArray(row.top_predictions)
      ? row.top_predictions
      : Array.isArray(review.top_predictions)
        ? review.top_predictions
        : Array.isArray(canonical.top_predictions)
          ? canonical.top_predictions
          : [];

    const categoryFinal = toTrimmedString(
      pickReviewedField(review, canonical, 'category_final', 'category_name')
    ) || null;
    const categoryPredicted = toTrimmedString(
      pickReviewedField(review, canonical, 'ml_predicted_category') ||
      pickReviewedField(review, canonical, 'extracted_category')
    ) || null;

    const mlMargin = Number(pickReviewedField(review, canonical, 'ml_margin'));
    const effectiveMargin = Number.isFinite(mlMargin)
      ? mlMargin
      : topPredictions.length > 1
        ? Number(topPredictions[0]?.confidence || 0) - Number(topPredictions[1]?.confidence || 0)
        : null;

    const mlAmbiguousRaw = pickReviewedField(review, canonical, 'ml_ambiguous');
    const mlAmbiguous =
      typeof mlAmbiguousRaw === 'boolean'
        ? mlAmbiguousRaw
        : Number.isFinite(effectiveMargin)
          ? effectiveMargin < AMBIGUITY_MARGIN
          : false;

    const confidence = Number(pickReviewedField(review, canonical, 'ml_confidence'));
    const mlConfidence = Number.isFinite(confidence) ? confidence : null;

    const notesValue = pickReviewedField(review, canonical, 'notes');
    const statusValue = pickReviewedField(review, canonical, 'status');
    const sourceValue = pickReviewedField(review, canonical, 'source');
    const sourceBankValue = pickReviewedField(review, canonical, 'source_bank', 'source');
    const referenceIdValue = pickReviewedField(review, canonical, 'reference_id', 'source_reference_id');

    transactions.push({
      description,
      merchant: merchant || null,
      amount: Math.abs(amount),
      type,
      date,
      ...(categoryFinal ? {} : { category_id: canonical.category_id ?? null }),
      category_name: categoryFinal,
      notes: notesValue ?? null,
      status: toTrimmedString(statusValue || 'completed').toLowerCase() || 'completed',
      source: toTrimmedString(sourceValue || 'Bank') || 'Bank',
      source_import_session_id: canonical.source_import_session_id,
      source_reference_id: toTrimmedString(referenceIdValue) || null,
      dedupe_fingerprint: row.dedupe_fingerprint || canonical.dedupe_fingerprint || null,
      top_predictions: topPredictions,
      category_final: categoryFinal,
      category_predicted: categoryPredicted,
      category_touched: Boolean(review.category_touched),
      source_bank: toTrimmedString(sourceBankValue || sourceValue) || 'unknown',
      channel: toTrimmedString(review.channel) || 'unknown',
      has_fees: Number(review.fees) || 0,
      has_tax: Number(review.tax) || 0,
      is_credit_origin: type === 'income' ? 1 : 0,
      counterparty: toTrimmedString(review.counterparty),
      recurring_flag: Number(review.recurring_flag) || 0,
      ml_confidence: mlConfidence,
      ml_margin: Number.isFinite(effectiveMargin) ? Number(effectiveMargin.toFixed(4)) : null,
      ml_ambiguous: mlAmbiguous,
      ml_source: toTrimmedString(pickReviewedField(review, canonical, 'ml_source')) || null,
      model_version: toTrimmedString(pickReviewedField(review, canonical, 'model_version')) || null,
      __row_index: rowIndex,
    });
  }

  return {
    transactions,
    validationBlocks,
  };
};

const recheckRowsForDedupe = async ({ userId, rows }) => {
  const accepted = [];
  const blocked = [];

  for (const row of rows) {
    const status = await annotateRowDedupe({
      userId,
      row: {
        transaction_date: row.date,
        amount: row.amount,
        direction: row.type === 'income' ? 'credit' : 'debit',
        merchant: row.merchant,
        description: row.description,
        reference_id: row.source_reference_id,
        source_bank: row.source,
      },
    });

    if (status.dedupe_status === 'blocked_exact') {
      blocked.push({
        row_index: row.__row_index,
        reason: status.duplicate_reason || 'Exact duplicate detected at confirm time',
      });
      continue;
    }

    accepted.push({
      ...row,
      dedupe_fingerprint: row.dedupe_fingerprint || status.dedupe_fingerprint,
      source_bank: row.source_bank || row.source,
    });
  }

  return { accepted, blocked };
};

const confirmImportSession = async ({ userId, sessionId, updates, correlationId = makeCorrelationId() }) => {
  const startedAt = Date.now();

  try {
    if (!sessionId || typeof sessionId !== 'string') {
      const err = new Error('session_id is required');
      err.statusCode = 400;
      throw err;
    }

    const current = await getImportSession({ userId, sessionId });
    if (!current) {
      const err = new Error('Import session not found');
      err.statusCode = 404;
      throw err;
    }

    if (Array.isArray(updates) && updates.length > 0) {
      const normalizedUpdates = updates
        .map((update) => {
          const rowIndex = Number(update.row_index);
          const action = toTrimmedString(update.action).toLowerCase();
          const hasPatch =
            update &&
            typeof update === 'object' &&
            Object.prototype.hasOwnProperty.call(update, 'patch');

          return {
            row_index: rowIndex,
            action,
            patch: hasPatch ? normalizeRowPatch(update.patch || {}) : {},
          };
        })
        .filter((update) => Number.isInteger(update.row_index) && update.row_index >= 0)
        .filter((update) => update.action === 'update' || update.action === 'remove' || update.action === 'restore');

      if (normalizedUpdates.length > 0) {
        await mergeSessionRows({
          sessionId,
          updates: normalizedUpdates,
        });
      }
    }

    await setSessionState({ sessionId, state: 'confirming' });

    const latest = await getImportSession({ userId, sessionId });
    if (!latest) {
      const err = new Error('Import session not found after applying updates');
      err.statusCode = 404;
      throw err;
    }

    const confirmBuild = buildConfirmInputRows({ rows: latest.rows });
    const confirmInputRows = confirmBuild.transactions;
    const validationBlocks = confirmBuild.validationBlocks;

    if (confirmInputRows.length === 0) {
      await setSessionState({
        sessionId,
        state: 'failed',
        summary: {
          total_candidates: validationBlocks.length,
          accepted_candidates: 0,
          created_count: 0,
          failed_count: 0,
          blocked_duplicates: 0,
          validation_blocked: validationBlocks.length,
        },
        warnings: mergeUniqueWarnings(
          parseSessionWarnings(current.session.warnings),
          validationBlocks.map((item) => {
            const rowLabel = Number.isInteger(item.row_index)
              ? `Row ${item.row_index + 1}`
              : 'Row unknown';
            return `${rowLabel}: ${item.reason}`;
          })
        ),
      });

      const err = new Error('No rows available to save after applying removals/validation');
      err.statusCode = 400;
      throw err;
    }

    const dedupeChecked = await recheckRowsForDedupe({
      userId,
      rows: confirmInputRows,
    });

    const acceptedRows = dedupeChecked.accepted;

    const toCreate = acceptedRows.map((row) => {
      const payload = { ...row };
      delete payload.__row_index;
      return payload;
    });

    let saveResult = {
      total: 0,
      created_count: 0,
      failed_count: 0,
      errors: [],
    };

    if (toCreate.length > 0) {
      saveResult = await saveTransactionsInChunks({
        userId,
        items: toCreate,
      });
    }

    const createdCount = saveResult.created_count;
    const failedCount = saveResult.failed_count;

    const failedIndexes = new Set(
      Array.isArray(saveResult.errors)
        ? saveResult.errors
            .map((item) => Number(item?.index))
            .filter((index) => Number.isInteger(index) && index >= 0)
        : []
    );

    const successfulRows = acceptedRows.filter((_, index) => !failedIndexes.has(index));
    const createdRowIndexes = successfulRows
      .map((row) => Number(row.__row_index))
      .filter((rowIndex) => Number.isInteger(rowIndex) && rowIndex >= 0);
    const correctionCandidates = buildImportFeedbackCandidates({ rows: successfulRows });

    const persistenceErrors = Array.isArray(saveResult.errors)
      ? saveResult.errors.map((item) => {
          const index = Number(item?.index);
          const rowIndex =
            Number.isInteger(index) && index >= 0
              ? acceptedRows[index]?.__row_index
              : null;

          return {
            ...item,
            row_index: Number.isInteger(Number(rowIndex)) ? Number(rowIndex) : null,
          };
        })
      : [];

    const anomalyInputRows = successfulRows
      .map((acceptedRow, index) => {
        const transaction = saveResult.transactions?.[index];
        if (!transaction) return null;

        const dedupe = {
          dedupe_status: acceptedRow?.dedupe_status || 'clear',
          dedupe_fingerprint: acceptedRow?.dedupe_fingerprint || null,
          duplicate_reason: acceptedRow?.duplicate_reason || null,
        };

        return {
          row_index: acceptedRow.__row_index,
          transaction,
          dedupe,
        };
      })
      .filter(Boolean);

    let anomalies = [];
    if (anomalyInputRows.length > 0) {
      try {
        const preferredCurrency = await getUserPreferredCurrency(userId);

        anomalies = await evaluateImportRowsForAnomalies({
          userId,
          rows: anomalyInputRows,
          correlationId,
          currency: preferredCurrency,
        });
      } catch (anomalyErr) {
        console.warn('Import anomaly evaluation failed:', anomalyErr.message);
      }
    }

    const completionState =
      failedCount > 0 || dedupeChecked.blocked.length > 0 || validationBlocks.length > 0
        ? 'failed'
        : 'completed';

    const completionWarnings = mergeUniqueWarnings(
      parseSessionWarnings(current.session.warnings),
      dedupeChecked.blocked.map((item) => `Row ${item.row_index + 1}: ${item.reason}`),
      validationBlocks.map((item) => {
        const rowLabel = Number.isInteger(item.row_index)
          ? `Row ${item.row_index + 1}`
          : 'Row unknown';
        return `${rowLabel}: ${item.reason}`;
      })
    );

    await setSessionState({
      sessionId,
      state: completionState,
      summary: {
        total_candidates: confirmInputRows.length + validationBlocks.length,
        accepted_candidates: toCreate.length,
        created_count: createdCount,
        failed_count: failedCount,
        blocked_duplicates: dedupeChecked.blocked.length,
        validation_blocked: validationBlocks.length,
      },
      warnings: completionWarnings,
    });

    const responsePayload = {
      session_id: sessionId,
      state: completionState,
      total_candidates: confirmInputRows.length + validationBlocks.length,
      accepted_candidates: toCreate.length,
      created_count: createdCount,
      failed_count: failedCount,
      blocked_duplicates: dedupeChecked.blocked.length,
      validation_blocked: validationBlocks.length,
      duplicate_blocks: dedupeChecked.blocked,
      validation_blocks: validationBlocks,
      created_row_indexes: createdRowIndexes,
      errors: persistenceErrors,
      correction_candidates: correctionCandidates,
      anomalies,
    };

    logServiceEvent({
      service: 'import.pipeline',
      operation: 'confirm_import_session',
      status: completionState === 'completed' ? 'ok' : 'degraded',
      userId,
      sessionId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: completionState !== 'completed',
      requestLike: { correlationId },
      details: {
        total_candidates: confirmInputRows.length + validationBlocks.length,
        accepted_candidates: toCreate.length,
        created_count: createdCount,
        failed_count: failedCount,
        blocked_duplicates: dedupeChecked.blocked.length,
        validation_blocked: validationBlocks.length,
        anomaly_count: anomalies.length,
      },
    });

    return responsePayload;
  } catch (err) {
    logServiceEvent({
      service: 'import.pipeline',
      operation: 'confirm_import_session',
      status: 'error',
      userId,
      sessionId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        update_count: Array.isArray(updates) ? updates.length : 0,
      },
    });

    throw err;
  }
};

module.exports = {
  previewImportSession,
  getImportSessionForUser,
  confirmImportSession,
};
