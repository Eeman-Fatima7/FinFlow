const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const forecastController = require('../controllers/forecastController');

router.get(
  '/internal/history/:userId',
  forecastController.ensureInternalKey,
  forecastController.getForecastHistory
);

router.get(
  '/history/:userId',
  authMiddleware,
  forecastController.getForecastHistoryForUser
);

module.exports = router;
