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
 * @route   GET /api/v1/products/vendor/analytics
 * @access  Private (Vendor)
 */
router.get('/vendor/analytics', isVendor, productController.getVendorAnalytics);

// Vendor-only routes
router.post('/', isVendor, createProductValidation, validate, productController.createProduct);
router.put('/:id', isVendor, productController.updateProduct);
router.delete('/:id', isVendor, deleteProductValidation, validate, productController.deleteProduct);

// Admin-only routes
router.use(isAdmin);

/**
 * @desc    Get all products (Admin)
 * @route   GET /api/v1/products/admin/all
 * @access  Private/Admin
 */
router.get('/admin/all', getProductsValidation, validate, productController.getAllProducts);

/**
 * @desc    Update any product (Admin)
 * @route   PUT /api/v1/products/admin/:id
 * @access  Private/Admin
 */
router.put('/admin/:id', updateProductValidation, validate, productController.adminUpdateProduct);

/**
 * @desc    Delete any product (Admin)
 * @route   DELETE /api/v1/products/admin/:id
 * @access  Private/Admin
 */
router.delete('/admin/:id', deleteProductValidation, validate, productController.adminDeleteProduct);

/**
 * @desc    Update product status (Admin)
 * @route   PATCH /api/v1/products/admin/:id/status
 * @access  Private/Admin
 */
router.patch(
  '/admin/:id/status',
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
 * @route   GET /api/v1/products/admin/status/:status
 * @access  Private/Admin
 */
router.get(
  '/admin/status/:status',
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
