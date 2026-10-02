const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const transactionController = require('../controllers/transactionController');
const transactionImportController = require('../controllers/transactionImportController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.IMPORT_MAX_FILE_SIZE || 15 * 1024 * 1024),
  },
});

router.post('/',       authMiddleware, transactionController.addTransaction);
router.post('/batch',  authMiddleware, transactionController.addTransactionsBatch);
router.get('/',        authMiddleware, transactionController.getTransactions);
router.put('/:id',     authMiddleware, transactionController.updateTransaction);
router.delete('/:id',  authMiddleware, transactionController.deleteTransaction);

router.post('/import/preview', authMiddleware, upload.single('file'), transactionImportController.previewImportSession);
router.get('/import/:sessionId', authMiddleware, transactionImportController.getImportSession);
router.post('/import/confirm', authMiddleware, transactionImportController.confirmImportSession);

module.exports = router;