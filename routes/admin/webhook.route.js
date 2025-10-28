const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../../middlewares/auth');

// All routes require admin authentication
router.use(protect);
router.use(isAdmin);

// Admin routes for webhooks
router.get('/all', (req, res) => {
  // Get all webhooks/logs for admin
  res.status(200).json({
    status: 'success',
    message: 'Webhook management endpoint',
    data: {
      webhooks: [],
      total: 0
    }
  });
});

router.post('/test', (req, res) => {
  // Test endpoint for admin to verify webhook is working
  res.status(200).json({ status: 'success', message: 'Webhook test successful' });
});

module.exports = router;
