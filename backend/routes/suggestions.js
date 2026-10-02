const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const suggestionController = require('../controllers/suggestionController');

router.get('/', authMiddleware, suggestionController.getSuggestions);
router.post('/refresh', authMiddleware, suggestionController.refreshSuggestions);
router.post('/generate', authMiddleware, suggestionController.generateSuggestions);
router.patch('/:id/read', authMiddleware, suggestionController.markSuggestionRead);
router.put('/:id/read', authMiddleware, suggestionController.markSuggestionReadPut);

module.exports = router;
