const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { protect, staffOrAdmin } = require('../middleware/authMiddleware');

// Protect all routes (except tracking)
router.use(['/user-groups', '/templates', '/send', '/analytics', '/system-config'], protect);
router.use(['/user-groups', '/templates', '/send', '/analytics', '/system-config'], staffOrAdmin);

// System email configuration route
router.get('/system-config', emailController.getSystemEmailConfig);

// Email management routes
router.get('/user-groups', emailController.getUserGroups);
router.get('/templates', emailController.getEmailTemplates);
router.post('/templates', emailController.saveEmailTemplate);

// Send email route
router.post('/send', emailController.uploadAttachments, emailController.sendBulkEmail);

// Analytics route
router.get('/analytics/:campaignId', emailController.getEmailAnalytics);

// Email tracking route (public)
router.get('/track/:trackingId', emailController.trackEmailOpen);

module.exports = router;