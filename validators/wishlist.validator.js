const { body, param, query } = require('express-validator');
const { Wishlist, Product, ProductVariant, User } = require('../models');
const { Op } = require('sequelize');

// Validation for creating a wishlist
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
exports.wishlistItemIdValidation = [
  param('itemId')
    .notEmpty().withMessage('Wishlist item ID is required')
    .isInt({ min: 1 }).withMessage('Invalid wishlist item ID')
];

// Validation for getting wishlists
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