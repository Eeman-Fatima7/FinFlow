const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const categoryController = require('../controllers/categoryController');

router.get('/', authMiddleware, categoryController.getCategories);
router.post('/', authMiddleware, categoryController.createCategory);
router.get('/rules', authMiddleware, categoryController.listMerchantRules);
router.delete('/rules/:id', authMiddleware, categoryController.deleteMerchantRule);

module.exports = router;
