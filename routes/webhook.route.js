const express = require('express');
const webhookController = require('../controllers/webhook.controller');
const { protect, isAdmin } = require('../middlewares/auth');

const router = express.Router();

// PayStack webhook endpoint (no authentication as it's called by PayStack)
router.post('/paystack', webhookController.handlePaystackWebhook);

// Protected webhook endpoints (for admin operations)
router.post('/test', protect, isAdmin, (req, res) => {
  // Test endpoint for admin to verify webhook is working
  res.status(200).json({ status: 'success', message: 'Webhook test successful' });
});

module.exports = router;
