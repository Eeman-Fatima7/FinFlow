const stockService = require('../services/stocks/stockService');
const stockInsightsService = require('../services/stocks/stockInsightsService');
const { logServiceEvent, getRequestCorrelationId, makeCorrelationId } = require('../services/observability/eventLogger');

const resolveCorrelationId = (req) => getRequestCorrelationId(req) || makeCorrelationId();

const handleStockError = ({ res, err, fallbackMessage, correlationId }) => {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || null,
      correlation_id: correlationId,
    });
  }

  console.error(`${fallbackMessage}:`, err.message);
  return res.status(500).json({
    error: fallbackMessage,
    correlation_id: correlationId,
  });
};

const searchStocks = async (req, res) => {
  const startedAt = Date.now();
  const correlationId = resolveCorrelationId(req);

  try {
    const data = await stockService.searchStocks({
      query: req.query.q,
    });

    logServiceEvent({
      service: 'stocks.controller',
      operation: 'search_stocks',
      status: 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        query: req.query.q || null,
        result_count: Array.isArray(data) ? data.length : 0,
      },
    });

    return res.status(200).json({
      data,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'stocks.controller',
      operation: 'search_stocks',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        query: req.query.q || null,
      },
    });

    return handleStockError({
      res,
      err,
      fallbackMessage: 'Server error searching stocks',
      correlationId,
    });
  }
};

const getProfile = async (req, res) => {
  const startedAt = Date.now();
  const correlationId = resolveCorrelationId(req);

  try {
    const data = await stockService.getStockProfile({
      ticker: req.params.ticker,
      correlationId,
    });

    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_profile',
      status: 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return res.status(200).json({
      data,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_profile',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return handleStockError({
      res,
      err,
      fallbackMessage: 'Server error fetching stock profile',
      correlationId,
    });
  }
};

const getOverview = async (req, res) => {
  const startedAt = Date.now();
  const correlationId = resolveCorrelationId(req);

  try {
    const data = await stockService.getStockOverview({
      ticker: req.params.ticker,
    });

    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_overview',
      status: 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return res.status(200).json({
      data,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_overview',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return handleStockError({
      res,
      err,
      fallbackMessage: 'Server error fetching stock overview',
      correlationId,
    });
  }
};

const getIndicators = async (req, res) => {
  const startedAt = Date.now();
  const correlationId = resolveCorrelationId(req);

  try {
    const data = await stockService.getStockIndicators({
      ticker: req.params.ticker,
    });

    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_indicators',
      status: 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return res.status(200).json({
      data,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_indicators',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return handleStockError({
      res,
      err,
      fallbackMessage: 'Server error fetching stock indicators',
      correlationId,
    });
  }
};

const getFundamentals = async (req, res) => {
  const startedAt = Date.now();
  const correlationId = resolveCorrelationId(req);

  try {
    const data = await stockService.getStockFundamentals({
      ticker: req.params.ticker,
      statement: req.query.statement,
      correlationId,
    });

    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_fundamentals',
      status: 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        ticker: req.params.ticker || null,
        statement: req.query.statement || null,
        metric_count: Array.isArray(data) ? data.length : 0,
      },
    });

    return res.status(200).json({
      data,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'stocks.controller',
      operation: 'get_stock_fundamentals',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        ticker: req.params.ticker || null,
        statement: req.query.statement || null,
      },
    });

    return handleStockError({
      res,
      err,
      fallbackMessage: 'Server error fetching stock fundamentals',
      correlationId,
    });
  }
};

const createInsights = async (req, res) => {
  const startedAt = Date.now();
  const correlationId = resolveCorrelationId(req);

  try {
    const data = await stockInsightsService.generateStockInsights({
      ticker: req.params.ticker,
      correlationId,
      userId: req.userId,
    });

    logServiceEvent({
      service: 'stocks.controller',
      operation: 'create_stock_insights',
      status: data?.model_fallback_used ? 'degraded' : 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: Boolean(data?.model_fallback_used),
      requestLike: { correlationId },
      details: {
        ticker: req.params.ticker || null,
        action: data?.action || null,
        confidence_pct: data?.confidence_pct ?? null,
        model_fallback_used: Boolean(data?.model_fallback_used),
      },
    });

    return res.status(200).json({
      data: {
        action: data.action,
        target_price: data.target_price,
        target_price_currency: data.target_price_currency,
        potential_pct: data.potential_pct,
        confidence_pct: data.confidence_pct,
        summary: data.summary,
        rationale: data.rationale,
        as_of: data.as_of,
        model_fallback_used: Boolean(data.model_fallback_used),
      },
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'stocks.controller',
      operation: 'create_stock_insights',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        ticker: req.params.ticker || null,
      },
    });

    return handleStockError({
      res,
      err,
      fallbackMessage: 'Server error generating stock insights',
      correlationId,
    });
  }
};

module.exports = {
  searchStocks,
  getProfile,
  getOverview,
  getIndicators,
  getFundamentals,
  createInsights,
};
