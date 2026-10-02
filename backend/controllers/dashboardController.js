const axios = require('axios');
const budgetService = require('../services/budgetService');
const { getForecastHistoryForUser } = require('../services/forecast/forecastHistoryService');
const { getDashboardAnomalySummary } = require('../services/anomalies/anomalyOrchestratorService');
const { logServiceEvent, getRequestCorrelationId, makeCorrelationId } = require('../services/observability/eventLogger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';


const getSummary = async (req, res) => {
  const userId = req.userId;
  const startedAt = Date.now();
  const correlationId = getRequestCorrelationId(req) || makeCorrelationId();

  let parsed;
  try {
    parsed = budgetService.parseMonthYear(req.query.month, req.query.year);
  } catch (err) {
    logServiceEvent({
      service: 'dashboard.controller',
      operation: 'get_summary',
      status: 'error',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        stage: 'parse_month_year',
      },
    });

    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  const { month, year } = parsed;

  try {
    const analysis = await budgetService.analyzeSpending(userId, month, year);

    let forecast = null;
    let forecastFallback = false;

    try {
      const historyPayload = await getForecastHistoryForUser({
        userId,
        monthsBack: 18,
      });

      const forecastResponse = await axios.post(
        `${ML_SERVICE_URL}/ml/forecast/personalized`,
        {
          user_id: userId,
          horizon_months: 1,
          history_payload: historyPayload,
        },
        {
          timeout: 5000,
          headers: { 'x-correlation-id': correlationId },
        }
      );
      forecast = forecastResponse.data;
    } catch (forecastErr) {
      forecastFallback = true;
      console.warn('ML forecast unavailable:', forecastErr.message);

      logServiceEvent({
        service: 'dashboard.forecast',
        operation: 'fetch_personalized_forecast',
        status: 'error',
        userId,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: true,
        requestLike: { correlationId },
        error: forecastErr,
        details: {
          month,
          year,
          ml_url: `${ML_SERVICE_URL}/ml/forecast/personalized`,
        },
      });
    }

    let anomalySummary = {
      total_active: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      highlights: [],
    };

    let anomalyFallback = false;

    try {
      anomalySummary = await getDashboardAnomalySummary({
        userId,
        month,
        year,
        highlightLimit: 5,
      });
    } catch (anomalyErr) {
      anomalyFallback = true;
      console.warn('Dashboard anomaly summary unavailable:', anomalyErr.message);

      logServiceEvent({
        service: 'dashboard.anomaly',
        operation: 'get_anomaly_summary',
        status: 'error',
        userId,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: true,
        requestLike: { correlationId },
        error: anomalyErr,
        details: {
          month,
          year,
        },
      });
    }

    logServiceEvent({
      service: 'dashboard.controller',
      operation: 'get_summary',
      status: forecastFallback || anomalyFallback ? 'degraded' : 'ok',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: forecastFallback || anomalyFallback,
      requestLike: { correlationId },
      details: {
        month,
        year,
        forecast_available: Boolean(forecast),
        forecast_fallback: forecastFallback,
        anomaly_fallback: anomalyFallback,
        anomaly_total_active: Number(anomalySummary?.total_active || 0),
        overspending_flags: Array.isArray(analysis.overspending_flags) ? analysis.overspending_flags.length : 0,
        plan_runtime_available: Boolean(analysis.plan_runtime),
      },
    });

    return res.status(200).json({
      month,
      year,
      income: analysis.income,
      total_expenses: analysis.total_expenses,
      savings: analysis.savings,
      savings_rate: analysis.savings_rate,
      needs_total: analysis.needs_total,
      needs_rate: Math.round((analysis.needs_rate || 0) * 100),
      wants_total: analysis.wants_total,
      wants_rate: Math.round((analysis.wants_rate || 0) * 100),
      category_breakdown: analysis.category_breakdown,
      overspending_flags: analysis.overspending_flags,
      forecast,
      anomaly_summary: anomalySummary,
      plan_runtime: analysis.plan_runtime,
      recent_transactions: analysis.recent_transactions,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'dashboard.controller',
      operation: 'get_summary',
      status: 'error',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        month,
        year,
      },
    });

    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }

    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    console.error('getSummary error:', err.message);
    return res.status(500).json({ error: 'Server error fetching dashboard summary' });
  }
};

module.exports = { getSummary };