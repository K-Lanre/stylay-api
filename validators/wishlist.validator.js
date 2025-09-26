const { body, param, query } = require('express-validator');
const { Wishlist, Product, ProductVariant, User } = require('../models');
const { Op } = require('sequelize');

// Validation for creating a wishlist
/**
 * Validation rules for creating a new wishlist.
 * Validates wishlist name, optional description, and prevents duplicate default wishlists.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} name - Optional, trimmed, max 100 chars
 * @property {ValidationChain} description - Optional, trimmed, max 1000 chars
 * @property {ValidationChain} is_public - Optional, boolean value
 * @property {ValidationChain} is_default - Optional, boolean, prevents duplicate defaults
 * @returns {Array} Express validator middleware array for wishlist creation
 * @example
 * // Use in route:
 * router.post('/wishlists', createWishlistValidation, createWishlist);
 */
exports.createWishlistValidation = [
  body('name')
    .optional()
    .trim()
    .isString().withMessage('Wishlist name must be a string')
    .isLength({ max: 100 }).withMessage('Wishlist name must be less than 100 characters'),

  body('description')
    .optional()
    .trim()
    .isString().withMessage('Description must be a string')
    .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),

  body('is_public')
    .optional()
    .isBoolean().withMessage('is_public must be a boolean value'),

  body('is_default')
    .optional()
    .isBoolean().withMessage('is_default must be a boolean value')
    .custom(async (value, { req }) => {
      if (value === true) {
        // Check if user already has a default wishlist
        const userId = req.user.id;
        const existingDefault = await Wishlist.findOne({
          where: {
            user_id: userId,
            is_default: true
          }
        });

        if (existingDefault) {
          throw new Error('User already has a default wishlist');
        }
      }
      return true;
    })
];

// Validation for updating a wishlist
/**
 * Validation rules for updating an existing wishlist.
 * Validates wishlist ownership and prevents duplicate default wishlists for the user.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required wishlist ID parameter, validates ownership
 * @property {ValidationChain} name - Optional, trimmed, max 100 chars
 * @property {ValidationChain} description - Optional, trimmed, max 1000 chars
 * @property {ValidationChain} is_public - Optional, boolean value
 * @property {ValidationChain} is_default - Optional, boolean, prevents duplicate defaults
 * @returns {Array} Express validator middleware array for wishlist updates
 * @example
 * // Use in route:
 * router.put('/wishlists/:id', updateWishlistValidation, updateWishlist);
 */
exports.updateWishlistValidation = [
  param('id')
    .notEmpty().withMessage('Wishlist ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist ID')
    .custom(async (value, { req }) => {
      const wishlist = await Wishlist.findOne({
        where: {
          id: value,
          user_id: req.user.id
        }
      });

      if (!wishlist) {
        throw new Error('Wishlist not found or access denied');
      }

      return true;
    }),

  body('name')
    .optional()
    .trim()
    .isString().withMessage('Wishlist name must be a string')
    .isLength({ max: 100 }).withMessage('Wishlist name must be less than 100 characters'),

  body('description')
    .optional()
    .trim()
    .isString().withMessage('Description must be a string')
    .isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),

  body('is_public')
    .optional()
    .isBoolean().withMessage('is_public must be a boolean value'),

  body('is_default')
    .optional()
    .isBoolean().withMessage('is_default must be a boolean value')
    .custom(async (value, { req }) => {
      if (value === true) {
        const wishlistId = req.params.id;
        const userId = req.user.id;

        // Check if another wishlist is already set as default
        const existingDefault = await Wishlist.findOne({
          where: {
            user_id: userId,
            is_default: true,
            id: { [Op.ne]: wishlistId }
          }
        });

        if (existingDefault) {
          throw new Error('User already has another default wishlist');
        }
      }
      return true;
    })
];

// Validation for wishlist ID parameter
/**
 * Validation rules for wishlist ID parameter validation.
 * Ensures the provided wishlist ID is valid and user has access.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required wishlist ID parameter, validates ownership
 * @returns {Array} Express validator middleware array for wishlist ID validation
 * @example
 * // Use in route:
 * router.get('/wishlists/:id', wishlistIdValidation, getWishlist);
 */
exports.wishlistIdValidation = [
  param('id')
    .notEmpty().withMessage('Wishlist ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist ID')
    .custom(async (value, { req }) => {
      const wishlist = await Wishlist.findOne({
        where: {
          id: value,
          user_id: req.user.id
        }
      });

      if (!wishlist) {
        throw new Error('Wishlist not found or access denied');
      }

      return true;
    })
];

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
 * router.post('/wishlists/:id/items', addItemValidation, addItemToWishlist);
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
 * router.put('/wishlists/items/:itemId', updateItemValidation, updateWishlistItem);
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
 * router.delete('/wishlists/items/:itemId', wishlistItemIdValidation, removeWishlistItem);
 */
exports.wishlistItemIdValidation = [
  param('itemId')
    .notEmpty().withMessage('Wishlist item ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist item ID')
];

// Validation for getting wishlists
/**
 * Validation rules for retrieving user wishlists with pagination.
 * Validates pagination parameters for wishlist listing.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} page - Optional, positive integer >= 1
 * @property {ValidationChain} limit - Optional, integer 1-100
 * @property {ValidationChain} include_items - Optional, boolean value
 * @returns {Array} Express validator middleware array for wishlist retrieval
 * @example
 * // Use in route:
 * router.get('/wishlists', getWishlistsValidation, getUserWishlists);
 */
exports.getWishlistsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('include_items')
    .optional()
    .isBoolean().withMessage('include_items must be a boolean value')
];

// Validation for getting wishlist items
/**
 * Validation rules for retrieving items in a specific wishlist.
 * Validates wishlist ID and pagination/filtering parameters.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required wishlist ID parameter
 * @property {ValidationChain} page - Optional, positive integer >= 1
 * @property {ValidationChain} limit - Optional, integer 1-100
 * @property {ValidationChain} priority - Optional, low/medium/high filter
 * @property {ValidationChain} sort - Optional, priority/price/added_at sorting
 * @returns {Array} Express validator middleware array for wishlist items retrieval
 * @example
 * // Use in route:
 * router.get('/wishlists/:id/items', getWishlistItemsValidation, getWishlistItems);
 */
exports.getWishlistItemsValidation = [
  param('id')
    .notEmpty().withMessage('Wishlist ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist ID'),

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

// Helper function to check if user owns wishlist
/**
 * Validates ownership of a wishlist by a specific user.
 * Checks if the wishlist exists and belongs to the provided user.
 * @param {number} wishlistId - Wishlist ID to validate
 * @param {number} userId - User ID to check ownership against
 * @returns {Promise<Object>} Wishlist instance if validation passes
 * @throws {Error} When wishlist not found or access denied
 * @example
 * // Validate wishlist ownership
 * const wishlist = await validateWishlistOwnership(wishlistId, userId);
 */
exports.validateWishlistOwnership = async (wishlistId, userId) => {
  const wishlist = await Wishlist.findOne({
    where: {
      id: wishlistId,
      user_id: userId
    }
  });

  if (!wishlist) {
    throw new Error('Wishlist not found or access denied');
  }

  return wishlist;
};

// Helper function to check if wishlist item belongs to user's wishlist
/**
 * Validates ownership of a wishlist item by checking if it belongs to user's wishlists.
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