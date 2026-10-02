const { ANOMALY_TYPES } = require('./anomalyTypes');

const SUPPORTED_CURRENCIES = new Set(['USD', 'PKR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY']);

const normalizeCurrency = (value, fallback = 'USD') => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SUPPORTED_CURRENCIES.has(code) ? code : fallback;
};

const toCurrency = (value, currency = 'USD') => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';

  const resolvedCurrency = normalizeCurrency(currency, 'USD');

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: 0,
    }).format(Math.round(numeric));
  } catch {
    return `${Math.round(numeric).toLocaleString('en-US')} ${resolvedCurrency}`;
  }
};

const toPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0%';
  return `${Math.round(numeric)}%`;
};

const buildAnomalyNarrative = ({ type, evidence = {}, currency = 'USD' }) => {
  const resolvedCurrency = normalizeCurrency(currency, 'USD');

  switch (type) {
    case ANOMALY_TYPES.DUPLICATE_EXACT:
      return {
        title: 'Exact duplicate detected',
        explanation:
          evidence.duplicate_reason ||
          'This transaction exactly matches an existing transaction fingerprint and should be reviewed before trusting totals.',
      };

    case ANOMALY_TYPES.DUPLICATE_PROBABLE:
      return {
        title: 'Possible duplicate transaction',
        explanation:
          evidence.duplicate_reason ||
          'This transaction looks very similar to a previous one (date, amount, and merchant/reference overlap).',
      };

    case ANOMALY_TYPES.AMOUNT_SPIKE_USER:
      return {
        title: 'Amount spike vs your history',
        explanation: `Amount ${toCurrency(evidence.amount, resolvedCurrency)} is much higher than your typical ${evidence.type || 'transaction'} baseline (${toCurrency(evidence.baseline_median, resolvedCurrency)} median, ${toCurrency(evidence.baseline_p95, resolvedCurrency)} p95).`,
      };

    case ANOMALY_TYPES.AMOUNT_SPIKE_CATEGORY:
      return {
        title: 'Amount spike in category',
        explanation: `Amount ${toCurrency(evidence.amount, resolvedCurrency)} stands out for ${evidence.category_name || 'this category'} compared with your prior category baseline (${toCurrency(evidence.baseline_median, resolvedCurrency)} median, ${toCurrency(evidence.baseline_p95, resolvedCurrency)} p95).`,
      };

    case ANOMALY_TYPES.FIRST_TIME_MERCHANT_HIGH_AMOUNT:
      return {
        title: 'High first-time merchant spend',
        explanation: `A first-time merchant charge of ${toCurrency(evidence.amount, resolvedCurrency)} is unusually high relative to your typical spending distribution.`,
      };

    case ANOMALY_TYPES.RARE_MERCHANT:
      return {
        title: 'Rare merchant activity',
        explanation: `This merchant appears infrequently in your records and the amount (${toCurrency(evidence.amount, resolvedCurrency)}) is high enough to warrant a quick review.`,
      };

    case ANOMALY_TYPES.RECURRING_AMOUNT_DRIFT:
      return {
        title: 'Recurring charge drift',
        explanation: `The recurring amount (${toCurrency(evidence.amount, resolvedCurrency)}) is materially above your usual recurring baseline (${toCurrency(evidence.baseline_median, resolvedCurrency)} median).`,
      };

    case ANOMALY_TYPES.CATEGORY_SPIKE_MONTH:
      return {
        title: 'Monthly category spike',
        explanation: `${evidence.category_name || 'A category'} reached ${toCurrency(evidence.current_month_total, resolvedCurrency)} this month, above its historical range (${toCurrency(evidence.baseline_median, resolvedCurrency)} median, ${toCurrency(evidence.baseline_p95, resolvedCurrency)} p95).`,
      };

    case ANOMALY_TYPES.CASHFLOW_PRESSURE:
      return {
        title: 'Cashflow pressure this month',
        explanation: `Expenses (${toCurrency(evidence.total_expenses, resolvedCurrency)}) are elevated while savings rate is ${toPercent(evidence.savings_rate)}, below your normal range.`,
      };

    case ANOMALY_TYPES.INCOME_MISSING_EXPECTED_CYCLE:
      return {
        title: 'Expected income not observed',
        explanation: `Income this month is ${toCurrency(evidence.current_income, resolvedCurrency)} while your historical median is ${toCurrency(evidence.baseline_income_median, resolvedCurrency)}.`,
      };

    default:
      return {
        title: 'Anomaly detected',
        explanation: 'This pattern deviates from historical behavior and should be reviewed.',
      };
  }
};

module.exports = {
  buildAnomalyNarrative,
};
