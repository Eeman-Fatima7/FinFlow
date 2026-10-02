const crypto = require('crypto');
const { getForecastHistoryForUser: buildForecastHistoryForUser } = require('../services/forecast/forecastHistoryService');

const INTERNAL_FORECAST_KEY = (process.env.INTERNAL_FORECAST_KEY || '').trim();

const safeTrim = (value) => (typeof value === 'string' ? value.trim() : '');

const secureEquals = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const ensureInternalKey = (req, res, next) => {
  if (!INTERNAL_FORECAST_KEY) {
    return res.status(503).json({ error: 'Internal forecast key is not configured' });
  }

  const provided =
    safeTrim(req.headers['x-internal-forecast-key']) ||
    safeTrim(req.headers['x-internal-service-key']) ||
    safeTrim(req.query?.internal_key);

  if (!provided || !secureEquals(provided, INTERNAL_FORECAST_KEY)) {
    return res.status(401).json({ error: 'Unauthorized internal forecast request' });
  }

  return next();
};

const resolveHistoryPayload = async (req, res) => {
  try {
    const payload = await buildForecastHistoryForUser({
      userId: req.params.userId,
      monthsBack: req.query.months_back,
    });

    return res.status(200).json(payload);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('getForecastHistory error:', err.message);
    return res.status(500).json({ error: 'Server error fetching forecast history' });
  }
};

const getForecastHistory = async (req, res) => {
  return resolveHistoryPayload(req, res);
};

const getForecastHistoryForUser = async (req, res) => {
  const requestedUserId = Number(req.params.userId);
  if (!Number.isInteger(requestedUserId) || requestedUserId <= 0) {
    return res.status(400).json({ error: 'userId must be a positive integer' });
  }

  if (requestedUserId !== Number(req.userId)) {
    return res.status(403).json({ error: 'You can only access your own forecast history' });
  }

  return resolveHistoryPayload(req, res);
};

module.exports = {
  ensureInternalKey,
  getForecastHistory,
  getForecastHistoryForUser,
};
