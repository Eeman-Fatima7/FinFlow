const assert = require('assert');

const stockServicePath = require.resolve('../../services/stocks/stockService');
const finnhubClientPath = require.resolve('../../services/stocks/providers/finnhubClient');
const twelveDataClientPath = require.resolve('../../services/stocks/providers/twelveDataClient');
const yfinanceClientPath = require.resolve('../../services/stocks/providers/yfinanceClient');

[stockServicePath, finnhubClientPath, twelveDataClientPath, yfinanceClientPath].forEach((path) => {
  delete require.cache[path];
});

const calls = {
  finnhubSearch: [],
  finnhubProfile: [],
  finnhubOverview: [],
  finnhubFundamentals: [],
  twelveSnapshot: [],
  twelveRsi: [],
  twelveMacd: [],
  yfinanceProfile: [],
  yfinanceFundamentals: [],
};

const yfinanceStub = {
  getProfileEnrichment: async ({ ticker, correlationId }) => {
    calls.yfinanceProfile.push({ ticker, correlationId });

    return {
      body: {
        symbol: ticker,
        description: 'Enriched long description from yfinance',
        ceo: 'Tim Cook',
        sector: 'Technology',
        market_cap: '3.00T',
        pe: 30.1111,
        eps: 6.7891,
        dividend_yield: 0.005432,
      },
    };
  },

  getFundamentalsEnrichment: async ({ ticker, statement, correlationId }) => {
    calls.yfinanceFundamentals.push({ ticker, statement, correlationId });

    return {
      body: {
        statement,
        rows: [
          {
            metric: 'Revenue',
            fy_2025: '100B',
            fy_2024: '80B',
            fy_2023: '60B',
            growth_pct: 66.6667,
          },
          {
            metric: 'Gross Profit',
            fy_2025: '50B',
            fy_2024: '40B',
            fy_2023: '30B',
            growth_pct: 66.6667,
          },
          {
            metric: 'Operating Income',
            fy_2025: '30B',
            fy_2024: '24B',
            fy_2023: '18B',
            growth_pct: 66.6667,
          },
          {
            metric: 'Net Income',
            fy_2025: '20B',
            fy_2024: '16B',
            fy_2023: '12B',
            growth_pct: 66.6667,
          },
        ],
      },
    };
  },
};

const finnhubStub = {
  searchStocks: async ({ query }) => {
    calls.finnhubSearch.push({ query });
    return {
      body: [
        { symbol: 'aapl', shortname: 'Apple Inc.' },
        { symbol: 'msft', longname: 'Microsoft Corporation' },
      ],
    };
  },

  getAssetProfileModule: async ({ ticker }) => {
    calls.finnhubProfile.push({ ticker });

    return {
      body: {
        sector: 'Technology',
        company_name: 'Apple Inc.',
        longBusinessSummary: null,
        companyOfficers: [],
        market_cap: 2_900_000_000_000,
        trailingPE: 29.3344,
        epsTrailingTwelveMonths: 6.2456,
        trailingAnnualDividendYield: 0.004321,
      },
    };
  },

  getOverview: async ({ ticker }) => {
    calls.finnhubOverview.push({ ticker });

    return {
      dayHistory: { body: [{ open: 100, close: 102 }] },
      weekHistory: { body: [{ open: 200, close: 190 }] },
      monthHistory: { body: [{ open: 300, close: 330 }] },
      quarterHistory: { body: [{ open: 400, close: 440 }] },
    };
  },

  getStatementModule: async ({ ticker, module }) => {
    calls.finnhubFundamentals.push({ ticker, module });

    return {
      body: {
        incomeStatementHistory: {
          incomeStatementHistory: [
            {
              endDate: { fmt: '2025-12-31' },
              totalRevenue: { fmt: '100B', raw: 100 },
              grossProfit: { fmt: '50B', raw: 50 },
              operatingIncome: { fmt: '30B', raw: 30 },
              netIncome: { fmt: '20B', raw: 20 },
            },
            {
              endDate: { fmt: '2024-12-31' },
              totalRevenue: { fmt: '80B', raw: 80 },
              grossProfit: { fmt: '40B', raw: 40 },
              operatingIncome: { fmt: '24B', raw: 24 },
              netIncome: { fmt: '16B', raw: 16 },
            },
            {
              endDate: { fmt: '2023-12-31' },
              totalRevenue: { fmt: '60B', raw: 60 },
              grossProfit: { fmt: '30B', raw: 30 },
              operatingIncome: { fmt: '18B', raw: 18 },
              netIncome: { fmt: '12B', raw: 12 },
            },
          ],
        },
      },
    };
  },
};

const twelveDataStub = {
  getPriceSnapshot: async ({ ticker }) => {
    calls.twelveSnapshot.push({ ticker });

    return {
      symbol: ticker,
      close: 191.23456,
      previous_close: 190,
      volume: 120_000_000,
      fifty_two_week_low: 120.34567,
      fifty_two_week_high: 220.98765,
    };
  },

  getRsi: async ({ ticker }) => {
    calls.twelveRsi.push({ ticker });

    return {
      RSI: 55.67891,
    };
  },

  getMacd: async ({ ticker }) => {
    calls.twelveMacd.push({ ticker });

    return {
      MACD: 1.2,
      MACD_Signal: 0.8,
    };
  },
};

require.cache[finnhubClientPath] = {
  id: finnhubClientPath,
  filename: finnhubClientPath,
  loaded: true,
  exports: finnhubStub,
};

