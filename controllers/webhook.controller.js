const crypto = require('crypto');
const { Order, sequelize } = require('../models');
const paymentService = require('../services/payment.service');
const emailService = require('../services/email.service');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Handle PayStack webhook
 * @route   POST /api/v1/webhooks/paystack
 * @access  Public (handled by PayStack)
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
