const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login',    authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me',        authMiddleware, authController.getMe);
router.put('/me',        authMiddleware, authController.updateMe);
router.put('/password',  authMiddleware, authController.changePassword);
router.delete('/me',     authMiddleware, authController.deleteMe);
router.get('/preferences', authMiddleware, authController.getPreferenceSettings);
router.put('/preferences', authMiddleware, authController.updatePreferenceSettings);
router.get('/security', authMiddleware, authController.getSecuritySettings);
router.put('/security', authMiddleware, authController.updateSecuritySettings);
router.get('/notifications', authMiddleware, authController.getNotificationSettings);
router.put('/notifications', authMiddleware, authController.updateNotificationSettings);

module.exports = router;