require.cache[twelveDataClientPath] = {
  id: twelveDataClientPath,
  filename: twelveDataClientPath,
  loaded: true,
  exports: twelveDataStub,
};

require.cache[yfinanceClientPath] = {
  id: yfinanceClientPath,
  filename: yfinanceClientPath,
  loaded: true,
  exports: yfinanceStub,
};

const stockService = require('../../services/stocks/stockService');

const resetCalls = () => {
  Object.values(calls).forEach((items) => {
    items.length = 0;
  });
};

const testSearchStocksUsesFinnhub = async () => {
  resetCalls();

  const results = await stockService.searchStocks({ query: ' AAPL ' });

  assert.strictEqual(calls.finnhubSearch.length, 1);
  assert.deepStrictEqual(calls.finnhubSearch[0], { query: 'AAPL' });
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].symbol, 'AAPL');
  assert.strictEqual(results[1].symbol, 'MSFT');
};

const testProfileSplitsProviders = async () => {
  resetCalls();

  const profile = await stockService.getStockProfile({ ticker: 'aapl', correlationId: 'corr-stock-profile' });

  assert.strictEqual(calls.finnhubProfile.length, 1);
  assert.strictEqual(calls.twelveSnapshot.length, 1);
  assert.strictEqual(calls.yfinanceProfile.length, 1);
  assert.deepStrictEqual(calls.finnhubProfile[0], { ticker: 'AAPL' });
  assert.deepStrictEqual(calls.twelveSnapshot[0], { ticker: 'AAPL' });
  assert.deepStrictEqual(calls.yfinanceProfile[0], { ticker: 'AAPL', correlationId: 'corr-stock-profile' });

  assert.strictEqual(profile.symbol, 'AAPL');
  assert.strictEqual(profile.company_name, 'Apple Inc.');
  assert.strictEqual(profile.sector, 'Technology');
  assert.strictEqual(profile.current_price, 191.2346);
  assert.strictEqual(profile.market_cap, '2.90T');
  assert.strictEqual(profile.description, 'Enriched long description from yfinance');
  assert.strictEqual(profile.ceo, 'Tim Cook');
};

const testOverviewUsesFinnhub = async () => {
  resetCalls();

  const overview = await stockService.getStockOverview({ ticker: 'AAPL' });

  assert.strictEqual(calls.finnhubOverview.length, 1);
  assert.strictEqual(calls.finnhubOverview[0].ticker, 'AAPL');
  assert.strictEqual(calls.twelveSnapshot.length, 0);

  assert.strictEqual(overview.day_change_pct, 2);
  assert.strictEqual(overview.week_change_pct, -5);
  assert.strictEqual(overview.month_change_pct, 10);
  assert.strictEqual(overview.quarter_change_pct, 10);
};

const testIndicatorsUseTwelveData = async () => {
  resetCalls();

  const indicators = await stockService.getStockIndicators({ ticker: 'AAPL' });

  assert.strictEqual(calls.twelveRsi.length, 1);
  assert.strictEqual(calls.twelveMacd.length, 1);
  assert.strictEqual(calls.twelveSnapshot.length, 1);
  assert.strictEqual(calls.finnhubOverview.length, 0);

  assert.strictEqual(indicators.rsi, 55.6789);
  assert.strictEqual(indicators.macd_trend, 'BULLISH');
  assert.strictEqual(indicators.fifty_two_week_low, 120.3457);
  assert.strictEqual(indicators.fifty_two_week_high, 220.9877);
};

const testFundamentalsUseFinnhub = async () => {
  resetCalls();

  const rows = await stockService.getStockFundamentals({
    ticker: 'aapl',
    statement: 'income',
    correlationId: 'corr-fundamentals',
  });

  assert.strictEqual(calls.finnhubFundamentals.length, 1);
  assert.deepStrictEqual(calls.finnhubFundamentals[0], {
    ticker: 'AAPL',
    module: 'income-statement',
  });

  assert.strictEqual(calls.yfinanceFundamentals.length, 0);
  assert.strictEqual(Array.isArray(rows), true);
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(rows[0].metric, 'Revenue');
};

const testFundamentalsFallbackToYfinance = async () => {
  resetCalls();

  const originalFinnhub = finnhubStub.getStatementModule;
  finnhubStub.getStatementModule = async () => {
    const err = new Error('Finnhub endpoint requires a paid plan for this API key');
    err.statusCode = 503;
    throw err;
  };

  try {
    const rows = await stockService.getStockFundamentals({
      ticker: 'aapl',
      statement: 'income',
      correlationId: 'corr-fallback',
    });

    assert.strictEqual(calls.yfinanceFundamentals.length, 1);
    assert.deepStrictEqual(calls.yfinanceFundamentals[0], {
      ticker: 'AAPL',
      statement: 'income',
      correlationId: 'corr-fallback',
    });

    assert.strictEqual(Array.isArray(rows), true);
    assert.strictEqual(rows.length, 4);
    assert.strictEqual(rows[0].metric, 'Revenue');
    assert.strictEqual(rows[0].fy_2025, '100B');
  } finally {
    finnhubStub.getStatementModule = originalFinnhub;
  }
};

(async () => {
  try {
    await testSearchStocksUsesFinnhub();
    await testProfileSplitsProviders();
    await testOverviewUsesFinnhub();
    await testIndicatorsUseTwelveData();
    await testFundamentalsUseFinnhub();
    await testFundamentalsFallbackToYfinance();

    console.log('stockService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('stockService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    [stockServicePath, finnhubClientPath, twelveDataClientPath, yfinanceClientPath].forEach((path) => {
      delete require.cache[path];
    });
  }
})();
