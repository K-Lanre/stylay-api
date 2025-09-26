const crypto = require('crypto');
const { Order, sequelize } = require('../models');
const paymentService = require('../services/payment.service');
const emailService = require('../services/email.service');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Handle PayStack payment webhooks
 * Processes various PayStack webhook events including successful charges, failed charges,
 * and transfer events. Verifies webhook authenticity using HMAC signature validation.
 *
 * @param {import('express').Request} req - Express request object from PayStack webhook
 * @param {import('express').Request.body} req.body - Webhook payload from PayStack
 * @param {string} req.body.event - Webhook event type (charge.success, charge.failed, etc.)
 * @param {Object} req.body.data - Event data containing payment/transaction details
 * @param {import('express').Request.headers} req.headers - Request headers
 * @param {string} req.headers['x-paystack-signature'] - HMAC signature for verification
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming webhook processing
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Confirmation message
 * @throws {AppError} 401 - Invalid webhook signature (security breach attempt)
 * @throws {AppError} 404 - Order not found for successful charge
 * @throws {Error} 500 - Server error during webhook processing
 * @api {post} /api/v1/webhooks/paystack Handle PayStack webhook
 * @public Called by PayStack servers (no authentication required)
 *
 * @example
 * // PayStack sends webhook automatically:
 * POST /api/v1/webhooks/paystack
 * x-paystack-signature: <hmac_signature>
 * {
 *   "event": "charge.success",
 *   "data": {
 *     "reference": "STYLAY-1234567890-1",
 *     "metadata": { "orderId": 1, "userId": 123 }
 *   }
 * }
 *
 * @example Supported Events:
 * - charge.success: Payment completed successfully
 * - charge.failed: Payment failed
 * - transfer.success: Payout transfer successful
 * - transfer.failed: Payout transfer failed
 */
const handlePaystackWebhook = catchAsync(async (req, res, next) => {
  // Verify the event is from PayStack
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return next(new AppError('Invalid webhook signature', 401));
  }

  const { event, data } = req.body;
  const transaction = await sequelize.transaction();

  try {
    switch (event) {
      case 'charge.success':
        await handleSuccessfulCharge(data, transaction);
        break;
      case 'charge.failed':
        await handleFailedCharge(data, transaction);
        break;
      case 'transfer.success':
        await handleSuccessfulTransfer(data, transaction);
        break;
      case 'transfer.failed':
        await handleFailedTransfer(data, transaction);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    await transaction.commit();
    res.status(200).json({ status: 'success', message: 'Webhook processed' });
  } catch (error) {
    await transaction.rollback();
    console.error('Webhook processing error:', error);
    next(error);
  }
});

// Helper functions
async function handleSuccessfulCharge(data, transaction) {
  const { reference, metadata } = data;
  const order = await Order.findByPk(metadata.orderId, { transaction });
  
  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Update order status
  order.payment_status = 'paid';
  order.payment_reference = reference;
  order.payment_method = data.channel || 'card';
  order.paid_at = new Date();
  await order.save({ transaction });

  // Send order confirmation email
  await emailService.sendOrderConfirmation(order, metadata.userId);
  
  // Notify vendors
  await emailService.notifyVendors(order.id);
}

async function handleFailedCharge(data, transaction) {
  const { reference, metadata } = data;
  const order = await Order.findByPk(metadata.orderId, { transaction });
  
  if (order) {
    order.payment_status = 'failed';
    order.payment_reference = reference;
    await order.save({ transaction });
    
    // Send payment failed email
    await emailService.sendPaymentFailed(order, metadata.userId);
  }
}

async function handleSuccessfulTransfer(data, transaction) {
  // Update vendor balance and log successful transfer
  // This would typically update a vendor's balance in the database
  console.log('Transfer successful:', data);
}

async function handleFailedTransfer(data, transaction) {
  // Log failed transfer and notify admin
  console.error('Transfer failed:', data);
  // await emailService.sendAdminNotification('Transfer Failed', data);
}

module.exports = {
  handlePaystackWebhook,
};
