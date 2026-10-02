const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const toNumberOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toRoundedOrNull = (value, digits = 4) => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  return Number(numeric.toFixed(digits));
};

const normalizeCurrency = (value, fallback = 'USD') => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return code || fallback;
};

const toPositiveInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
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

const normalizeTicker = (value) => {
  const ticker = toTrimmedString(value).toUpperCase();
  return ticker;
};

const assertTicker = (value) => {
  const ticker = normalizeTicker(value);
  if (!ticker || !/^[A-Z0-9.\-^]{1,15}$/.test(ticker)) {
    const err = new Error('ticker must be a valid symbol');
    err.statusCode = 400;
    throw err;
  }

  return ticker;
};

const assertSearchQuery = (value) => {
  const query = toTrimmedString(value);
  if (!query) {
    const err = new Error('q is required');
    err.statusCode = 400;
    throw err;
  }

  if (query.length > 40) {
    const err = new Error('q must be 40 characters or fewer');
    err.statusCode = 400;
    throw err;
  }

  return query;
};

const assertStatement = (value) => {
  const statement = toTrimmedString(value).toLowerCase();
  if (!statement) {
    const err = new Error('statement is required');
    err.statusCode = 400;
    throw err;
  }

  if (!['income', 'balance', 'cashflow'].includes(statement)) {
    const err = new Error('statement must be one of: income, balance, cashflow');
    err.statusCode = 400;
    throw err;
  }

  return statement;
};

const pickBody = (providerData) => {
  if (!providerData || typeof providerData !== 'object') return null;
  return providerData.body !== undefined ? providerData.body : providerData;
};

