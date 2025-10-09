const { body, query, param, validationResult } = require('express-validator');
const { Product, Review } = require('../models');

/**
 * Middleware function to validate request and format validation errors.
 * Processes express-validator errors and returns formatted error response.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value,
      location: err.location
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errorMessages,
      meta: {
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

/**
 * Validation rules for creating a review.
 * Validates product_id, user_id, rating, and optional comment.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 */
exports.createReviewValidation = [
  body('product_id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid positive integer')
    .custom(async (product_id) => {
      const product = await Product.findByPk(product_id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),

  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters')
];

/**
 * Validation rules for updating a review.
 * Validates optional product_id, rating, and comment.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 */
exports.updateReviewValidation = [
  body('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid positive integer')
    .custom(async (product_id) => {
      if (product_id) {
        const product = await Product.findByPk(product_id);
        if (!product) {
          throw new Error('Product not found');
        }
      }
      return true;
    }),

  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters')
];

/**
 * Validation rules for listing reviews.
 * Validates query parameters for pagination and filtering.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 */
exports.listReviewsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid positive integer'),

  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a valid positive integer'),

  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating filter must be between 1 and 5')
];

/**
 * Validation rules for review ID parameter.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 */
exports.reviewIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Review ID must be a valid positive integer')
    .custom(async (id) => {
      const review = await Review.findByPk(id);
      if (!review) {
        throw new Error('Review not found');
      }
      return true;
    })
];

/**
 * Express middleware to handle validation errors using express-validator.
 * Checks for validation errors and returns formatted error response if any exist.
 */
exports.validate = validateRequest;