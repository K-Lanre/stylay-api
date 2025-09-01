const { body, param, query } = require('express-validator');
const { Order, Address } = require('../models');

// Validation for creating an order
exports.createOrderValidation = [
  body('addressId')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID')
    .custom(async (value, { req }) => {
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
  
  body('paymentMethod')
    .optional()
    .isString().withMessage('Payment method must be a string')
    .isIn(['card', 'bank_transfer', 'paypal', 'cash_on_delivery']).withMessage('Invalid payment method'),
  
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
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

// Validation for updating order status (admin/vendor)
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
    .isString().withMessage('Notes must be a string')
    .isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
];

// Validation for cancelling an order
exports.cancelOrderValidation = [
  param('id')
    .notEmpty().withMessage('Order ID is required')
    .isInt({ min: 1 }).withMessage('Invalid order ID'),
  
  body('reason')
    .optional()
    .isString().withMessage('Reason must be a string')
    .isLength({ max: 1000 }).withMessage('Reason must be less than 1000 characters')
];
