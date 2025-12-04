const { param } = require('express-validator');
const { Product } = require('../models');

// Validation for adding item to wishlist
/**
 * Validation rules for adding products to a wishlist.
 * Validates product existence.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} product_id - Required, positive integer, validates product exists and is active
 * @returns {Array} Express validator middleware array for adding wishlist items
 * @example
 * // Use in route:
 * router.post('/wishlist/items', addItemValidation, addItemToWishlist);
 */
exports.addItemValidation = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .isInt({ min: 1 }).withMessage('Invalid product ID')
    .custom(async (value) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error('Product not found');
      }
      if (product.status !== 'active') {
        throw new Error('Product is not available');
      }
      return true;
    })
];

// Validation for wishlist item ID parameter
/**
 * Validation rules for wishlist item ID parameter validation.
 * Ensures the provided wishlist item ID is valid.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} itemId - Required wishlist item ID parameter, positive integer
 * @returns {Array} Express validator middleware array for wishlist item ID validation
 * @example
 * // Use in route:
 * router.delete('/wishlist/items/:itemId', wishlistItemIdValidation, removeWishlistItem);
 */
exports.wishlistItemIdValidation = [
  param('itemId')
    .notEmpty().withMessage('Wishlist item ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist item ID')
];
