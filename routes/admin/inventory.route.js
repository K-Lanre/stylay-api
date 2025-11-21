const express = require('express');
const router = express.Router();
const { param, body, query } = require('express-validator');
const inventoryController = require('../../controllers/inventory.controller');
const { protect, isAdmin } = require('../../middlewares/auth');
const validate = require('../../middlewares/validation');

// Protect all admin routes
router.use(protect, isAdmin);

// Admin routes
router.get(
  '/all',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  ],
  validate,
  inventoryController.getAllInventory
);

router.get(
  '/vendor/:vendorId',
  [
    param('vendorId').isInt({ min: 1 }).withMessage('Invalid vendor ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  ],
  validate,
  inventoryController.getVendorInventory
);

router.get(
  '/low-stock',
  [
    query('threshold').optional().isInt({ min: 0 }).withMessage('Threshold must be a non-negative integer'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  ],
  validate,
  inventoryController.getGlobalLowStockItems
);

router.get(
  '/history',
  [
    query('productId').optional().isInt({ min: 1 }).withMessage('Product ID must be an integer'),
    query('vendorId').optional().isInt({ min: 1 }).withMessage('Vendor ID must be an integer'),
    query('startDate').optional().isISO8601().toDate().withMessage('Start date must be a valid date (YYYY-MM-DD)'),
    query('endDate').optional().isISO8601().toDate().withMessage('End date must be a valid date (YYYY-MM-DD)'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  ],
  validate,
  inventoryController.getInventoryHistoryAdmin
);

module.exports = router;
