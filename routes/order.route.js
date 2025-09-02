const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const orderController = require('../controllers/order.controller');
const { 
  createOrderValidation, 
  getOrdersValidation, 
  getOrderValidation, 
  updateOrderStatusValidation, 
  cancelOrderValidation 
} = require('../validators/order.validator');
const validate = require('../middlewares/validation');

// Apply authentication middleware to all routes
router.use(protect);

// Create a new order from cart
router.post('/',  createOrderValidation, validate, orderController.createOrder);

// Get user's orders
router.get('/', getOrdersValidation, validate, orderController.getUserOrders);

// Get order by ID
router.get('/:id', getOrderValidation, validate, orderController.getOrderById);

// Update order status (admin/vendor)
router.patch('/:id/status', updateOrderStatusValidation, validate, orderController.updateOrderStatus);

// Cancel order (user)
router.post('/:id/cancel', cancelOrderValidation, validate, orderController.cancelOrder);

module.exports = router;
