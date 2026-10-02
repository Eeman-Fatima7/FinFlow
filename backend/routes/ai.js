const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

router.post('/query', authMiddleware, aiController.handleQuery);
router.post('/voice', authMiddleware, aiController.handleVoice);
router.post('/actions/confirm', authMiddleware, aiController.confirmAction);
router.get('/history', authMiddleware, aiController.getHistory);

module.exports = router;