const normalizeSearchResponse = (providerData) => {
  const body = pickBody(providerData);
  const rows = Array.isArray(body) ? body : [];

  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const symbol = normalizeTicker(item.symbol);
      const name = toTrimmedString(item.shortname || item.longname || item.name);

      if (!symbol || !name) return null;

      return {
        symbol,
        name,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
};

const normalizeProfileResponse = ({ quoteData, moduleData, fallbackTicker, priceCurrency = 'USD' }) => {
  const quoteBody = pickBody(quoteData);
  const moduleBody = pickBody(moduleData);

  const quote = Array.isArray(quoteBody) && quoteBody.length > 0 ? quoteBody[0] : {};
  const moduleRoot = moduleBody && typeof moduleBody === 'object' ? moduleBody : {};

  const symbol = normalizeTicker(quote.symbol || fallbackTicker);
  const companyName = toTrimmedString(quote.shortName || quote.longName || symbol);

  const officers = Array.isArray(moduleRoot.companyOfficers) ? moduleRoot.companyOfficers : [];
  const ceo = toTrimmedString(officers[0]?.name);

  return {
    symbol,
    company_name: companyName || symbol,
    price_currency: normalizeCurrency(priceCurrency, 'USD'),
    sector: toTrimmedString(moduleRoot.sector) || null,
    description: toTrimmedString(moduleRoot.longBusinessSummary) || null,
    ceo: ceo || null,
    current_price: toRoundedOrNull(quote.regularMarketPrice, 4),
    daily_change: toRoundedOrNull(quote.regularMarketChange, 4),
    daily_change_percent: toRoundedOrNull(quote.regularMarketChangePercent, 4),
    market_cap: formatCompactNumber(quote.marketCap),
    volume: formatCompactNumber(quote.regularMarketVolume),
    pe: toRoundedOrNull(quote.trailingPE, 4),
    eps: toRoundedOrNull(quote.epsTrailingTwelveMonths, 4),
    dividend_yield: toRoundedOrNull(quote.trailingAnnualDividendYield, 6),
  };
};

const extractHistoryPair = (providerData) => {
  const body = pickBody(providerData);
  const row = Array.isArray(body) && body.length > 0 ? body[0] : null;

  const open = toNumberOrNull(row?.open);
  const close = toNumberOrNull(row?.close);

  return { open, close };
};

const calculatePercentChange = ({ open, close }) => {
  if (open === null || close === null) return null;
  if (open === 0) {
    if (close === 0) return 0;
    return null;
  }

  const pct = ((close - open) / open) * 100;
  return toRoundedOrNull(pct, 4);
};

const normalizeOverviewResponse = ({ dayHistory, weekHistory, monthHistory, quarterHistory }) => {
  const day = extractHistoryPair(dayHistory);
  const week = extractHistoryPair(weekHistory);
  const month = extractHistoryPair(monthHistory);
  const quarter = extractHistoryPair(quarterHistory);

  return {
    day_change_pct: calculatePercentChange(day),
    week_change_pct: calculatePercentChange(week),
    month_change_pct: calculatePercentChange(month),
    quarter_change_pct: calculatePercentChange(quarter),
  };
};

const normalizeIndicatorsResponse = ({ rsiData, macdData, quoteData, priceCurrency = 'USD' }) => {
  const rsiBody = pickBody(rsiData);
  const macdBody = pickBody(macdData);
  const quoteBody = pickBody(quoteData);

  const rsiRow = Array.isArray(rsiBody) && rsiBody.length > 0 ? rsiBody[0] : {};
  const macdRow = Array.isArray(macdBody) && macdBody.length > 0 ? macdBody[0] : {};
  const quoteRow = Array.isArray(quoteBody) && quoteBody.length > 0 ? quoteBody[0] : {};

  const macd = toNumberOrNull(macdRow.MACD);
  const signal = toNumberOrNull(macdRow.MACD_Signal);

  let macdTrend = 'NEUTRAL';
  if (macd !== null && signal !== null) {
    if (macd > signal) macdTrend = 'BULLISH';
    if (macd < signal) macdTrend = 'BEARISH';
  }

  return {
    rsi: toRoundedOrNull(rsiRow.RSI, 4),
    macd_trend: macdTrend,
    price_currency: normalizeCurrency(priceCurrency, 'USD'),
    fifty_two_week_low: toRoundedOrNull(quoteRow.fiftyTwoWeekLow, 4),
    fifty_two_week_high: toRoundedOrNull(quoteRow.fiftyTwoWeekHigh, 4),
  };
};

const statementConfig = {
  income: {
    module: 'income-statement',
    path: ['incomeStatementHistory', 'incomeStatementHistory'],
    metrics: [
      ['Revenue', 'totalRevenue'],
      ['Gross Profit', 'grossProfit'],
      ['Operating Income', 'operatingIncome'],
      ['Net Income', 'netIncome'],
    ],
  },
  balance: {
    module: 'balance-sheet',
    path: ['balanceSheetHistory', 'balanceSheetStatements'],
    metrics: [
      ['Total Assets', 'totalAssets'],
      ['Total Debt', 'longTermDebt'],
      ['Shareholders Equity', 'totalStockholderEquity'],
      ['Cash', 'cash'],
    ],
  },
  cashflow: {
    module: 'cashflow-statement',
    path: ['cashflowStatementHistory', 'cashflowStatements'],
    metrics: [
      ['Operating Cash Flow', 'totalCashFromOperatingActivities'],
      ['Investing Cash Flow', 'totalCashflowsFromInvestingActivities'],
      ['Financing Cash Flow', 'totalCashFromFinancingActivities'],
      ['Net Cash Flow', 'changeInCash'],
    ],
  },
};

const getStatementConfig = (statement) => statementConfig[statement];

const resolveNested = (value, path = []) => {
  return path.reduce((acc, key) => {
    if (!acc || typeof acc !== 'object') return null;
    return acc[key];
  }, value);
};

const parseStatementValue = (entry, key) => {
  const field = entry?.[key];
  if (!field || typeof field !== 'object') {
    return {
      fmt: null,
      raw: null,
    };
  }

  return {
    fmt: toTrimmedString(field.fmt) || null,
    raw: toNumberOrNull(field.raw),
  };
};

const toFiscalKey = (entry, fallbackIndex) => {
  const endDate = entry?.endDate?.fmt || entry?.endDate?.raw;
  if (typeof endDate === 'string') {
    const yearMatch = endDate.match(/(20\d{2})/);
    if (yearMatch) return `fy_${yearMatch[1]}`;
  }

  const date = new Date(Number(endDate) * 1000);
  if (Number.isFinite(date.getTime())) {
    return `fy_${date.getUTCFullYear()}`;
  }

  const fallbackYear = new Date().getUTCFullYear() - fallbackIndex;
  return `fy_${fallbackYear}`;
};

const normalizeStatementRows = ({ statement, moduleData }) => {
  const config = getStatementConfig(statement);
  const body = pickBody(moduleData);

  const historyRows = resolveNested(body, config.path);
  const records = Array.isArray(historyRows) ? historyRows.slice(0, 3) : [];

  const fiscalKeys = records.map((entry, index) => toFiscalKey(entry, index));
  while (fiscalKeys.length < 3) {
    const fallbackYear = new Date().getUTCFullYear() - fiscalKeys.length;
    fiscalKeys.push(`fy_${fallbackYear}`);
  }

  const [latestKey, previousKey, oldestKey] = fiscalKeys;

  return config.metrics.map(([metricLabel, sourceField]) => {
    const latest = parseStatementValue(records[0], sourceField);
    const previous = parseStatementValue(records[1], sourceField);
    const oldest = parseStatementValue(records[2], sourceField);

    const growth = (() => {
      if (oldest.raw === null || latest.raw === null) return null;
      if (oldest.raw === 0) return null;
      return toRoundedOrNull(((latest.raw - oldest.raw) / oldest.raw) * 100, 4);
    })();

    return {
      metric: metricLabel,
      [latestKey]: latest.fmt,
      [previousKey]: previous.fmt,
      [oldestKey]: oldest.fmt,
      growth_pct: growth,
    };
  });
};

const isMissingString = (value) => typeof value !== 'string' || !value.trim();

const isMissingScalar = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return !normalized || normalized === 'n/a' || normalized === 'na' || normalized === 'null';
  }
  if (typeof value === 'number') return !Number.isFinite(value);
  return false;
};

