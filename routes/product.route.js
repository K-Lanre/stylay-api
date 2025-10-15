const express = require('express');
const router = express.Router();
const { param, body, query } = require('express-validator');
const productController = require('../controllers/product.controller');
const { protect, isVendor } = require('../middlewares/auth');
const validate = require('../middlewares/validation');
const {
  createProductValidation,
  updateProductValidation,
  getProductsValidation,
  getProductByIdentifierValidation,
  deleteProductValidation,
  getVendorProductsValidation
} = require('../validators/product.validator');
const reviewController = require('../controllers/review.controller');
const { listReviewsValidation } = require('../validators/review.validator');
// Public routes
// More specific routes first (with constraints)

/**
 * @desc    Get reviews for a specific product
 * @route   GET /api/v1/products/:productId/reviews
 * @access  Public
 */
router.get('/:productId/reviews', listReviewsValidation, reviewController.getReviewsByProduct);

router.get('/:identifier', getProductByIdentifierValidation, validate, productController.getProductByIdentifier);

// General route for listing products with query parameters
router.get('/', getProductsValidation, validate, productController.getProducts);
router.get('/vendor/:id', getVendorProductsValidation, validate, productController.getProductsByVendor);

// Protected routes (require authentication)
router.use(protect);

/**
 * @desc    Get product analytics
 * @route   GET /api/v1/products/:id/analytics
 * @access  Private (Vendor/Admin)
 */
router.get('/:id/analytics', [
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  validate,
], productController.getProductAnalytics);

/**
 * @desc    Get vendor analytics summary
 * @route   GET /api/v1/products/analytics/vendor
 * @access  Private (Vendor)
 */
router.get('/analytics/vendor', isVendor, productController.getVendorAnalytics);

// Vendor-only routes
router.post('/', isVendor, createProductValidation, validate, productController.createProduct);
router.put('/:id', isVendor, productController.updateProduct);
router.delete('/:id', isVendor, deleteProductValidation, validate, productController.deleteProduct);

module.exports = router;
