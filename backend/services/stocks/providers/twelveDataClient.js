const axios = require('axios');

const TWELVE_DATA_BASE_URL = (process.env.TWELVE_DATA_BASE_URL || 'https://api.twelvedata.com').trim().replace(/\/+$/, '');
const TWELVE_DATA_API_KEY = (process.env.TWELVE_DATA_API_KEY || '').trim();
const STOCK_PROVIDER_DEBUG = String(process.env.STOCK_PROVIDER_DEBUG || 'false').trim().toLowerCase() === 'true';

const resolveTimeoutMs = () => {
  const raw = Number(process.env.STOCK_API_TIMEOUT_MS || 10000);
  if (!Number.isFinite(raw) || raw <= 0) return 10000;
  return Math.min(Math.max(raw, 1000), 30000);
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const toNumberOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const redactApiKey = (value) => {
  const text = toTrimmedString(value);
  if (!text) return null;
  if (text.length <= 4) return '***';
  return `***${text.slice(-4)}`;
};

const safeErrorBody = (rawBody) => {
  if (rawBody === null || rawBody === undefined) return null;

  if (typeof rawBody === 'string') return rawBody.slice(0, 600);

  if (Array.isArray(rawBody)) {
    return {
      array_length: rawBody.length,
      first: rawBody[0] ?? null,
    };
  }

  if (typeof rawBody === 'object') {
    const output = {};
    Object.keys(rawBody)
      .slice(0, 20)
      .forEach((key) => {
        if (/key|token|authorization|secret/i.test(key)) {
          output[key] = '[redacted]';
          return;
        }

        output[key] = rawBody[key];
      });

    return output;
  }

  return rawBody;
};

const logProviderDebug = ({ endpointPath, providerStatus, responseData, requestError }) => {
  if (!STOCK_PROVIDER_DEBUG) return;

  const payload = {
    event: 'stocks.provider.debug',
    provider: 'twelvedata',
    endpoint: endpointPath || null,
    upstream_status: providerStatus || null,
    upstream_body: safeErrorBody(responseData),
    api_key: redactApiKey(TWELVE_DATA_API_KEY),
    error_message: toTrimmedString(requestError?.message) || null,
  };

  try {
    console.warn(JSON.stringify(payload));
  } catch {
    console.warn('stocks.provider.debug', payload);
  }
};

const createProviderError = ({ message, statusCode, providerStatus, details }) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.providerStatus = providerStatus;
  err.details = details || null;
  return err;
};

const ensureProviderConfig = () => {
  if (!TWELVE_DATA_API_KEY) {
    throw createProviderError({
      message: 'Twelve Data API key is missing on server',
      statusCode: 503,
      providerStatus: null,
      details: { reason: 'missing_twelve_data_api_key' },
    });
  }

  if (!TWELVE_DATA_BASE_URL) {
    throw createProviderError({
      message: 'Twelve Data base URL is not configured',
      statusCode: 503,
      providerStatus: null,
      details: { reason: 'missing_twelve_data_base_url' },
    });
  }
};

const classifyProviderMessage = (providerMessage = '') => {
  const text = toTrimmedString(providerMessage).toLowerCase();

  if (!text) return 'provider_unknown_error';
  if (text.includes('api key is invalid') || text.includes('invalid api key') || text.includes('unauthorized')) {
    return 'invalid_api_key';
  }
  if (text.includes('subscription') || text.includes('plan')) {
    return 'not_subscribed';
  }
  if (text.includes('rate limit') || text.includes('quota') || text.includes('too many request') || text.includes('credits')) {
    return 'quota_exhausted';
  }
  if (text.includes('symbol') && (text.includes('invalid') || text.includes('not found'))) {
    return 'ticker_not_found';
  }
  if (text.includes('temporarily unavailable') || text.includes('service unavailable') || text.includes('internal server error')) {
    return 'provider_outage';
  }

  return 'provider_4xx';
};

