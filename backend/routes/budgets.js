const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const budgetController = require('../controllers/budgetController');

router.post('/', authMiddleware, budgetController.setBudget);
router.get('/',  authMiddleware, budgetController.getBudgets);

module.exports = router;