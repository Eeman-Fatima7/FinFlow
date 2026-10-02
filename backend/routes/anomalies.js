const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const anomalyController = require('../controllers/anomalyController');

const router = express.Router();

router.get('/', authMiddleware, anomalyController.listAnomalies);
router.get('/summary', authMiddleware, anomalyController.getAnomaliesSummary);
router.get('/transactions/:id', authMiddleware, anomalyController.listTransactionAnomalies);
router.patch('/:id/read', authMiddleware, anomalyController.markAnomalyRead);
router.patch('/:id/dismiss', authMiddleware, anomalyController.dismissAnomaly);

module.exports = router;
