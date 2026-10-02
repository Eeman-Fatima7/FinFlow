const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const stockController = require('../controllers/stockController');

const router = express.Router();

const withStatement = (statement) => (req, res) => {
  req.query = {
    ...req.query,
    statement,
  };

  return stockController.getFundamentals(req, res);
};

router.get('/search', authMiddleware, stockController.searchStocks);
router.get('/:ticker/profile', authMiddleware, stockController.getProfile);
router.get('/:ticker/overview', authMiddleware, stockController.getOverview);
router.get('/:ticker/indicators', authMiddleware, stockController.getIndicators);
router.get('/:ticker/fundamentals', authMiddleware, stockController.getFundamentals);
router.get('/:ticker/fundamentals/income', authMiddleware, withStatement('income'));
router.get('/:ticker/fundamentals/balance', authMiddleware, withStatement('balance'));
router.get('/:ticker/fundamentals/cashflow', authMiddleware, withStatement('cashflow'));
router.get('/:ticker/fundamentals/cash-flow', authMiddleware, withStatement('cashflow'));
router.post('/:ticker/insights', authMiddleware, stockController.createInsights);

module.exports = router;