const mapProviderFailure = ({ err, fallbackMessage, endpointPath }) => {
  if (err && err.statusCode) return err;

  const providerStatus = Number(err?.response?.status);
  const responseData = err?.response?.data;

  const providerMessage = toTrimmedString(responseData?.message)
    || toTrimmedString(responseData?.status)
    || toTrimmedString(responseData?.error)
    || toTrimmedString(err?.message);

  logProviderDebug({
    endpointPath,
    providerStatus,
    responseData,
    requestError: err,
  });

  const normalizedReason = classifyProviderMessage(providerMessage);

  if (providerStatus === 401 || normalizedReason === 'invalid_api_key') {
    return createProviderError({
      message: 'Twelve Data rejected credentials (invalid API key)',
      statusCode: 503,
      providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
      details: {
        reason: 'invalid_api_key',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus === 404 || normalizedReason === 'ticker_not_found') {
    return createProviderError({
      message: 'Ticker not found',
      statusCode: 404,
      providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
      details: {
        reason: 'ticker_not_found',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus === 429 || normalizedReason === 'quota_exhausted') {
    return createProviderError({
      message: 'Twelve Data quota/rate limit exhausted',
      statusCode: 429,
      providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
      details: {
        reason: 'quota_exhausted',
        provider_message: providerMessage || null,
      },
    });
  }

  if (normalizedReason === 'not_subscribed') {
    return createProviderError({
      message: 'Twelve Data plan is not subscribed for this API',
      statusCode: 503,
      providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
      details: {
        reason: 'not_subscribed',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus >= 500 || normalizedReason === 'provider_outage') {
    return createProviderError({
      message: 'Twelve Data is temporarily unavailable (upstream outage)',
      statusCode: 503,
      providerStatus: Number.isFinite(providerStatus) ? providerStatus : null,
      details: {
        reason: 'provider_outage',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus >= 400 && providerStatus < 500) {
    return createProviderError({
      message: providerMessage || fallbackMessage,
      statusCode: 400,
      providerStatus,
      details: {
        reason: normalizedReason,
        provider_message: providerMessage || null,
      },
    });
  }

  if (err?.code === 'ECONNABORTED') {
    return createProviderError({
      message: 'Twelve Data request timed out',
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

const providerGet = async (path, params, fallbackMessage) => {
  ensureProviderConfig();

  try {
    const response = await axios.get(`${TWELVE_DATA_BASE_URL}${path}`, {
      timeout: resolveTimeoutMs(),
      params: {
        ...(params || {}),
        apikey: TWELVE_DATA_API_KEY,
      },
    });

    if (STOCK_PROVIDER_DEBUG) {
      logProviderDebug({
        endpointPath: path,
        providerStatus: response.status,
        responseData: response.data,
        requestError: null,
      });
    }

    const data = response.data || {};
    const providerCode = Number(data?.code);

    if (
      toTrimmedString(data?.status).toLowerCase() === 'error'
      || (Number.isFinite(providerCode) && providerCode >= 400)
    ) {
      const synthetic = new Error(toTrimmedString(data?.message) || 'Twelve Data request failed');
      synthetic.response = {
        status: Number.isFinite(providerCode) ? providerCode : 400,
        data,
      };

      throw synthetic;
    }

    return data;
  } catch (err) {
    throw mapProviderFailure({
      err,
      fallbackMessage,
      endpointPath: path,
    });
  }
};

const normalizeTicker = (value) => toTrimmedString(value).toUpperCase();

const toSeriesValues = (payload) => {
  const rows = Array.isArray(payload?.values) ? payload.values : [];

  return rows
    .map((entry) => ({
      datetime: toTrimmedString(entry?.datetime),
      open: toNumberOrNull(entry?.open),
      high: toNumberOrNull(entry?.high),
      low: toNumberOrNull(entry?.low),
      close: toNumberOrNull(entry?.close),
    }))
    .filter((entry) => entry.datetime && entry.open !== null && entry.close !== null)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
};

const getPriceSnapshot = async ({ ticker }) => {
  const quote = await providerGet(
    '/quote',
    { symbol: ticker },
    'Failed to fetch stock price snapshot'
  );

  return {
    symbol: normalizeTicker(quote?.symbol || ticker),
    currency: toTrimmedString(quote?.currency).toUpperCase() || null,
    close: toNumberOrNull(quote?.close),
    previous_close: toNumberOrNull(quote?.previous_close),
    volume: toNumberOrNull(quote?.volume),
    fifty_two_week_low: toNumberOrNull(quote?.fifty_two_week?.low),
    fifty_two_week_high: toNumberOrNull(quote?.fifty_two_week?.high),
  };
};

const getDailySeries = async ({ ticker, interval = '1day', outputsize = 260 }) => {
  const payload = await providerGet(
    '/time_series',
    {
      symbol: ticker,
      interval,
      outputsize,
      order: 'asc',
    },
    'Failed to fetch stock history series'
  );

  const values = toSeriesValues(payload);

  return {
    symbol: normalizeTicker(payload?.meta?.symbol || ticker),
    values,
  };
};

const getRsi = async ({ ticker }) => {
  const payload = await providerGet(
    '/rsi',
    {
      symbol: ticker,
      interval: '1day',
      time_period: 14,
      outputsize: 1,
      series_type: 'close',
    },
    'Failed to fetch stock RSI'
  );

  const values = Array.isArray(payload?.values) ? payload.values : [];
  const latest = values[0] || {};

  return {
    RSI: toNumberOrNull(latest?.rsi),
  };
};

const getMacd = async ({ ticker }) => {
  const payload = await providerGet(
    '/macd',
    {
      symbol: ticker,
      interval: '1day',
      outputsize: 1,
      series_type: 'close',
      fast_period: 12,
      slow_period: 26,
      signal_period: 9,
    },
    'Failed to fetch stock MACD'
  );

  const values = Array.isArray(payload?.values) ? payload.values : [];
  const latest = values[0] || {};

  return {
    MACD: toNumberOrNull(latest?.macd),
    MACD_Signal: toNumberOrNull(latest?.macd_signal),
  };
};

module.exports = {
  getPriceSnapshot,
  getDailySeries,
  getRsi,
  getMacd,
};
