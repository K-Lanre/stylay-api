const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

// PayStack webhook endpoint (no authentication as it's called by PayStack)
router.post('/paystack', webhookController.handlePaystackWebhook);



module.exports = router;
