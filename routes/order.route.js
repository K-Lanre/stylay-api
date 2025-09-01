const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const orderController = require('../controllers/order.controller');
const { 
  createOrderValidation, 
  getOrdersValidation, 
  getOrderValidation, 
  updateOrderStatusValidation, 
  cancelOrderValidation 
} = require('../validators/order.validator');
const { validate } = require('../middlewares/validate');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Create a new order from cart
router.post('/', validate(createOrderValidation), orderController.createOrder);

// Get user's orders
router.get('/', validate(getOrdersValidation), orderController.getUserOrders);

// Get order by ID
router.get('/:id', validate(getOrderValidation), orderController.getOrderById);

// Update order status (admin/vendor)
router.patch('/:id/status', validate(updateOrderStatusValidation), orderController.updateOrderStatus);

// Cancel order (user)
router.post('/:id/cancel', validate(cancelOrderValidation), orderController.cancelOrder);

module.exports = router;