const findMissingProfileFields = (profile = {}) => {
  const fields = ['description', 'ceo', 'sector', 'market_cap', 'pe', 'eps', 'dividend_yield'];

  return fields.filter((field) => {
    const value = profile?.[field];
    if (field === 'description' || field === 'ceo' || field === 'sector') {
      return isMissingString(value);
    }

    return isMissingScalar(value);
  });
};

const mergeProfileWithEnrichment = (primaryProfile = {}, enrichmentProfile = {}) => {
  if (!enrichmentProfile || typeof enrichmentProfile !== 'object') {
    return { ...(primaryProfile || {}) };
  }

  const merged = {
    ...(primaryProfile || {}),
  };

  const stringFields = ['company_name', 'sector', 'description', 'ceo'];
  stringFields.forEach((field) => {
    if (!isMissingString(merged[field])) return;
    if (!isMissingString(enrichmentProfile[field])) {
      merged[field] = enrichmentProfile[field].trim();
    }
  });

  const scalarFields = ['market_cap', 'pe', 'eps', 'dividend_yield'];
  scalarFields.forEach((field) => {
    if (!isMissingScalar(merged[field])) return;
    if (!isMissingScalar(enrichmentProfile[field])) {
      merged[field] = enrichmentProfile[field];
    }
  });

  if (isMissingString(merged.symbol) && !isMissingString(enrichmentProfile.symbol)) {
    merged.symbol = enrichmentProfile.symbol.trim();
  }

  return merged;
};

const hasSparseFundamentalRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return true;

  let totalCells = 0;
  let missingCells = 0;

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;

    const fiscalKeys = Object.keys(row).filter((key) => /^fy_\d{4}$/.test(key));
    totalCells += fiscalKeys.length;

    fiscalKeys.forEach((key) => {
      if (isMissingScalar(row[key])) missingCells += 1;
    });
  });

  if (totalCells === 0) return true;
  return missingCells > 0;
};

const toMetricKey = (value) => toTrimmedString(value).toLowerCase();

const mergeFundamentalRows = (primaryRows = [], enrichmentRows = []) => {
  const baseRows = Array.isArray(primaryRows) ? primaryRows : [];
  const fallbackRows = Array.isArray(enrichmentRows) ? enrichmentRows : [];

  if (baseRows.length === 0) {
    return fallbackRows
      .filter((row) => row && typeof row === 'object' && !isMissingString(row.metric))
      .map((row) => ({ ...row, metric: toTrimmedString(row.metric) }));
  }

  if (fallbackRows.length === 0) return baseRows.map((row) => ({ ...row }));

  const merged = baseRows.map((row) => ({ ...row }));
  const metricIndex = new Map();

  merged.forEach((row, index) => {
    const key = toMetricKey(row?.metric);
    if (key) metricIndex.set(key, index);
  });

  fallbackRows.forEach((row) => {
    if (!row || typeof row !== 'object') return;

    const metric = toTrimmedString(row.metric);
    if (!metric) return;

    const metricKey = metric.toLowerCase();
    const existingIndex = metricIndex.get(metricKey);

    if (existingIndex === undefined) {
      merged.push({ ...row, metric });
      metricIndex.set(metricKey, merged.length - 1);
      return;
    }

    const target = merged[existingIndex];

    Object.keys(row).forEach((key) => {
      if (key === 'metric') return;

      const value = row[key];
      if (key === 'growth_pct') {
        if (isMissingScalar(target.growth_pct) && !isMissingScalar(value)) {
          target.growth_pct = value;
        }
        return;
      }

      if (!/^fy_\d{4}$/.test(key)) return;
      if (isMissingScalar(target[key]) && !isMissingScalar(value)) {
        target[key] = value;
      }
    });
  });

  return merged;
};

module.exports = {
  assertTicker,
  assertSearchQuery,
  assertStatement,
  getStatementConfig,
  normalizeSearchResponse,
  normalizeProfileResponse,
  normalizeOverviewResponse,
  normalizeIndicatorsResponse,
  normalizeStatementRows,
  findMissingProfileFields,
  mergeProfileWithEnrichment,
  hasSparseFundamentalRows,
  mergeFundamentalRows,
  toPositiveInt,
};
