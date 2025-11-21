const express = require('express');
const router = express.Router();
const { param, body, query } = require('express-validator'); // Import for validation
const inventoryController = require('../controllers/inventory.controller');
const { protect, isVendor, isAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validation'); // Import custom validation middleware

// Protect all routes
router.use(protect);

// Vendor routes
router.get(
  '/product/:productId',
  isVendor,
  [param('productId').isInt({ min: 1 }).withMessage('Invalid product ID')],
  validate,
  inventoryController.getProductInventory
);

router.patch(
  '/product/:productId',
  isVendor,
  [
    param('productId').isInt({ min: 1 }).withMessage('Invalid product ID'),
    body('combinationId').isInt({ min: 1 }).withMessage('Combination ID is required and must be an integer'),
    body('adjustment').isInt().withMessage('Adjustment must be an integer'),
    body('note').optional().isString().withMessage('Note must be a string'),
  ],
  validate,
  inventoryController.updateProductInventory
);

router.get(
  '/low-stock',
  isVendor,
  [query('threshold').optional().isInt({ min: 0 }).withMessage('Threshold must be a non-negative integer')],
  validate,
  inventoryController.getLowStockItems
);

router.get(
  '/history/:productId',
  isVendor,
  [param('productId').isInt({ min: 1 }).withMessage('Invalid product ID')],
  validate,
  inventoryController.getProductInventoryHistory
);

module.exports = router;
