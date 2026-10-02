const finnhubClient = require('./providers/finnhubClient');
const twelveDataClient = require('./providers/twelveDataClient');
const yfinanceClient = require('./providers/yfinanceClient');
const { logServiceEvent } = require('../observability/eventLogger');
const {
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
} = require('./stockNormalizer');

const searchStocks = async ({ query }) => {
  const validatedQuery = assertSearchQuery(query);
  const providerData = await finnhubClient.searchStocks({ query: validatedQuery });

  return normalizeSearchResponse(providerData);
};

const getStockProfile = async ({ ticker, correlationId = null }) => {
  const validatedTicker = assertTicker(ticker);
  const startedAt = Date.now();

  const [snapshot, moduleData] = await Promise.all([
    twelveDataClient.getPriceSnapshot({ ticker: validatedTicker }),
    finnhubClient.getAssetProfileModule({ ticker: validatedTicker }),
  ]);

  const quoteData = {
    body: [
      {
        symbol: snapshot.symbol || validatedTicker,
        shortName: moduleData?.body?.company_name || snapshot.symbol || validatedTicker,
        longName: moduleData?.body?.company_name || snapshot.symbol || validatedTicker,
        regularMarketPrice: snapshot.close,
        regularMarketChange:
          snapshot.close !== null && snapshot.previous_close !== null
            ? snapshot.close - snapshot.previous_close
            : null,
        regularMarketChangePercent:
          snapshot.close !== null
          && snapshot.previous_close !== null
          && snapshot.previous_close !== 0
            ? ((snapshot.close - snapshot.previous_close) / snapshot.previous_close) * 100
            : null,
        marketCap: moduleData?.body?.market_cap ?? null,
        regularMarketVolume: snapshot.volume,
        trailingPE: moduleData?.body?.trailingPE ?? null,
        epsTrailingTwelveMonths: moduleData?.body?.epsTrailingTwelveMonths ?? null,
        trailingAnnualDividendYield: moduleData?.body?.trailingAnnualDividendYield ?? null,
      },
    ],
  };

  const primaryProfile = normalizeProfileResponse({
    quoteData,
    moduleData,
    fallbackTicker: validatedTicker,
    priceCurrency: snapshot.currency,
  });

  const missingFields = findMissingProfileFields(primaryProfile);
  if (missingFields.length === 0) {
    logServiceEvent({
      service: 'stocks.service',
      operation: 'get_stock_profile',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: correlationId ? { correlationId } : null,
      details: {
        ticker: validatedTicker,
        enrichment_attempted: false,
        fields_filled: [],
      },
    });

    return primaryProfile;
  }

  try {
    const enrichmentData = await yfinanceClient.getProfileEnrichment({
      ticker: validatedTicker,
      correlationId,
    });

    const mergedProfile = mergeProfileWithEnrichment(primaryProfile, enrichmentData?.body || {});
    const missingAfter = findMissingProfileFields(mergedProfile);
    const filledFields = missingFields.filter((field) => !missingAfter.includes(field));

    logServiceEvent({
      service: 'stocks.service',
      operation: 'get_stock_profile',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: correlationId ? { correlationId } : null,
      details: {
        ticker: validatedTicker,
        enrichment_attempted: true,
        fields_missing_before: missingFields,
        fields_filled: filledFields,
        fields_still_missing: missingAfter,
      },
    });

    return mergedProfile;
  } catch (enrichmentError) {
    logServiceEvent({
      service: 'stocks.service',
      operation: 'get_stock_profile',
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: correlationId ? { correlationId } : null,
      error: enrichmentError,
      details: {
        ticker: validatedTicker,
        enrichment_attempted: true,
        fields_missing_before: missingFields,
        fields_filled: [],
      },
    });

    return primaryProfile;
  }
};

const getStockOverview = async ({ ticker }) => {
  const validatedTicker = assertTicker(ticker);

  const history = await finnhubClient.getOverview({ ticker: validatedTicker });

  return normalizeOverviewResponse(history);
};

