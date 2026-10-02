const db = require('../db/db');
const stockService = require('../services/stocks/stockService');
const stockInsightsService = require('../services/stocks/stockInsightsService');
const { makeCorrelationId } = require('../services/observability/eventLogger');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const pickSmokeUser = async () => {
  const result = await db.query(
    `SELECT user_id
     FROM users
     ORDER BY user_id ASC
     LIMIT 1`
  );

  if (!result.rows[0]) {
    throw new Error('No users available for stocks smoke test');
  }

  return Number(result.rows[0].user_id);
};

const pickTickerFromSearch = (results) => {
  const list = Array.isArray(results) ? results : [];
  const preferred = list.find((item) => item?.symbol === 'AAPL');
  if (preferred?.symbol) return preferred.symbol;

  const first = list.find((item) => typeof item?.symbol === 'string' && item.symbol.trim());
  if (!first) throw new Error('Stock search returned no usable ticker');

  return first.symbol;
};

const run = async () => {
  const userId = await pickSmokeUser();

  const searchResults = await stockService.searchStocks({ query: 'AAPL' });
  assert(Array.isArray(searchResults), 'search should return array');
  assert(searchResults.length > 0, 'search should return at least one stock');

  const ticker = pickTickerFromSearch(searchResults);

  const [profile, overview, indicators, fundamentals] = await Promise.all([
    stockService.getStockProfile({ ticker }),
    stockService.getStockOverview({ ticker }),
    stockService.getStockIndicators({ ticker }),
    stockService.getStockFundamentals({ ticker, statement: 'income' }),
  ]);

  assert(profile && typeof profile === 'object', 'profile payload missing');
  assert(typeof profile.symbol === 'string' && profile.symbol.trim(), 'profile.symbol missing');

  assert(overview && typeof overview === 'object', 'overview payload missing');
  assert(
    Object.prototype.hasOwnProperty.call(overview, 'month_change_pct'),
    'overview.month_change_pct missing'
  );

  assert(indicators && typeof indicators === 'object', 'indicators payload missing');
  assert(
    ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(indicators.macd_trend),
    'indicators.macd_trend invalid'
  );

  assert(Array.isArray(fundamentals), 'fundamentals payload should be array');
  assert(fundamentals.length > 0, 'fundamentals payload should not be empty');
  assert(typeof fundamentals[0].metric === 'string', 'fundamentals row should include metric');

  const insight = await stockInsightsService.generateStockInsights({
    ticker,
    correlationId: makeCorrelationId(),
    userId,
  });

  assert(insight && typeof insight === 'object', 'insight payload missing');
  assert(['BUY', 'HOLD', 'SELL'].includes(insight.action), 'insight.action invalid');
  assert(typeof insight.summary === 'string' && insight.summary.trim(), 'insight.summary missing');
  assert(Array.isArray(insight.rationale), 'insight.rationale must be array');
  assert(typeof insight.confidence_pct === 'number', 'insight.confidence_pct should be numeric');
  assert(typeof insight.as_of === 'string' && insight.as_of.trim(), 'insight.as_of missing');

  return {
    user_id: userId,
    ticker,
    search_result_count: searchResults.length,
    profile_symbol: profile.symbol,
    overview_month_change_pct: overview.month_change_pct,
    indicators_macd_trend: indicators.macd_trend,
    fundamentals_metric_count: fundamentals.length,
    insight_action: insight.action,
    insight_confidence_pct: insight.confidence_pct,
    model_fallback_used: Boolean(insight.model_fallback_used),
  };
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 9 stocks smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Phase 9 stocks smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { run };
