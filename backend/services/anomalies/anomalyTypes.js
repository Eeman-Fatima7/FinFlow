const ANOMALY_SCOPE = Object.freeze({
  TRANSACTION: 'transaction',
  MONTH: 'month',
});

const ANOMALY_SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

const ANOMALY_TYPES = Object.freeze({
  DUPLICATE_EXACT: 'duplicate_exact',
  DUPLICATE_PROBABLE: 'duplicate_probable',
  AMOUNT_SPIKE_USER: 'amount_spike_user',
  AMOUNT_SPIKE_CATEGORY: 'amount_spike_category',
  FIRST_TIME_MERCHANT_HIGH_AMOUNT: 'first_time_merchant_high_amount',
  RARE_MERCHANT: 'rare_merchant',
  RECURRING_AMOUNT_DRIFT: 'recurring_amount_drift',
  CATEGORY_SPIKE_MONTH: 'category_spike_month',
  CASHFLOW_PRESSURE: 'cashflow_pressure',
  INCOME_MISSING_EXPECTED_CYCLE: 'income_missing_expected_cycle',
});

const ORDERED_SEVERITY = [
  ANOMALY_SEVERITY.HIGH,
  ANOMALY_SEVERITY.MEDIUM,
  ANOMALY_SEVERITY.LOW,
];

module.exports = {
  ANOMALY_SCOPE,
  ANOMALY_SEVERITY,
  ANOMALY_TYPES,
  ORDERED_SEVERITY,
};
