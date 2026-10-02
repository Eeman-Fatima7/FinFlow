const path = require('path');
const axios = require('axios');
const { logServiceEvent } = require('../observability/eventLogger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const MAX_FILE_SIZE = Number(process.env.IMPORT_MAX_FILE_SIZE || 15 * 1024 * 1024);
const IMPORT_EXTRACTION_TIMEOUT_MS = Number(process.env.IMPORT_EXTRACTION_TIMEOUT_MS || 120000);

const CSV_EXTENSIONS = new Set(['.csv']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff']);

const normalizeMime = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const detectSourceType = ({ fileName, mimeType }) => {
  const extension = path.extname(fileName || '').toLowerCase();
  const mime = normalizeMime(mimeType);

  if (mime.includes('csv') || CSV_EXTENSIONS.has(extension)) return 'csv';
  if (mime.includes('pdf') || PDF_EXTENSIONS.has(extension)) return 'pdf';
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'image';

  return 'unknown';
};

const assertSupportedUpload = (file) => {
  if (!file || !file.buffer || !file.originalname) {
    const err = new Error('A file upload is required');
    err.statusCode = 400;
    throw err;
  }

  if (file.size > MAX_FILE_SIZE) {
    const err = new Error(`File is too large. Max size is ${Math.floor(MAX_FILE_SIZE / (1024 * 1024))}MB`);
    err.statusCode = 400;
    throw err;
  }

  const sourceType = detectSourceType({
    fileName: file.originalname,
    mimeType: file.mimetype,
  });

  if (sourceType === 'unknown') {
    const err = new Error('Unsupported file type. Upload CSV, PDF, or image');
    err.statusCode = 400;
    throw err;
  }

  return sourceType;
};

const extractRowsFromUpload = async ({
  file,
  bankHint,
  correlationId = null,
  userId = null,
  importSessionId = null,
}) => {
  const sourceType = assertSupportedUpload(file);
  const startedAt = Date.now();
  const timeoutMs = Number.isFinite(IMPORT_EXTRACTION_TIMEOUT_MS) && IMPORT_EXTRACTION_TIMEOUT_MS > 0
    ? IMPORT_EXTRACTION_TIMEOUT_MS
    : 120000;

  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/extract/statement`,
      {
        file_name: file.originalname,
        mime_type: file.mimetype,
        content_base64: file.buffer.toString('base64'),
        bank_hint: bankHint || null,
        user_id: Number.isInteger(userId) ? userId : null,
        import_session_id: typeof importSessionId === 'string' && importSessionId.trim() ? importSessionId.trim() : null,
      },
      {
        timeout: timeoutMs,
        headers: correlationId ? { 'x-correlation-id': correlationId } : undefined,
      }
    );

    const data = response.data || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (rows.length === 0) {
      const err = new Error('No transaction rows could be extracted from file');
      err.statusCode = 400;
      throw err;
    }

    const result = {
      sourceType,
      sourceBank: data.source_bank || 'unknown',
      parserName: data.parser_name || 'unknown_bank',
      detectionConfidence: Number.isFinite(Number(data.detection_confidence))
        ? Number(data.detection_confidence)
        : null,
      usedOcr: Boolean(data.used_ocr),
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      extractionProvider:
        typeof data.extraction_provider === 'string' && data.extraction_provider.trim()
          ? data.extraction_provider.trim()
          : null,
      pagesProcessed: Number.isFinite(Number(data.pages_processed)) ? Number(data.pages_processed) : null,
      rows,
    };

    logServiceEvent({
      service: 'import.extraction',
      operation: 'ml_extract_statement',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      details: {
        source_type: sourceType,
        source_bank: result.sourceBank,
        parser_name: result.parserName,
        extraction_provider: result.extractionProvider,
        pages_processed: result.pagesProcessed,
        row_count: result.rows.length,
        used_ocr: result.usedOcr,
        warning_count: result.warnings.length,
        timeout_ms: timeoutMs,
      },
      requestLike: correlationId ? { correlationId } : null,
    });

    return result;
  } catch (err) {
    logServiceEvent({
      service: 'import.extraction',
      operation: 'ml_extract_statement',
      status: 'error',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      error: err,
      details: {
        source_type: sourceType,
        file_name: file?.originalname || null,
        mime_type: file?.mimetype || null,
        user_id: Number.isInteger(userId) ? userId : null,
        import_session_id: typeof importSessionId === 'string' ? importSessionId : null,
        ml_status: err?.response?.status || null,
        timeout_ms: timeoutMs,
      },
      requestLike: correlationId ? { correlationId } : null,
    });

    if (err.response?.data?.detail) {
      const detail = err.response.data.detail;
      const apiError = new Error(typeof detail === 'string' ? detail : 'Failed to extract statement');
      apiError.statusCode = err.response.status || 502;
      throw apiError;
    }

    if (err.statusCode) {
      throw err;
    }

    const fallback = new Error('Statement extraction service is unavailable');
    fallback.statusCode = 502;
    throw fallback;
  }
};

module.exports = {
  detectSourceType,
  assertSupportedUpload,
  extractRowsFromUpload,
};