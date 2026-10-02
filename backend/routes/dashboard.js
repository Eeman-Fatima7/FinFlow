const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', authMiddleware, dashboardController.getSummary);

module.exports = router;