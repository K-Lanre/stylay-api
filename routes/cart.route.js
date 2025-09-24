const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validation');
const {
  getCartValidation,
  addToCartValidation,
  updateCartItemValidation,
  removeFromCartValidation,
  clearCartValidation,
  getCartSummaryValidation
} = require('../validators/cart.validator');

// All cart routes require authentication (users must be logged in or provide session ID)
router.use(protect);

// Get cart
router.get('/', getCartValidation, validate, cartController.getCart);

// Add item to cart
router.post('/items', addToCartValidation, validate, cartController.addToCart);

// Update cart item
router.put('/items/:itemId', updateCartItemValidation, validate, cartController.updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', removeFromCartValidation, validate, cartController.removeFromCart);

// Clear cart
router.delete('/clear', clearCartValidation, validate, cartController.clearCart);

// Get cart summary (for checkout)
router.get('/summary', getCartSummaryValidation, validate, cartController.getCartSummary);

module.exports = router;