const assert = require('assert');

const stockServicePath = require.resolve('../../services/stocks/stockService');
const advisorServicePath = require.resolve('../../services/advisorService');

delete require.cache[stockServicePath];
delete require.cache[advisorServicePath];

const serviceCalls = {
  getStockProfile: [],
  getStockOverview: [],
  getStockIndicators: [],
  getStockFundamentals: [],
  callLLM: [],
};

let llmMode = 'json';

const stockServiceStub = {
  getStockProfile: async ({ ticker }) => {
    serviceCalls.getStockProfile.push({ ticker });
    return {
      symbol: ticker,
      company_name: 'Test Corp',
      sector: 'Technology',
      current_price: 100,
      daily_change_percent: 1.2,
      pe: 24.3,
      eps: 4.1,
    };
  },
  getStockOverview: async ({ ticker }) => {
    serviceCalls.getStockOverview.push({ ticker });
    return {
      day_change_pct: 1.2,
      week_change_pct: 3.1,
      month_change_pct: 5.5,
      quarter_change_pct: 11.4,
    };
  },
  getStockIndicators: async ({ ticker }) => {
    serviceCalls.getStockIndicators.push({ ticker });
    return {
      rsi: 54.22,
      macd_trend: 'BULLISH',
      fifty_two_week_low: 75,
      fifty_two_week_high: 140,
    };
  },
  getStockFundamentals: async ({ ticker, statement }) => {
    serviceCalls.getStockFundamentals.push({ ticker, statement });
    return [
      { metric: 'Revenue', fy_2025: '100B', growth_pct: 11.1 },
      { metric: 'Net Income', fy_2025: '20B', growth_pct: 8.4 },
    ];
  },
};

const advisorServiceStub = {
  callLLM: async (prompt, options) => {
    serviceCalls.callLLM.push({ prompt, options });

    if (llmMode === 'error') {
      const err = new Error('LLM unavailable');
      err.statusCode = 503;
      throw err;
    }

    if (llmMode === 'invalid_json') {
      return 'not valid json';
    }

    return JSON.stringify({
      action: 'BUY',
      target_price: 115.678,
      confidence_pct: 82.345,
      summary: 'Momentum and valuation support upside with controlled downside risk.',
      rationale: ['RSI in healthy range', 'MACD remains bullish', 'Quarter trend remains positive'],
      as_of: '2026-04-01T10:00:00.000Z',
    });
  },
};

require.cache[stockServicePath] = {
  id: stockServicePath,
  filename: stockServicePath,
  loaded: true,
  exports: stockServiceStub,
};

require.cache[advisorServicePath] = {
  id: advisorServicePath,
  filename: advisorServicePath,
  loaded: true,
  exports: advisorServiceStub,
};

const { generateStockInsights } = require('../../services/stocks/stockInsightsService');

const resetCalls = () => {
  Object.values(serviceCalls).forEach((arr) => {
    arr.length = 0;
  });
};

const testModelJsonPath = async () => {
  resetCalls();
  llmMode = 'json';

  const result = await generateStockInsights({
    ticker: 'AAPL',
    correlationId: 'corr-stock-1',
    userId: 91,
  });

  assert.strictEqual(result.action, 'BUY');
  assert.strictEqual(result.target_price, 115.68);
  assert.strictEqual(result.potential_pct, 15.68);
  assert.strictEqual(result.confidence_pct, 82.34);
  assert.strictEqual(result.model_fallback_used, false);
  assert.strictEqual(Array.isArray(result.rationale), true);
  assert.strictEqual(result.rationale.length, 3);
  assert.strictEqual(result.evidence.profile.symbol, 'AAPL');

  assert.strictEqual(serviceCalls.callLLM.length, 1);
  assert.strictEqual(serviceCalls.callLLM[0].options.correlationId, 'corr-stock-1');
  assert.strictEqual(serviceCalls.callLLM[0].options.userId, 91);
  assert.strictEqual(serviceCalls.callLLM[0].options.channel, 'stocks');
};

const testInvalidJsonUsesFallback = async () => {
  resetCalls();
  llmMode = 'invalid_json';

  const result = await generateStockInsights({
    ticker: 'MSFT',
    correlationId: 'corr-stock-2',
    userId: 7,
  });

  assert.strictEqual(result.action, 'HOLD');
  assert.strictEqual(result.target_price, 100);
  assert.strictEqual(result.potential_pct, 0);
  assert.strictEqual(result.confidence_pct, 35);
  assert.strictEqual(result.model_fallback_used, true);
  assert.ok(result.summary.includes('Conservative fallback'));
  assert.strictEqual(result.evidence.profile.symbol, 'MSFT');
};

const testModelErrorUsesFallback = async () => {
  resetCalls();
  llmMode = 'error';

  const result = await generateStockInsights({
    ticker: 'TSLA',
    correlationId: 'corr-stock-3',
    userId: 15,
  });

  assert.strictEqual(result.action, 'HOLD');
  assert.strictEqual(result.target_price, 100);
  assert.strictEqual(result.potential_pct, 0);
  assert.strictEqual(result.confidence_pct, 35);
  assert.strictEqual(result.model_fallback_used, true);
  assert.strictEqual(Array.isArray(result.rationale), true);
  assert.ok(result.rationale.length >= 1);
};

module.exports = {
  testModelJsonPath,
  testInvalidJsonUsesFallback,
  testModelErrorUsesFallback,
};

if (require.main === module) {
  (async () => {
    try {
      await testModelJsonPath();
      await testInvalidJsonUsesFallback();
      await testModelErrorUsesFallback();

      console.log('stockInsightsService.test.js passed');
      process.exit(0);
    } catch (err) {
      console.error('stockInsightsService.test.js failed:', err.message);
      process.exit(1);
    } finally {
      delete require.cache[require.resolve('../../services/stocks/stockInsightsService')];
      delete require.cache[stockServicePath];
      delete require.cache[advisorServicePath];
    }
  })();
}
