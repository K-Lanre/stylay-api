const express = require('express');
const router = express.Router();
const { param, body, query } = require('express-validator');
const productController = require('../controllers/product.controller');
const { protect, isVendor, isAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validation');
const {
  createProductValidation,
  updateProductValidation,
  getProductsValidation,
  getProductByIdentifierValidation,
  deleteProductValidation,
  getVendorProductsValidation
} = require('../validators/product.validator');

// Public routes
// More specific routes first (with constraints)
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

// Admin-only routes
router.use(isAdmin);

/**
 * @desc    Get all products (Admin)
 * @route   GET /api/v1/products/all/admin
 * @access  Private/Admin
 */
router.get('/all/admin', getProductsValidation, validate, productController.getAllProducts);

/**
 * @desc    Update any product (Admin)
 * @route   PUT /api/v1/products/:id/admin
 * @access  Private/Admin
 */
router.put('/:id/admin', updateProductValidation, validate, productController.adminUpdateProduct);

/**
 * @desc    Delete any product (Admin)
 * @route   DELETE /api/v1/products/:id/admin
 * @access  Private/Admin
 */
router.delete('/:id/admin', deleteProductValidation, validate, productController.adminDeleteProduct);

/**
 * @desc    Update product status (Admin)
 * @route   PATCH /api/v1/products/:id/admin/status
 * @access  Private/Admin
 */
router.patch(
  '/:id/admin/status',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['active', 'inactive', 'banned', 'out_of_stock', 'draft'])
      .withMessage('Invalid status value'),
    ],
    validate,
  productController.updateProductStatus
);

/**
 * @desc    Get products by status (Admin)
 * @route   GET /api/v1/products/:id/admin/status/:status
 * @access  Private/Admin
 */
router.get(
  '/:id/admin/status/:status',
  [
    param('status')
      .isIn(['active', 'inactive', 'banned', 'out_of_stock', 'draft', 'all'])
      .withMessage('Invalid status value'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  productController.getProductsByStatus
);

module.exports = router;
