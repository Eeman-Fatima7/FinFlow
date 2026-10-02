const axios = require('axios');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');

const resolveTimeoutMs = () => {
  const raw = Number(process.env.STOCK_API_TIMEOUT_MS || 10000);
  if (!Number.isFinite(raw) || raw <= 0) return 10000;
  return Math.min(Math.max(raw, 1000), 30000);
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const createProviderError = ({ message, statusCode, providerStatus, details }) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.providerStatus = providerStatus;
  err.details = details || null;
  return err;
};

const mapProviderFailure = ({ err, fallbackMessage }) => {
  if (err && err.statusCode) return err;

  const providerStatus = Number(err?.response?.status);
  const providerMessage = toTrimmedString(err?.response?.data?.detail)
    || toTrimmedString(err?.response?.data?.message)
    || toTrimmedString(err?.message);

  if (providerStatus === 400) {
    return createProviderError({
      message: providerMessage || fallbackMessage,
      statusCode: 400,
      providerStatus,
      details: {
        reason: 'invalid_request',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus === 404) {
    return createProviderError({
      message: 'Ticker not found',
      statusCode: 404,
      providerStatus,
      details: {
        reason: 'ticker_not_found',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus === 429) {
    return createProviderError({
      message: 'Stock enrichment quota/rate limit exhausted',
      statusCode: 429,
      providerStatus,
      details: {
        reason: 'quota_exhausted',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus >= 500) {
    return createProviderError({
      message: 'Stock enrichment service is temporarily unavailable',
      statusCode: 503,
      providerStatus,
      details: {
        reason: 'provider_outage',
        provider_message: providerMessage || null,
      },
    });
  }

  if (err?.code === 'ECONNABORTED') {
    return createProviderError({
      message: 'Stock enrichment request timed out',
      statusCode: 503,
      providerStatus: null,
      details: {
        reason: 'provider_timeout',
        provider_message: providerMessage || null,
      },
    });
  }

  return createProviderError({
    message: fallbackMessage,
    statusCode: 503,
    providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
    details: {
      reason: 'provider_unknown_error',
      provider_message: providerMessage || null,
    },
  });
};

const providerGet = async ({ path, params = {}, fallbackMessage, correlationId = null }) => {
  if (!ML_SERVICE_URL) {
    throw createProviderError({
      message: 'ML service URL is not configured',
      statusCode: 503,
      providerStatus: null,
      details: { reason: 'missing_ml_service_url' },
    });
  }

  try {
    const response = await axios.get(`${ML_SERVICE_URL}${path}`, {
      timeout: resolveTimeoutMs(),
      params,
      headers: correlationId ? { 'x-correlation-id': correlationId } : undefined,
    });

    return response.data || {};
  } catch (err) {
    throw mapProviderFailure({
      err,
      fallbackMessage,
    });
  }
};

const getProfileEnrichment = async ({ ticker, correlationId = null }) => {
  const data = await providerGet({
    path: `/ml/stocks/profile/${encodeURIComponent(ticker)}`,
    fallbackMessage: 'Failed to fetch stock profile enrichment',
    correlationId,
  });

  return {
    body: data && typeof data === 'object' ? data : {},
  };
};

const getFundamentalsEnrichment = async ({ ticker, statement, correlationId = null }) => {
  const data = await providerGet({
    path: `/ml/stocks/fundamentals/${encodeURIComponent(ticker)}`,
    params: {
      statement,
    },
    fallbackMessage: 'Failed to fetch stock fundamentals enrichment',
    correlationId,
  });

  return {
    body: data && typeof data === 'object' ? data : {},
  };
};

module.exports = {
  getProfileEnrichment,
  getFundamentalsEnrichment,
};
