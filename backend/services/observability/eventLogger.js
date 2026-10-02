const crypto = require('crypto');

const MAX_EVENT_FIELDS = 40;
const MAX_STRING_VALUE = 300;
const MAX_JSON_LENGTH = 2000;

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const truncateString = (value, maxLength = MAX_STRING_VALUE) => {
  const text = toTrimmedString(value);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const sanitizePrimitive = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return truncateString(value);
  return null;
};

const sanitizeObject = (value, depth = 0) => {
  if (value === null || value === undefined) return null;
  if (depth > 2) return null;

  if (Array.isArray(value)) {
    const list = value
      .slice(0, 12)
      .map((item) => sanitizeObject(item, depth + 1))
      .filter((item) => item !== null);
    return list;
  }

  if (typeof value === 'object') {
    const output = {};
    const keys = Object.keys(value).slice(0, MAX_EVENT_FIELDS);

    keys.forEach((key) => {
      const normalizedKey = truncateString(key, 80);
      if (!normalizedKey) return;

      const raw = value[key];
      const primitive = sanitizePrimitive(raw);
      if (primitive !== null || raw === null) {
        output[normalizedKey] = primitive;
        return;
      }

      const nested = sanitizeObject(raw, depth + 1);
      if (nested !== null) {
        output[normalizedKey] = nested;
      }
    });

    return output;
  }

  return sanitizePrimitive(value);
};

const toIsoDate = (value = new Date()) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const toErrorClass = (error) => {
  if (!error) return null;
  if (toTrimmedString(error.name)) return truncateString(error.name, 120);
  if (error.constructor && toTrimmedString(error.constructor.name)) {
    return truncateString(error.constructor.name, 120);
  }
  return 'Error';
};

const toErrorMessage = (error) => {
  if (!error) return null;
  if (toTrimmedString(error.message)) return truncateString(error.message, 400);
  return truncateString(String(error), 400);
};

const hashText = (value) => {
  const text = toTrimmedString(value);
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
};

const makeCorrelationId = () => crypto.randomBytes(8).toString('hex');

const getRequestCorrelationId = (requestLike) => {
  if (!requestLike || typeof requestLike !== 'object') return null;

  const direct = toTrimmedString(requestLike.correlationId || requestLike.requestId);
  if (direct) return direct;

  const headers = requestLike.headers || {};
  const headerId =
    toTrimmedString(headers['x-correlation-id']) ||
    toTrimmedString(headers['x-request-id']) ||
    toTrimmedString(headers['x-trace-id']);

  return headerId || null;
};

const baseEventShape = (event = {}) => {
  const service = truncateString(event.service || 'backend', 80) || 'backend';
  const operation = truncateString(event.operation || 'unknown_operation', 120) || 'unknown_operation';
  const status = truncateString(event.status || 'info', 40) || 'info';
  const latencyMs = toFiniteNumber(event.latency_ms);

  const hasUserId = event.user_id !== null && event.user_id !== undefined && event.user_id !== '';
  const numericUserId = hasUserId ? Number(event.user_id) : null;

  const normalized = {
    ts: toIsoDate(event.ts),
    event_type: 'observability',
    service,
    operation,
    status,
    correlation_id: truncateString(event.correlation_id, 120) || makeCorrelationId(),
    request_id: truncateString(event.request_id, 120) || null,
    user_id: Number.isInteger(numericUserId) && numericUserId > 0 ? numericUserId : null,
    session_id: truncateString(event.session_id, 120) || null,
    latency_ms: latencyMs,
    fallback_used: Boolean(event.fallback_used),
    error_class: truncateString(event.error_class, 120) || null,
    error_message: truncateString(event.error_message, 400) || null,
    details: sanitizeObject(event.details || {}),
  };

  const detailsJson = JSON.stringify(normalized.details || {});
  if (detailsJson.length > MAX_JSON_LENGTH) {
    normalized.details = {
      truncated: true,
      size: detailsJson.length,
      digest: hashText(detailsJson),
    };
  }

  return normalized;
};

const writeEvent = (event = {}) => {
  const normalized = baseEventShape(event);

  try {
    process.stdout.write(`${JSON.stringify(normalized)}\n`);
  } catch (err) {
    const fallback = {
      ts: new Date().toISOString(),
      event_type: 'observability',
      service: 'backend',
      operation: 'event_logger_write_failure',
      status: 'error',
      correlation_id: makeCorrelationId(),
      error_class: toErrorClass(err),
      error_message: toErrorMessage(err),
      details: {
        original_service: normalized.service,
        original_operation: normalized.operation,
      },
    };

    try {
      process.stderr.write(`${JSON.stringify(fallback)}\n`);
    } catch {
      // Never throw from observability path.
    }
  }
};

const logServiceEvent = ({
  service,
  operation,
  status = 'info',
  requestLike = null,
  userId = null,
  sessionId = null,
  latencyMs = null,
  fallbackUsed = false,
  error = null,
  details = {},
}) => {
  writeEvent({
    service,
    operation,
    status,
    correlation_id: getRequestCorrelationId(requestLike),
    request_id: getRequestCorrelationId(requestLike),
    user_id: userId,
    session_id: sessionId,
    latency_ms: latencyMs,
    fallback_used: fallbackUsed,
    error_class: toErrorClass(error),
    error_message: toErrorMessage(error),
    details,
  });
};

module.exports = {
  writeEvent,
  logServiceEvent,
  getRequestCorrelationId,
  makeCorrelationId,
};
