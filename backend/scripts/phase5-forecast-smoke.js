const axios = require('axios');
const db = require('../db/db');
const { getForecastHistoryForUser } = require('../services/forecast/forecastHistoryService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 10000,
});

const run = async () => {
  const userResult = await db.query(
    `SELECT user_id
     FROM users
     ORDER BY user_id ASC
     LIMIT 1`
  );

  if (!userResult.rows[0]) {
    throw new Error('No users available for forecast smoke test');
  }

  const userId = Number(userResult.rows[0].user_id);

  const history = await getForecastHistoryForUser({ userId, monthsBack: 12 });

  const forecastOne = await mlClient.post('/ml/forecast/personalized', {
    user_id: userId,
    horizon_months: 1,
    history_payload: history,
  });

  const forecastThree = await mlClient.post('/ml/forecast/personalized', {
    user_id: userId,
    horizon_months: 3,
    history_payload: history,
  });

  const forecastSix = await mlClient.post('/ml/forecast/personalized', {
    user_id: userId,
    horizon_months: 6,
    history_payload: history,
  });

  if (!Array.isArray(forecastOne.data?.projections) || forecastOne.data.projections.length !== 1) {
    throw new Error('1-month forecast did not return exactly 1 projection');
  }

  if (!Array.isArray(forecastThree.data?.projections) || forecastThree.data.projections.length !== 3) {
    throw new Error('3-month forecast did not return exactly 3 projections');
  }

  if (!Array.isArray(forecastSix.data?.projections) || forecastSix.data.projections.length !== 6) {
    throw new Error('6-month forecast did not return exactly 6 projections');
  }

  const summary = {
    user_id: userId,
    history_months_available: history.history.total_observed_months,
    confidence_level: forecastOne.data?.reliability?.confidence_level || null,
    fallback_mode: forecastOne.data?.reliability?.fallback_mode || null,
    horizons: {
      one_month_expense: forecastOne.data?.predicted_total_expenses,
      three_month_last_expense: forecastThree.data?.projections?.[2]?.predicted_total_expenses,
      six_month_last_expense: forecastSix.data?.projections?.[5]?.predicted_total_expenses,
    },
  };

  try {
    await mlClient.get(`/ml/forecast/${userId}`, {
      params: {
        horizon_months: 3,
      },
      headers: {
        'x-internal-forecast-key': process.env.INTERNAL_FORECAST_KEY || '',
      },
    });
  } catch (error) {
    // Compatibility endpoint may fail in local smoke if backend/ML are not cross-configured.
  }

  return summary;
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 5 forecast smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Phase 5 forecast smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { run };
