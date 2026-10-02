const axios = require('axios');

const FINNHUB_BASE_URL = (process.env.FINNHUB_BASE_URL || 'https://finnhub.io/api/v1').trim().replace(/\/+$/, '');
const FINNHUB_API_KEY = (process.env.FINNHUB_API_KEY || '').trim();
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

const formatCompactNumber = (value) => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;

  if (Math.abs(numeric) >= 1_000_000_000_000) return `${(numeric / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(numeric) >= 1_000_000_000) return `${(numeric / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`;
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(2)}K`;

  return `${numeric}`;
};

const toSafePreview = (value, depth = 0) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return value.slice(0, 600);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return {
      array_length: value.length,
      first: depth >= 2 ? null : toSafePreview(value[0], depth + 1),
    };
  }

  if (typeof value === 'object') {
    const output = {};
    Object.keys(value)
      .slice(0, 20)
      .forEach((key) => {
        if (/key|token|authorization|secret/i.test(key)) {
          output[key] = '[redacted]';
          return;
        }

        output[key] = depth >= 2 ? '[object]' : toSafePreview(value[key], depth + 1);
      });

    return output;
  }

  return `${value}`;
};

const safeErrorBody = (rawBody) => toSafePreview(rawBody, 0);

const logProviderDebug = ({
  endpointPath,
  providerStatus,
  responseData,
  requestError,
  authTransport = 'query_token',
  requestParams = null,
}) => {
  if (!STOCK_PROVIDER_DEBUG) return;

  const safeParams = (() => {
    if (!requestParams || typeof requestParams !== 'object') return null;

    const output = {};
    Object.keys(requestParams).forEach((key) => {
      if (/key|token|authorization|secret/i.test(key)) {
        output[key] = '[redacted]';
        return;
      }
      output[key] = requestParams[key];
    });

    return output;
  })();

  const payload = {
    event: 'stocks.provider.debug',
    provider: 'finnhub',
    endpoint: endpointPath || null,
    auth_transport: authTransport,
    request_params: safeParams,
    upstream_status: providerStatus || null,
    upstream_body: safeErrorBody(responseData),
    api_key: redactApiKey(FINNHUB_API_KEY),
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
  if (!FINNHUB_API_KEY) {
    throw createProviderError({
      message: 'Finnhub API key is missing on server',
      statusCode: 503,
      providerStatus: null,
      details: { reason: 'missing_finnhub_api_key' },
    });
  }

  if (!FINNHUB_BASE_URL) {
    throw createProviderError({
      message: 'Finnhub base URL is not configured',
      statusCode: 503,
      providerStatus: null,
      details: { reason: 'missing_finnhub_base_url' },
    });
  }
};

const classifyForbiddenMessage = (providerMessage = '') => {
  const text = toTrimmedString(providerMessage).toLowerCase();

  if (!text) return 'forbidden_unknown';
  if (text.includes('invalid api key') || text.includes('api key is invalid') || text.includes('invalid token')) {
    return 'invalid_api_key';
  }
  if (text.includes("don't have access") || text.includes('do not have access')) {
    return 'premium_endpoint_required';
  }
  if (text.includes('not enough access') || text.includes('not have access') || text.includes('upgrade')) {
    return 'not_subscribed';
  }
  if (text.includes('rate limit') || text.includes('quota') || text.includes('too many request')) {
    return 'quota_exhausted';
  }

  return 'forbidden_unknown';
};

const classifyBadRequestMessage = (providerMessage = '') => {
  const text = toTrimmedString(providerMessage).toLowerCase();

  if (!text) return 'provider_4xx';
  if (text.includes('symbol') && (text.includes('invalid') || text.includes('not found'))) {
    return 'ticker_not_found';
  }

  return 'provider_4xx';
};

const mapProviderFailure = ({ err, fallbackMessage, endpointPath }) => {
  if (err && err.statusCode) return err;

  const providerStatus = Number(err?.response?.status);
  const responseData = err?.response?.data;

  const providerMessage = toTrimmedString(responseData?.error)
    || toTrimmedString(responseData?.message)
    || toTrimmedString(err?.message);

  logProviderDebug({
    endpointPath,
    providerStatus,
    responseData,
    requestError: err,
  });

  if (providerStatus === 401) {
    return createProviderError({
      message: 'Finnhub rejected credentials (invalid API key)',
      statusCode: 503,
      providerStatus,
      details: {
        reason: 'invalid_api_key',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus === 403) {
    const reason = classifyForbiddenMessage(providerMessage);

    if (reason === 'quota_exhausted') {
      return createProviderError({
        message: 'Finnhub quota exhausted for current plan',
        statusCode: 429,
        providerStatus,
        details: {
          reason,
          provider_message: providerMessage || null,
        },
      });
    }

    if (reason === 'invalid_api_key') {
      return createProviderError({
        message: 'Finnhub rejected credentials (invalid API key)',
        statusCode: 503,
        providerStatus,
        details: {
          reason,
          provider_message: providerMessage || null,
        },
      });
    }

    if (reason === 'premium_endpoint_required') {
      return createProviderError({
        message: 'Finnhub endpoint requires a paid plan for this API key',
        statusCode: 503,
        providerStatus,
        details: {
          reason,
          provider_message: providerMessage || null,
        },
      });
    }

    if (reason === 'not_subscribed') {
      return createProviderError({
        message: 'Finnhub plan is not subscribed for this API',
        statusCode: 503,
        providerStatus,
        details: {
          reason,
          provider_message: providerMessage || null,
        },
      });
    }

    return createProviderError({
      message: 'Finnhub access forbidden for this request',
      statusCode: 503,
      providerStatus,
      details: {
        reason,
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
      message: 'Finnhub quota/rate limit exhausted',
      statusCode: 429,
      providerStatus,
      details: {
        reason: 'quota_exhausted',
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus >= 400 && providerStatus < 500) {
    const reason = classifyBadRequestMessage(providerMessage);

    if (reason === 'ticker_not_found') {
      return createProviderError({
        message: 'Ticker not found',
        statusCode: 404,
        providerStatus,
        details: {
          reason,
          provider_message: providerMessage || null,
        },
      });
    }

    return createProviderError({
      message: providerMessage || fallbackMessage,
      statusCode: 400,
      providerStatus,
      details: {
        reason,
        provider_message: providerMessage || null,
      },
    });
  }

  if (providerStatus >= 500) {
    return createProviderError({
      message: 'Finnhub is temporarily unavailable (upstream outage)',
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
      message: 'Finnhub request timed out',
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
    providerStatus: providerStatus || null,
    details: {
      reason: 'provider_unknown_error',
      provider_message: providerMessage || null,
    },
  });
};

const providerGet = async (path, params, fallbackMessage) => {
  ensureProviderConfig();

  const requestParams = {
    ...(params || {}),
    token: FINNHUB_API_KEY,
  };

  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}${path}`, {
      timeout: resolveTimeoutMs(),
      params: requestParams,
    });

    if (STOCK_PROVIDER_DEBUG) {
      logProviderDebug({
        endpointPath: path,
        providerStatus: response.status,
        responseData: response.data,
        requestError: null,
        authTransport: 'query_token',
        requestParams,
      });
    }

    return response.data || {};
  } catch (err) {
    if (STOCK_PROVIDER_DEBUG) {
      logProviderDebug({
        endpointPath: path,
        providerStatus: Number(err?.response?.status) || null,
        responseData: err?.response?.data,
        requestError: err,
        authTransport: 'query_token',
        requestParams,
      });
    }

    throw mapProviderFailure({
      err,
      fallbackMessage,
      endpointPath: path,
    });
  }
};

const normalizeTicker = (value) => toTrimmedString(value).toUpperCase();

const toHistoryBody = ({ open, close }) => ({
  body: [
    {
      open: toNumberOrNull(open),
      close: toNumberOrNull(close),
    },
  ],
});

const extractLatestPair = (series) => {
  if (!series || series.s !== 'ok') return { open: null, close: null };

  const opens = Array.isArray(series.o) ? series.o : [];
  const closes = Array.isArray(series.c) ? series.c : [];
  if (opens.length === 0 || closes.length === 0) return { open: null, close: null };

  return {
    open: opens[opens.length - 1],
    close: closes[closes.length - 1],
  };
};

const extractQuarterPair = (series) => {
  if (!series || series.s !== 'ok') return { open: null, close: null };

  const opens = Array.isArray(series.o) ? series.o : [];
  const closes = Array.isArray(series.c) ? series.c : [];
  if (opens.length === 0 || closes.length === 0) return { open: null, close: null };

  if (opens.length >= 4 && closes.length >= 1) {
    return {
      open: opens[opens.length - 4],
      close: closes[closes.length - 1],
    };
  }

  return {
    open: opens[0],
    close: closes[closes.length - 1],
  };
};

const getNowUnix = () => Math.floor(Date.now() / 1000);

const getUnixDaysAgo = (days) => getNowUnix() - (Math.max(1, Number(days) || 1) * 86400);

const getNormalizedMetricValue = (items = [], candidateConcepts = []) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  const conceptMap = new Map();
  const labelMap = new Map();

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const concept = toTrimmedString(item.concept).toLowerCase();
    const label = toTrimmedString(item.label).toLowerCase();
    if (concept) conceptMap.set(concept, item);
    if (label) labelMap.set(label, item);
  });

  for (const candidate of candidateConcepts) {
    const key = toTrimmedString(candidate).toLowerCase();
    if (!key) continue;

    const byConcept = conceptMap.get(key);
    if (byConcept && toNumberOrNull(byConcept.value) !== null) return toNumberOrNull(byConcept.value);

    const byLabel = labelMap.get(key);
    if (byLabel && toNumberOrNull(byLabel.value) !== null) return toNumberOrNull(byLabel.value);
  }

  return null;
};

const extractFiscalYear = (record, fallbackIndex = 0) => {
  const endDate = toTrimmedString(record?.endDate);
  if (endDate) {
    const yearMatch = endDate.match(/(20\d{2})/);
    if (yearMatch) return Number(yearMatch[1]);
  }

  const year = Number(record?.year);
  if (Number.isFinite(year) && year > 1900) return year;

  return new Date().getUTCFullYear() - fallbackIndex;
};

const toStatementEntryValue = (numeric) => {
  if (numeric === null) {
    return {
      fmt: null,
      raw: null,
    };
  }

  return {
    fmt: formatCompactNumber(numeric),
    raw: numeric,
  };
};

const selectAnnualReports = (payload = {}) => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  const annual = rows.filter((item) => {
    const form = toTrimmedString(item?.form).toUpperCase();
    if (form === '10-K' || form === '20-F' || form === '40-F') return true;
    return Number(item?.quarter) === 0;
  });

  const candidates = annual.length > 0 ? annual : rows;

  const sorted = [...candidates].sort((a, b) => {
    const aDate = new Date(a?.endDate || 0).getTime();
    const bDate = new Date(b?.endDate || 0).getTime();
    return bDate - aDate;
  });

  const output = [];
  const seenYears = new Set();

  for (const record of sorted) {
    const year = extractFiscalYear(record, output.length);
    if (seenYears.has(year)) continue;

    seenYears.add(year);
    output.push(record);

    if (output.length >= 3) break;
  }

  return output;
};

const statementMappings = {
  'income-statement': {
    reportKey: 'ic',
    targetPath: ['incomeStatementHistory', 'incomeStatementHistory'],
    fields: [
      ['totalRevenue', ['RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'Revenues', 'Revenue']],
      ['grossProfit', ['GrossProfit']],
      ['operatingIncome', ['OperatingIncomeLoss']],
      ['netIncome', ['NetIncomeLoss', 'ProfitLoss']],
    ],
  },
  'balance-sheet': {
    reportKey: 'bs',
    targetPath: ['balanceSheetHistory', 'balanceSheetStatements'],
    fields: [
      ['totalAssets', ['Assets']],
      ['longTermDebt', ['LongTermDebtAndCapitalLeaseObligations', 'LongTermDebtNoncurrent', 'LongTermDebt']],
      ['totalStockholderEquity', ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']],
      ['cash', ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']],
    ],
  },
  'cashflow-statement': {
    reportKey: 'cf',
    targetPath: ['cashflowStatementHistory', 'cashflowStatements'],
    fields: [
      ['totalCashFromOperatingActivities', ['NetCashProvidedByUsedInOperatingActivities']],
      ['totalCashflowsFromInvestingActivities', ['NetCashProvidedByUsedInInvestingActivities']],
      ['totalCashFromFinancingActivities', ['NetCashProvidedByUsedInFinancingActivities']],
      ['changeInCash', ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect', 'CashAndCashEquivalentsPeriodIncreaseDecrease']],
    ],
  },
};

const buildStatementModuleBody = ({ module, reports }) => {
  const mapping = statementMappings[module];
  if (!mapping) return {};

  const normalizedRows = reports.map((record, index) => {
    const statementItems = Array.isArray(record?.report?.[mapping.reportKey])
      ? record.report[mapping.reportKey]
      : [];

    const row = {
      endDate: {
        fmt: toTrimmedString(record?.endDate) || `${extractFiscalYear(record, index)}-12-31`,
      },
    };

    mapping.fields.forEach(([targetField, candidates]) => {
      const numeric = getNormalizedMetricValue(statementItems, candidates);
      row[targetField] = toStatementEntryValue(numeric);
    });

    return row;
  });

  const [rootKey, leafKey] = mapping.targetPath;

  return {
    [rootKey]: {
      [leafKey]: normalizedRows,
    },
  };
};

const searchStocks = async ({ query }) => {
  const data = await providerGet(
    '/search',
    { q: query },
    'Failed to fetch stock search results'
  );

  const rows = Array.isArray(data?.result) ? data.result : [];

  return {
    body: rows.map((item) => ({
      symbol: normalizeTicker(item?.symbol || item?.displaySymbol),
      shortname: toTrimmedString(item?.description || item?.displaySymbol || item?.symbol),
      longname: toTrimmedString(item?.description || item?.displaySymbol || item?.symbol),
      name: toTrimmedString(item?.description || item?.displaySymbol || item?.symbol),
    })),
  };
};

const getAssetProfileModule = async ({ ticker }) => {
  const profileData = await providerGet(
    '/stock/profile2',
    { symbol: ticker },
    'Failed to fetch stock company profile'
  );

  let metricData = null;
  try {
    metricData = await providerGet(
      '/stock/metric',
      {
        symbol: ticker,
        metric: 'all',
      },
      'Failed to fetch stock valuation metrics'
    );
  } catch (err) {
    if (err?.details?.reason === 'not_subscribed') {
      metricData = null;
    } else {
      throw err;
    }
  }

  const metrics = metricData?.metric && typeof metricData.metric === 'object'
    ? metricData.metric
    : {};

  const marketCapMillions = toNumberOrNull(profileData?.marketCapitalization);
  const marketCap = marketCapMillions === null ? null : marketCapMillions * 1_000_000;

  return {
    body: {
      sector: toTrimmedString(profileData?.finnhubIndustry) || null,
      longBusinessSummary: null,
      companyOfficers: [],
      company_name: toTrimmedString(profileData?.name) || normalizeTicker(profileData?.ticker || ticker),
      market_cap: marketCap,
      trailingPE:
        toNumberOrNull(metrics.peTTM)
        ?? toNumberOrNull(metrics.peBasicExclExtraTTM)
        ?? null,
      epsTrailingTwelveMonths:
        toNumberOrNull(metrics.epsTTM)
        ?? toNumberOrNull(metrics.epsBasicExclExtraItemsTTM)
        ?? null,
      trailingAnnualDividendYield:
        toNumberOrNull(metrics.dividendYieldIndicatedAnnual)
        ?? toNumberOrNull(metrics.dividendYield5YAvg)
        ?? null,
    },
  };
};

const toPercentFromMetric = (value) => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  return numeric;
};

const toSyntheticHistoryBody = (pct) => {
  const numeric = toPercentFromMetric(pct);
  if (numeric === null) return toHistoryBody({ open: null, close: null });

  return toHistoryBody({
    open: 100,
    close: 100 + numeric,
  });
};

const getOverview = async ({ ticker }) => {
  const [quoteData, metricData] = await Promise.all([
    providerGet(
      '/quote',
      { symbol: ticker },
      'Failed to fetch stock quote'
    ),
    providerGet(
      '/stock/metric',
      { symbol: ticker, metric: 'all' },
      'Failed to fetch stock performance metrics'
    ),
  ]);

  const metrics = metricData?.metric && typeof metricData.metric === 'object'
    ? metricData.metric
    : {};

  const dayPair = {
    open: toNumberOrNull(quoteData?.pc),
    close: toNumberOrNull(quoteData?.c),
  };

  const weekChange = toPercentFromMetric(metrics?.['5DayPriceReturnDaily']);
  const monthChange = toPercentFromMetric(metrics?.['monthToDatePriceReturnDaily']);
  const quarterChange = toPercentFromMetric(metrics?.['13WeekPriceReturnDaily']);

  return {
    dayHistory: toHistoryBody(dayPair),
    weekHistory: toSyntheticHistoryBody(weekChange),
    monthHistory: toSyntheticHistoryBody(monthChange),
    quarterHistory: toSyntheticHistoryBody(quarterChange),
  };
};

const getStatementModule = async ({ ticker, module }) => {
  if (!statementMappings[module]) {
    const err = new Error('Unsupported statement module');
    err.statusCode = 400;
    err.details = {
      reason: 'unsupported_statement_module',
      module,
    };
    throw err;
  }

  const payload = await providerGet(
    '/stock/financials-reported',
    { symbol: ticker },
    'Failed to fetch stock fundamentals'
  );

  const reports = selectAnnualReports(payload);

  return {
    body: buildStatementModuleBody({ module, reports }),
  };
};

module.exports = {
  searchStocks,
  getAssetProfileModule,
  getOverview,
  getStatementModule,
};
