const { body, param } = require('express-validator');
const { Cart, Product } = require('../models');

// Validation for adding item to cart
exports.addToCartValidation = [
  body('productId')
    .notEmpty().withMessage('Product ID is required')
    .isInt({ min: 1 }).withMessage('Invalid product ID')
    .custom(async (value) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
  
  body('quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1')
];

// Validation for updating cart item
exports.updateCartItemValidation = [
  param('itemId')
    .notEmpty().withMessage('Item ID is required')
    .isInt({ min: 1 }).withMessage('Invalid item ID'),
  
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 0 }).withMessage('Quantity must be 0 or more')
];

// Validation for removing item from cart
exports.removeFromCartValidation = [
  param('itemId')
    .notEmpty().withMessage('Item ID is required')
    .isInt({ min: 1 }).withMessage('Invalid item ID')
];

// Validation for clearing cart
exports.clearCartValidation = [
  // No parameters needed for clearing cart
];
