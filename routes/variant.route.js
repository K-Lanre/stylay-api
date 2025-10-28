// routes/variant.route.js
const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const variantController = require('../controllers/variant.controller');
const { protect, isVendor, isAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validation');

// Apply authentication to all routes
router.use(protect);

/**
 * @desc    Get all variant types
 * @route   GET /api/v1/variants/types
 * @access  Private (All authenticated users)
 */
router.get('/types', variantController.getVariantTypes);

/**
 * @desc    Create a new variant type
 * @route   POST /api/v1/variants/types
 * @access  Private (Admin only)
 */
router.post('/types', isAdmin, [
  body('name')
    .trim()
    .notEmpty().withMessage('Variant type name is required')
    .isString().withMessage('Variant type name must be a string')
    .isLength({ min: 2, max: 50 }).withMessage('Variant type name must be between 2 and 50 characters'),
  body('display_name')
    .optional()
    .trim()
    .isString().withMessage('Display name must be a string')
    .isLength({ max: 100 }).withMessage('Display name cannot exceed 100 characters'),
  body('sort_order')
    .optional()
    .isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  validate
], variantController.createVariantType);

/**
 * @desc    Update a variant type
 * @route   PUT /api/v1/variants/types/:id
 * @access  Private (Admin only)
 */
router.put('/types/:id', isAdmin, [
  param('id').isInt({ min: 1 }).withMessage('Invalid variant type ID'),
  body('display_name')
    .optional()
    .trim()
    .isString().withMessage('Display name must be a string')
    .isLength({ max: 100 }).withMessage('Display name cannot exceed 100 characters'),
  body('sort_order')
    .optional()
    .isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  validate
], variantController.updateVariantType);

/**
 * @desc    Delete a variant type
 * @route   DELETE /api/v1/variants/types/:id
 * @access  Private (Admin only)
 */
router.delete('/types/:id', isAdmin, [
  param('id').isInt({ min: 1 }).withMessage('Invalid variant type ID'),
  validate
], variantController.deleteVariantType);

/**
 * @desc    Get combinations for a product
 * @route   GET /api/v1/variants/products/:productId/combinations
 * @access  Private (Vendor/Admin)
 */
router.get('/products/:productId/combinations', [
  param('productId').isInt({ min: 1 }).withMessage('Invalid product ID'),
  validate
], variantController.getProductCombinations);

/**
 * @desc    Get a specific combination
 * @route   GET /api/v1/variants/combinations/:id
 * @access  Private (Vendor/Admin)
 */
router.get('/combinations/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid combination ID'),
  validate
], variantController.getCombinationById);

/**
 * @desc    Update combination stock
 * @route   PATCH /api/v1/variants/combinations/:id/stock
 * @access  Private (Vendor/Admin)
 */
router.patch('/combinations/:id/stock', [
  param('id').isInt({ min: 1 }).withMessage('Invalid combination ID'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  validate
], variantController.updateCombinationStock);

/**
 * @desc    Update combination price modifier
 * @route   PATCH /api/v1/variants/combinations/:id/price
 * @access  Private (Vendor/Admin)
 */
router.patch('/combinations/:id/price', [
  param('id').isInt({ min: 1 }).withMessage('Invalid combination ID'),
  body('price_modifier').isFloat().withMessage('Price modifier must be a number'),
  validate
], variantController.updateCombinationPrice);

/**
 * @desc    Toggle combination active status
 * @route   PATCH /api/v1/variants/combinations/:id/status
 * @access  Private (Vendor/Admin)
 */
router.patch('/combinations/:id/status', [
  param('id').isInt({ min: 1 }).withMessage('Invalid combination ID'),
  body('is_active').isBoolean().withMessage('Active status must be a boolean'),
  validate
], variantController.toggleCombinationStatus);

module.exports = router;
