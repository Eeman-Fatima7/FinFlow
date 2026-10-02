const assert = require('assert');

const {
  assertTicker,
  assertSearchQuery,
  assertStatement,
  normalizeSearchResponse,
  normalizeProfileResponse,
  normalizeOverviewResponse,
  normalizeIndicatorsResponse,
  normalizeStatementRows,
  findMissingProfileFields,
  mergeProfileWithEnrichment,
  hasSparseFundamentalRows,
  mergeFundamentalRows,
} = require('../../services/stocks/stockNormalizer');

const assertThrows400 = (fn, expectedMessage) => {
  let threw = false;

  try {
    fn();
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, expectedMessage);
    assert.strictEqual(err.statusCode, 400);
  }

  assert.strictEqual(threw, true, `Expected 400 error: ${expectedMessage}`);
};

const testTickerValidation = () => {
  assert.strictEqual(assertTicker(' aapl '), 'AAPL');
  assert.strictEqual(assertTicker('brk.b'), 'BRK.B');

  assertThrows400(() => assertTicker(''), 'ticker must be a valid symbol');
  assertThrows400(() => assertTicker('AAPL$'), 'ticker must be a valid symbol');
};

const testSearchQueryValidation = () => {
  assert.strictEqual(assertSearchQuery(' AAPL '), 'AAPL');

  assertThrows400(() => assertSearchQuery('   '), 'q is required');
  assertThrows400(() => assertSearchQuery('X'.repeat(41)), 'q must be 40 characters or fewer');
};

const testStatementValidation = () => {
  assert.strictEqual(assertStatement('income'), 'income');
  assert.strictEqual(assertStatement('CASHFLOW'), 'cashflow');

  assertThrows400(() => assertStatement(''), 'statement is required');
  assertThrows400(
    () => assertStatement('quarterly'),
    'statement must be one of: income, balance, cashflow'
  );
};

const testNormalizeSearchResponse = () => {
  const output = normalizeSearchResponse({
    body: [
      { symbol: 'aapl', shortname: 'Apple Inc.' },
      { symbol: 'msft', longname: 'Microsoft Corporation' },
      { symbol: '', shortname: 'invalid' },
      { symbol: 'TSLA', shortname: '' },
      null,
    ],
  });

  assert.strictEqual(output.length, 2);
  assert.deepStrictEqual(output[0], {
    symbol: 'AAPL',
    name: 'Apple Inc.',
  });
  assert.deepStrictEqual(output[1], {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
  });
};

const testNormalizeProfileResponse = () => {
  const profile = normalizeProfileResponse({
    quoteData: {
      body: [
        {
          symbol: 'aapl',
          shortName: 'Apple Inc.',
          regularMarketPrice: '191.23456',
          regularMarketChange: '1.23456',
          regularMarketChangePercent: '0.65432',
          marketCap: 2_900_000_000_000,
          regularMarketVolume: 120_000_000,
          trailingPE: '29.3344',
          epsTrailingTwelveMonths: '6.2456',
          trailingAnnualDividendYield: '0.004321',
        },
      ],
    },
    moduleData: {
      body: {
        sector: 'Technology',
        longBusinessSummary: 'Consumer electronics company',
        companyOfficers: [{ name: 'Tim Cook' }],
      },
    },
    fallbackTicker: 'AAPL',
  });

  assert.strictEqual(profile.symbol, 'AAPL');
  assert.strictEqual(profile.company_name, 'Apple Inc.');
  assert.strictEqual(profile.sector, 'Technology');
  assert.strictEqual(profile.ceo, 'Tim Cook');
  assert.strictEqual(profile.current_price, 191.2346);
  assert.strictEqual(profile.daily_change, 1.2346);
  assert.strictEqual(profile.daily_change_percent, 0.6543);
  assert.strictEqual(profile.market_cap, '2.90T');
  assert.strictEqual(profile.volume, '120.00M');
  assert.strictEqual(profile.pe, 29.3344);
  assert.strictEqual(profile.eps, 6.2456);
  assert.strictEqual(profile.dividend_yield, 0.004321);
};

const testNormalizeOverviewResponse = () => {
  const overview = normalizeOverviewResponse({
    dayHistory: { body: [{ open: 100, close: 102 }] },
    weekHistory: { body: [{ open: 200, close: 190 }] },
    monthHistory: { body: [{ open: 0, close: 10 }] },
    quarterHistory: { body: [{ open: null, close: 10 }] },
  });

  assert.strictEqual(overview.day_change_pct, 2);
  assert.strictEqual(overview.week_change_pct, -5);
  assert.strictEqual(overview.month_change_pct, null);
  assert.strictEqual(overview.quarter_change_pct, null);
};

