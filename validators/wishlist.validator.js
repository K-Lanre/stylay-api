const { body, param, query } = require('express-validator');
const { Product, ProductVariant } = require('../models');

// Validation for adding item to wishlist
/**
 * Validation rules for adding products to a wishlist.
 * Validates product existence, variant relationships, and quantity limits.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} product_id - Required, positive integer, validates product exists and is active
 * @property {ValidationChain} variant_id - Optional, validates variant belongs to product
 * @property {ValidationChain} quantity - Optional, 1-999 range
 * @property {ValidationChain} notes - Optional, trimmed, max 500 chars
 * @property {ValidationChain} priority - Optional, low/medium/high values
 * @returns {Array} Express validator middleware array for adding wishlist items
 * @example
 * // Use in route:
 * router.post('/wishlist/items', addItemValidation, addItemToWishlist);
 */
exports.addItemValidation = [
  body('product_id')
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
    }),

  body('variant_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid variant ID')
    .custom(async (value, { req }) => {
      if (value) {
        const variant = await ProductVariant.findOne({
          where: {
            id: value,
            product_id: req.body.product_id
          }
        });

        if (!variant) {
          throw new Error('Product variant not found');
        }
      }
      return true;
    }),

  body('quantity')
    .optional()
    .isInt({ min: 1, max: 999 }).withMessage('Quantity must be between 1 and 999'),

  body('notes')
    .optional()
    .trim()
    .isString().withMessage('Notes must be a string')
    .isLength({ max: 500 }).withMessage('Notes must be less than 500 characters'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
];

// Validation for updating wishlist item
/**
 * Validation rules for updating wishlist item properties.
 * Validates quantity and other optional item attributes.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} quantity - Optional, 1-999 range
 * @property {ValidationChain} notes - Optional, trimmed, max 500 chars
 * @property {ValidationChain} priority - Optional, low/medium/high values
 * @returns {Array} Express validator middleware array for updating wishlist items
 * @example
 * // Use in route:
 * router.put('/wishlist/items/:itemId', updateItemValidation, updateWishlistItem);
 */
exports.updateItemValidation = [
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 999 }).withMessage('Quantity must be between 1 and 999'),

  body('notes')
    .optional()
    .trim()
    .isString().withMessage('Notes must be a string')
    .isLength({ max: 500 }).withMessage('Notes must be less than 500 characters'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
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

// Validation for getting wishlist items
/**
 * Validation rules for retrieving items in user's wishlist.
 * Validates pagination/filtering parameters for wishlist items.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} page - Optional, positive integer >= 1
 * @property {ValidationChain} limit - Optional, integer 1-100
 * @property {ValidationChain} priority - Optional, low/medium/high filter
 * @property {ValidationChain} sort - Optional, priority/price/added_at sorting
 * @returns {Array} Express validator middleware array for wishlist items retrieval
 * @example
 * // Use in route:
 * router.get('/wishlist/items', getWishlistItemsValidation, getWishlistItems);
 */
exports.getWishlistItemsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),

  query('sort')
    .optional()
    .isIn(['priority', 'price', 'added_at']).withMessage('Sort must be priority, price, or added_at')
];

// Validation for move to cart
/**
 * Validation rules for moving items from wishlist to cart.
 * Validates wishlist item ID for the operation.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} wishlist_item_id - Required, valid wishlist item ID
 * @returns {Array} Express validator middleware array for move to cart
 * @example
 * // Use in route:
 * router.post('/wishlist/move-to-cart', moveToCartValidation, moveToCart);
 */
exports.moveToCartValidation = [
  body('wishlist_item_id')
    .notEmpty().withMessage('Wishlist item ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist item ID')
];

// Helper function to validate wishlist item ownership
/**
 * Validates ownership of a wishlist item by checking if it belongs to the user's wishlist.
 * Performs a join query to verify item ownership through wishlist relationship.
 * @param {number} itemId - Wishlist item ID to validate
 * @param {number} userId - User ID to check ownership against
 * @returns {Promise<Object>} Wishlist item instance with wishlist relationship if validation passes
 * @throws {Error} When wishlist item not found or access denied
 * @example
 * // Validate wishlist item ownership
 * const item = await validateWishlistItemOwnership(itemId, userId);
 */
exports.validateWishlistItemOwnership = async (itemId, userId) => {
  const { Wishlist, WishlistItem } = require('../models');
  
  const item = await WishlistItem.findOne({
    where: { id: itemId },
    include: [
      {
        model: Wishlist,
        as: 'wishlist',
        where: { user_id: userId },
        required: true
      }
    ]
  });

  if (!item) {
    throw new Error('Wishlist item not found or access denied');
  }

  return item;
};