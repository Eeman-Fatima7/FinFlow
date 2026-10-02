const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin, writeAdminAuditLogSafe, getClientIp } = require('../middleware/adminMiddleware');
const controller = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(authMiddleware);
router.use(requireAdmin);

// ── Overview ──────────────────────────────────────────────────────────────

router.get('/overview', controller.getOverview);

// ── Users ──────────────────────────────────────────────────────────────────

router.get('/users', controller.listUsers);
router.get('/users/:id', controller.getUserDetail);
router.patch('/users/:id', controller.patchUser);

// ── Transactions ───────────────────────────────────────────────────────────

router.get('/transactions', controller.listTransactions);
router.get('/transactions/:id', controller.getTransactionDetail);
router.patch('/transactions/:id/category', controller.patchTransactionCategory);

// ── Import Sessions ────────────────────────────────────────────────────────

router.get('/import-sessions', controller.listImportSessions);
router.get('/import-sessions/:id', controller.getImportSessionDetail);
router.get('/import-sessions/:id/rows', controller.getImportSessionRows);

// ── Categorization Review ──────────────────────────────────────────────────

router.get('/categorization-review', controller.listCategorizationReview);
router.post('/categorization-review/:id/approve', controller.approveCategorization);
router.post('/categorization-review/:id/correct', controller.correctCategorization);

// ── Budgets & Goals ────────────────────────────────────────────────────────

router.get('/budgets-goals', controller.getBudgetsGoals);

// ── Forecasting ────────────────────────────────────────────────────────────

router.get('/forecasting', controller.getForecasting);

// ── Anomalies ─────────────────────────────────────────────────────────────

router.get('/anomalies', controller.listAnomalies);
router.patch('/anomalies/:id/review', controller.patchAnomalyStatus);

// ── AI / Voice Logs ────────────────────────────────────────────────────────

router.get('/ai-logs', controller.listAiLogs);
router.get('/voice-logs', controller.listVoiceLogs);

// ── Support Requests ───────────────────────────────────────────────────────

router.get('/support', controller.listSupport);
router.get('/support/:id', controller.getSupportDetail);
router.patch('/support/:id', controller.patchSupport);

// ── ML + System Health ─────────────────────────────────────────────────────

router.get('/ml-health', controller.getMlHealth);
router.get('/system-health', controller.getSystemHealth);

// ── Audit Logs ────────────────────────────────────────────────────────────

router.get('/audit-logs', controller.listAuditLogs);

module.exports = router;