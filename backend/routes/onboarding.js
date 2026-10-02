const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const onboardingController = require('../controllers/onboardingController');

router.get('/status', authMiddleware, onboardingController.getStatus);
router.get('/budget-plan', authMiddleware, onboardingController.getBudgetPlan);
router.post('/budget-plan/preview', authMiddleware, onboardingController.previewBudgetPlan);
router.put('/budget-plan', authMiddleware, onboardingController.updateBudgetPlan);
router.post('/budget-plan/accept', authMiddleware, onboardingController.acceptBudgetPlan);

module.exports = router;
