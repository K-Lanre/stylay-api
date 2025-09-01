const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const cartController = require('../controllers/cart.controller');
const { 
  addToCartValidation, 
  updateCartItemValidation, 
  removeFromCartValidation, 
  clearCartValidation 
} = require('../validators/cart.validator');
const validate = require('../middlewares/validation');

// Apply authentication middleware to all routes
router.use(protect);

// Get user's cart
router.get('/', cartController.getCart);

// Add item to cart
router.post('/items', addToCartValidation, validate, cartController.addToCart);

// Update cart item quantity
router.put('/items/:itemId', updateCartItemValidation, validate, cartController.updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', removeFromCartValidation, validate, cartController.removeFromCart);

// Clear cart
router.delete('/clear', clearCartValidation, validate, cartController.clearCart);

module.exports = router;
