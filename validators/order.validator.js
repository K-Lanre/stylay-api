const { Address } = require('../models'); // Defer import
const { body, param, query } = require('express-validator');

// Validation for creating an order
exports.createOrderValidation = [
  body('addressId')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID')
    .custom(async (value, { req }) => {
      if (!req.user || !req.user.id) {
        throw new Error('User not authenticated or user ID missing');
      }
      const address = await Address.findOne({
        where: {
          id: value,
          user_id: req.user.id
        }
      });
      if (!address) {
        throw new Error('Address not found or does not belong to user');
      }
      return true;
    }),
  
  body('shippingCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Shipping cost must be a positive number')
    .toFloat(),
    
  body('taxAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Tax amount must be a positive number')
    .toFloat(),
  
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
    
  body('items')
    .isArray({ min: 1 }).withMessage('At least one order item is required')
    .custom((items, { req }) => {
      if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
      }
      
      for (const [index, item] of items.entries()) {
        if (!item.product_id) {
          throw new Error(`Item ${index + 1}: Product ID is required`);
        }
        
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new Error(`Item ${index + 1}: Quantity must be a positive integer`);
        }
        
        if (item.variant_id && !Number.isInteger(parseInt(item.variant_id))) {
          throw new Error(`Item ${index + 1}: Invalid variant ID`);
        }
      }
      return true;
    })
];

// Validation for getting orders
exports.getOrdersValidation = [
  query('status')
    .optional()
    .isString().withMessage('Status must be a string')
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Invalid status'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];

// Validation for getting a single order
exports.getOrderValidation = [
  param('id')
    .notEmpty().withMessage('Order ID is required')
    .isInt({ min: 1 }).withMessage('Invalid order ID')
    .custom(async (value, { req }) => {
      const { Order } = require('../models'); // Defer import
      const order = await Order.findOne({
        where: {
          id: value,
          user_id: req.user.id
        }
      });
      if (!order) {
        throw new Error('Order not found or does not belong to user');
      }
      return true;
    })
];

// Validation for cancelling an order
exports.cancelOrderValidation = [
  param('id')
    .notEmpty().withMessage('Order ID is required')
    .isInt({ min: 1 }).withMessage('Invalid order ID')
    .custom(async (value, { req }) => {
      const { Order } = require('../models'); // Defer import
      const order = await Order.findOne({
        where: {
          id: value,
          user_id: req.user.id,
          order_status: ['pending', 'processing']
        }
      });
      if (!order) {
        throw new Error('Order not found, already cancelled, or cannot be cancelled');
      }
      return true;
    })
];

// Validation for verifying payment
exports.verifyPaymentValidation = [
  param('reference')
    .notEmpty().withMessage('Payment reference is required')
    .isString().withMessage('Invalid payment reference')
    .custom(async (value, { req }) => {
      const { PaymentTransaction, Order } = require('../models'); // Defer import
      // Check if transaction exists and belongs to user
      const transaction = await PaymentTransaction.findOne({
        where: {
          reference: value,
          user_id: req.user.id
        },
        include: [Order]
      });

      if (!transaction) {
        throw new Error('Transaction not found or does not belong to user');
      }

      // Skip verification if already successful
      if (transaction.status === 'success') {
        return true;
      }

      // Check if order exists and is in a valid state for payment
      if (!transaction.order ||
          !['pending', 'processing'].includes(transaction.order.order_status)) {
        throw new Error('Order is not in a valid state for payment verification');
      }

      return true;
    })
];

// Validation for updating order status
exports.updateOrderStatusValidation = [
  param('id')
    .notEmpty().withMessage('Order ID is required')
    .isInt({ min: 1 }).withMessage('Invalid order ID'),
  
  body('status')
    .notEmpty().withMessage('Status is required')
    .isString().withMessage('Status must be a string')
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Invalid status'),
    
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string'),
    
  body('trackingNumber')
    .if(body('status').equals('shipped'))
    .notEmpty().withMessage('Tracking number is required for shipped orders'),
    
  body('carrier')
    .if(body('status').equals('shipped'))
    .notEmpty().withMessage('Carrier is required for shipped orders'),
    
  body('estimatedDelivery')
    .if(body('status').equals('shipped'))
    .optional()
    .isISO8601().withMessage('Invalid estimated delivery date')
];

// Validation for cancelling an order (this was a duplicate, keeping the first one)
// exports.cancelOrderValidation = [
//   param('id')
//     .notEmpty().withMessage('Order ID is required')
//     .isInt({ min: 1 }).withMessage('Invalid order ID'),
  
//   body('reason')
//     .optional()
//     .isString().withMessage('Reason must be a string')
//     .isLength({ max: 1000 }).withMessage('Reason must be less than 1000 characters')
// ];
