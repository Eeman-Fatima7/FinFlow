const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supportController = require('../controllers/supportController');

router.post('/', authMiddleware, supportController.createSupportRequest);

module.exports = router;
