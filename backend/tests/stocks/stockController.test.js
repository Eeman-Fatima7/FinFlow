const assert = require('assert');

const stockServicePath = require.resolve('../../services/stocks/stockService');
const stockInsightsServicePath = require.resolve('../../services/stocks/stockInsightsService');
const eventLoggerPath = require.resolve('../../services/observability/eventLogger');

delete require.cache[stockServicePath];
delete require.cache[stockInsightsServicePath];
delete require.cache[eventLoggerPath];

const serviceCalls = {
  searchStocks: [],
  getStockProfile: [],
  getStockOverview: [],
  getStockIndicators: [],
  getStockFundamentals: [],
  generateStockInsights: [],
};

const logCalls = [];
let correlationIdSeed = 0;

const stockServiceStub = {
  searchStocks: async ({ query }) => {
    serviceCalls.searchStocks.push({ query });
    return [{ symbol: 'AAPL', name: 'Apple Inc.' }];
  },
  getStockFundamentals: async ({ ticker, statement, correlationId }) => {
    serviceCalls.getStockFundamentals.push({ ticker, statement, correlationId });
    return [{ metric: 'Revenue', fy_2025: '100B', growth_pct: 20 }];
  },
  getStockProfile: async ({ ticker, correlationId }) => {
    serviceCalls.getStockProfile.push({ ticker, correlationId });
    return { symbol: ticker, company_name: 'Apple Inc.' };
  },
  getStockOverview: async ({ ticker }) => {
    serviceCalls.getStockOverview.push({ ticker });
    return { day_change_pct: 1.5 };
  },
  getStockIndicators: async ({ ticker }) => {
    serviceCalls.getStockIndicators.push({ ticker });
    return { rsi: 51.2, macd_trend: 'BULLISH' };
  },
};

const stockInsightsStub = {
  generateStockInsights: async ({ ticker, correlationId, userId }) => {
    serviceCalls.generateStockInsights.push({ ticker, correlationId, userId });
    return {
      action: 'HOLD',
      target_price: 200,
      potential_pct: 4.5,
      confidence_pct: 63,
      summary: 'Balanced setup.',
      rationale: ['Trend neutral'],
      as_of: '2026-04-01T00:00:00.000Z',
      model_fallback_used: false,
    };
  },
};

const eventLoggerStub = {
  logServiceEvent: (payload) => {
    logCalls.push(payload);
  },
  getRequestCorrelationId: (req) => req.headers?.['x-correlation-id'] || null,
  makeCorrelationId: () => {
    correlationIdSeed += 1;
    return `corr-${correlationIdSeed}`;
  },
};

require.cache[stockServicePath] = {
  id: stockServicePath,
  filename: stockServicePath,
  loaded: true,
  exports: stockServiceStub,
};

require.cache[stockInsightsServicePath] = {
  id: stockInsightsServicePath,
  filename: stockInsightsServicePath,
  loaded: true,
  exports: stockInsightsStub,
};

require.cache[eventLoggerPath] = {
  id: eventLoggerPath,
  filename: eventLoggerPath,
  loaded: true,
  exports: eventLoggerStub,
};

const stockController = require('../../controllers/stockController');

const resetState = () => {
  Object.values(serviceCalls).forEach((arr) => {
    arr.length = 0;
  });
  logCalls.length = 0;
};

const makeReq = ({
  query = {},
  params = {},
  headers = {},
  userId = 11,
} = {}) => ({
  query,
  params,
  headers,
  userId,
});

const makeRes = () => {
  const state = {
    statusCode: null,
    payload: null,
  };

  return {
    status: (code) => {
      state.statusCode = code;
      return {
        json: (payload) => {
          state.payload = payload;
          return state;
        },
      };
    },
    state,
  };
};

const testSearchStocksSuccess = async () => {
  resetState();

  const req = makeReq({ query: { q: 'AAPL' }, headers: { 'x-correlation-id': 'abc-1' } });
  const res = makeRes();

  await stockController.searchStocks(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.deepStrictEqual(res.state.payload, {
    data: [{ symbol: 'AAPL', name: 'Apple Inc.' }],
    correlation_id: 'abc-1',
  });

  assert.deepStrictEqual(serviceCalls.searchStocks[0], { query: 'AAPL' });
  assert.strictEqual(logCalls.length, 1);
  assert.strictEqual(logCalls[0].operation, 'search_stocks');
  assert.strictEqual(logCalls[0].status, 'ok');
};

const testFundamentalsSuccess = async () => {
  resetState();

  const req = makeReq({ params: { ticker: 'AAPL' }, query: { statement: 'income' } });
  const res = makeRes();

  await stockController.getFundamentals(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(Array.isArray(res.state.payload.data), true);
  assert.strictEqual(res.state.payload.correlation_id, 'corr-1');
  assert.deepStrictEqual(serviceCalls.getStockFundamentals[0], {
    ticker: 'AAPL',
    statement: 'income',
    correlationId: 'corr-1',
  });
  assert.strictEqual(logCalls[0].operation, 'get_stock_fundamentals');
};

const testInsightsSuccess = async () => {
  resetState();

  const req = makeReq({
    params: { ticker: 'MSFT' },
    headers: { 'x-correlation-id': 'ins-1' },
    userId: 90,
  });
  const res = makeRes();

  await stockController.createInsights(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(res.state.payload.correlation_id, 'ins-1');
  assert.strictEqual(res.state.payload.data.action, 'HOLD');
  assert.strictEqual(res.state.payload.data.model_fallback_used, false);

  assert.deepStrictEqual(serviceCalls.generateStockInsights[0], {
    ticker: 'MSFT',
    correlationId: 'ins-1',
    userId: 90,
  });

  assert.strictEqual(logCalls[0].operation, 'create_stock_insights');
  assert.strictEqual(logCalls[0].status, 'ok');
};

const testErrorMapping = async () => {
  resetState();

  stockServiceStub.getStockProfile = async () => {
    const err = new Error('ticker must be a valid symbol');
    err.statusCode = 400;
    throw err;
  };

  const req = makeReq({ params: { ticker: 'bad!' } });
  const res = makeRes();

  await stockController.getProfile(req, res);

  assert.strictEqual(res.state.statusCode, 400);
  assert.strictEqual(res.state.payload.error, 'ticker must be a valid symbol');
  assert.strictEqual(typeof res.state.payload.correlation_id, 'string');

  assert.strictEqual(logCalls[0].status, 'error');
  assert.strictEqual(logCalls[0].operation, 'get_stock_profile');

  stockServiceStub.getStockProfile = async ({ ticker, correlationId }) => {
    serviceCalls.getStockProfile.push({ ticker, correlationId });
    return { symbol: ticker, company_name: 'Apple Inc.' };
  };
};

module.exports = {
  testSearchStocksSuccess,
  testFundamentalsSuccess,
  testInsightsSuccess,
  testErrorMapping,
};

if (require.main === module) {
  (async () => {
    try {
      await testSearchStocksSuccess();
      await testFundamentalsSuccess();
      await testInsightsSuccess();
      await testErrorMapping();

      console.log('stockController.test.js passed');
      process.exit(0);
    } catch (err) {
      console.error('stockController.test.js failed:', err.message);
      process.exit(1);
    } finally {
      delete require.cache[require.resolve('../../controllers/stockController')];
      delete require.cache[stockServicePath];
      delete require.cache[stockInsightsServicePath];
      delete require.cache[eventLoggerPath];
    }
  })();
}
