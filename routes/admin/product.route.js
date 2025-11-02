const express = require('express');
const router = express.Router();
const { param, body, query } = require('express-validator');
const productController = require('../../controllers/product.controller');
const { protect, loadUserRoles, isAdmin } = require('../../middlewares/auth');
const validate = require('../../middlewares/validation');
const {
  updateProductValidation,
  deleteProductValidation,
  getProductsValidation,
  createProductValidation
} = require('../../validators/product.validator');

// Apply authentication and permission loading to all routes
router.use(protect);
router.use(loadUserRoles);

/**
 * @desc    Get all products (Admin)
 * @route   GET /api/admin/products/all
 * @access  Private/Admin
 */
router.get('/all', isAdmin, getProductsValidation, validate, productController.getAllProducts);

/**
 * @desc    Create new product (Admin)
 * @route   POST /api/admin/products
 * @access  Private/Admin
 */
router.post('/', isAdmin, createProductValidation, validate, productController.createProduct);

/**
 * @desc    Update any product (Admin)
 * @route   PUT /api/admin/products/:id
 * @access  Private/Admin
 */
router.put('/:id', isAdmin, updateProductValidation, validate, productController.adminUpdateProduct);

/**
 * @desc    Delete any product (Admin)
 * @route   DELETE /api/admin/products/:id
 * @access  Private/Admin
 */
router.delete('/:id', isAdmin, deleteProductValidation, validate, productController.adminDeleteProduct);

/**
 * @desc    Update product status (Admin)
 * @route   PATCH /api/admin/products/:id/status
 * @access  Private/Admin
 */
router.patch(
  '/:id/status',
  isAdmin,
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
 * @route   GET /api/admin/products/status/:status
 * @access  Private/Admin
 */
router.get(
  '/status/:status',
  isAdmin,
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

/**
 * @desc    Get product analytics (Admin)
 * @route   GET /api/v1/admin/products/:id/analytics
 * @access  Private/Admin
 */
router.get(
  '/:id/analytics',
  isAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  productController.getProductAnalytics
);

module.exports = router;