const testNormalizeIndicatorsResponse = () => {
  const indicators = normalizeIndicatorsResponse({
    rsiData: { body: [{ RSI: '55.67891' }] },
    macdData: { body: [{ MACD: '1.2', MACD_Signal: '0.8' }] },
    quoteData: {
      body: [
        {
          fiftyTwoWeekLow: '120.34567',
          fiftyTwoWeekHigh: '220.98765',
        },
      ],
    },
  });

  assert.strictEqual(indicators.rsi, 55.6789);
  assert.strictEqual(indicators.macd_trend, 'BULLISH');
  assert.strictEqual(indicators.fifty_two_week_low, 120.3457);
  assert.strictEqual(indicators.fifty_two_week_high, 220.9877);
};

const testNormalizeStatementRows = () => {
  const rows = normalizeStatementRows({
    statement: 'income',
    moduleData: {
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
    },
  });

  assert.strictEqual(rows.length, 4);

  const revenue = rows.find((row) => row.metric === 'Revenue');
  assert.ok(revenue);
  assert.strictEqual(revenue.fy_2025, '100B');
  assert.strictEqual(revenue.fy_2024, '80B');
  assert.strictEqual(revenue.fy_2023, '60B');
  assert.strictEqual(revenue.growth_pct, 66.6667);
};

const testFindMissingProfileFields = () => {
  const fields = findMissingProfileFields({
    symbol: 'AAPL',
    company_name: 'Apple Inc.',
    sector: 'Technology',
    description: null,
    ceo: '',
    market_cap: '2.90T',
    pe: 29.3,
    eps: null,
    dividend_yield: 0.004,
  });

  assert.deepStrictEqual(fields.sort(), ['ceo', 'description', 'eps']);
};

const testMergeProfileWithEnrichment = () => {
  const merged = mergeProfileWithEnrichment(
    {
      symbol: 'AAPL',
      company_name: 'Apple Inc.',
      sector: 'Technology',
      description: null,
      ceo: null,
      market_cap: '2.90T',
      pe: 29.3344,
      eps: 6.2456,
      dividend_yield: 0.004321,
    },
    {
      symbol: 'AAPL',
      description: 'Enriched business summary',
      ceo: 'Tim Cook',
      market_cap: '3.00T',
      pe: 30.1,
      eps: 6.8,
      dividend_yield: 0.005,
    }
  );

  assert.strictEqual(merged.description, 'Enriched business summary');
  assert.strictEqual(merged.ceo, 'Tim Cook');
  assert.strictEqual(merged.market_cap, '2.90T');
  assert.strictEqual(merged.pe, 29.3344);
};

const testFundamentalSparsityAndMerge = () => {
  const sparseRows = [
    {
      metric: 'Revenue',
      fy_2025: null,
      fy_2024: '80B',
      fy_2023: null,
      growth_pct: null,
    },
  ];

  assert.strictEqual(hasSparseFundamentalRows(sparseRows), true);

  const merged = mergeFundamentalRows(sparseRows, [
    {
      metric: 'Revenue',
      fy_2025: '100B',
      fy_2024: '80B',
      fy_2023: '60B',
      growth_pct: 66.6667,
    },
    {
      metric: 'Net Income',
      fy_2025: '20B',
      fy_2024: '16B',
      fy_2023: '12B',
      growth_pct: 66.6667,
    },
  ]);

  assert.strictEqual(Array.isArray(merged), true);
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].fy_2025, '100B');
  assert.strictEqual(merged[0].fy_2023, '60B');
  assert.strictEqual(merged[0].growth_pct, 66.6667);
  assert.strictEqual(merged[1].metric, 'Net Income');
};

module.exports = {
  testTickerValidation,
  testSearchQueryValidation,
  testStatementValidation,
  testNormalizeSearchResponse,
  testNormalizeProfileResponse,
  testNormalizeOverviewResponse,
  testNormalizeIndicatorsResponse,
  testNormalizeStatementRows,
};

if (require.main === module) {
  try {
    testTickerValidation();
    testSearchQueryValidation();
    testStatementValidation();
    testNormalizeSearchResponse();
    testNormalizeProfileResponse();
    testNormalizeOverviewResponse();
    testNormalizeIndicatorsResponse();
    testNormalizeStatementRows();
    testFindMissingProfileFields();
    testMergeProfileWithEnrichment();
    testFundamentalSparsityAndMerge();

    console.log('stockNormalizer.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('stockNormalizer.test.js failed:', err.message);
    process.exit(1);
  }
}