const getStockIndicators = async ({ ticker }) => {
  const validatedTicker = assertTicker(ticker);

  const [rsiRaw, macdRaw, snapshot] = await Promise.all([
    twelveDataClient.getRsi({ ticker: validatedTicker }),
    twelveDataClient.getMacd({ ticker: validatedTicker }),
    twelveDataClient.getPriceSnapshot({ ticker: validatedTicker }),
  ]);

  const rsiData = {
    body: [{ RSI: rsiRaw?.RSI ?? null }],
  };

  const macdData = {
    body: [
      {
        MACD: macdRaw?.MACD ?? null,
        MACD_Signal: macdRaw?.MACD_Signal ?? null,
      },
    ],
  };

  const quoteData = {
    body: [
      {
        fiftyTwoWeekLow: snapshot?.fifty_two_week_low ?? null,
        fiftyTwoWeekHigh: snapshot?.fifty_two_week_high ?? null,
      },
    ],
  };

  return normalizeIndicatorsResponse({
    rsiData,
    macdData,
    quoteData,
    priceCurrency: snapshot.currency,
  });
};

const getStockFundamentals = async ({ ticker, statement, correlationId = null }) => {
  const validatedTicker = assertTicker(ticker);
  const validatedStatement = assertStatement(statement);
  const statementMetadata = getStatementConfig(validatedStatement);
  const startedAt = Date.now();

  let moduleData = null;
  let primaryRows = [];

  try {
    moduleData = await finnhubClient.getStatementModule({
      ticker: validatedTicker,
      module: statementMetadata.module,
    });

    primaryRows = normalizeStatementRows({
      statement: validatedStatement,
      moduleData,
    });
  } catch (primaryError) {
    try {
      const enrichmentData = await yfinanceClient.getFundamentalsEnrichment({
        ticker: validatedTicker,
        statement: validatedStatement,
        correlationId,
      });

      const fallbackRows = Array.isArray(enrichmentData?.body?.rows) ? enrichmentData.body.rows : [];

      logServiceEvent({
        service: 'stocks.service',
        operation: 'get_stock_fundamentals',
        status: 'degraded',
        latencyMs: Date.now() - startedAt,
        fallbackUsed: true,
        requestLike: correlationId ? { correlationId } : null,
        error: primaryError,
        details: {
          ticker: validatedTicker,
          statement: validatedStatement,
          enrichment_attempted: true,
          primary_provider_failed: true,
          fallback_row_count: fallbackRows.length,
        },
      });

      return mergeFundamentalRows([], fallbackRows);
    } catch {
      throw primaryError;
    }
  }

  const isSparse = hasSparseFundamentalRows(primaryRows);
  if (!isSparse) {
    logServiceEvent({
      service: 'stocks.service',
      operation: 'get_stock_fundamentals',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: correlationId ? { correlationId } : null,
      details: {
        ticker: validatedTicker,
        statement: validatedStatement,
        enrichment_attempted: false,
        row_count: Array.isArray(primaryRows) ? primaryRows.length : 0,
      },
    });

    return primaryRows;
  }

  try {
    const enrichmentData = await yfinanceClient.getFundamentalsEnrichment({
      ticker: validatedTicker,
      statement: validatedStatement,
      correlationId,
    });

    const enrichmentRows = Array.isArray(enrichmentData?.body?.rows) ? enrichmentData.body.rows : [];
    const mergedRows = mergeFundamentalRows(primaryRows, enrichmentRows);

    logServiceEvent({
      service: 'stocks.service',
      operation: 'get_stock_fundamentals',
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: correlationId ? { correlationId } : null,
      details: {
        ticker: validatedTicker,
        statement: validatedStatement,
        enrichment_attempted: true,
        primary_row_count: Array.isArray(primaryRows) ? primaryRows.length : 0,
        enrichment_row_count: enrichmentRows.length,
        merged_row_count: Array.isArray(mergedRows) ? mergedRows.length : 0,
      },
    });

    return mergedRows;
  } catch (enrichmentError) {
    logServiceEvent({
      service: 'stocks.service',
      operation: 'get_stock_fundamentals',
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: correlationId ? { correlationId } : null,
      error: enrichmentError,
      details: {
        ticker: validatedTicker,
        statement: validatedStatement,
        enrichment_attempted: true,
        row_count: Array.isArray(primaryRows) ? primaryRows.length : 0,
      },
    });

    return primaryRows;
  }
};

module.exports = {
  searchStocks,
  getStockProfile,
  getStockOverview,
  getStockIndicators,
  getStockFundamentals,
};
