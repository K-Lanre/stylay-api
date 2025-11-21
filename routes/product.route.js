const express = require('express');
const router = express.Router();
const { param, body, query } = require('express-validator');
const productController = require('../controllers/product.controller');
const recentlyViewedController = require('../controllers/recently-viewed.controller');
const { protect, isVendor } = require('../middlewares/auth');
const validate = require('../middlewares/validation');
const {
  createProductValidation,
  getProductsValidation,
  getProductByIdentifierValidation,
  deleteProductValidation,
  getVendorProductsValidation
} = require('../validators/product.validator');
const reviewController = require('../controllers/review.controller');
const { listReviewsValidation } = require('../validators/review.validator');
// Public routes
// More specific routes first (with parameters), then generic routes

/**
 * @desc    Get recently viewed products
 * @route   GET /api/v1/products/recent
 * @access  Public
 */
router.get('/recent', recentlyViewedController.getRecentViews);

/**
 * @desc    Get viewing statistics
 * @route   GET /api/v1/products/recent/stats
 * @access  Public
 */
router.get('/recent/stats', recentlyViewedController.getViewStatistics);

/**
 * @desc    Clear recently viewed products
 * @route   DELETE /api/v1/products/recent
 * @access  Public
 */
router.delete('/recent', recentlyViewedController.clearRecentViews);

/**
 * @desc    Anonymize user view data (GDPR compliance)
 * @route   PATCH /api/v1/products/recent/anonymize
 * @access  Public
 */
router.patch('/recent/anonymize', recentlyViewedController.anonymizeUserData);

/**
 * @desc    Get reviews for a specific product
 * @route   GET /api/v1/products/:productId/reviews
 * @access  Public
 */
router.get('/:productId/reviews', listReviewsValidation, reviewController.getReviewsByProduct);

/**
 * @desc    Get products by vendor ID
 * @route   GET /api/v1/products/vendor/:id
 * @access  Public
 */
router.get('/vendor/:id', getVendorProductsValidation, validate, productController.getProductsByVendor);

/**
 * @desc    Get product by ID or slug
 * @route   GET /api/v1/products/:identifier
 * @access  Public
 */
router.get('/:identifier', getProductByIdentifierValidation, validate, productController.getProductByIdentifier);

// General route for listing products - MUST be last to avoid shadowing
router.get('/', getProductsValidation, validate, productController.getProducts);

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
