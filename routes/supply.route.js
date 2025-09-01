const express = require('express');
const router = express.Router();
const supplyController = require('../controllers/supply.controller');
const { 
  createSupplyValidation, 
  createBulkSupplyValidation 
} = require('../validators/supply.validator');
const { protect, isVendor, isAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validation');

// Protected routes (require authentication)
router.use(protect);

// Vendor routes
router.post(
  '/', 
  isVendor, 
  createSupplyValidation, 
  validate, 
  supplyController.createSupply
);

router.post(
  '/bulk', 
  isVendor, 
  createBulkSupplyValidation, 
  validate, 
  supplyController.createBulkSupply
);

router.get(
  '/vendor', 
  isVendor, 
  supplyController.getVendorSupplies
);

// Admin routes
router.get(
  '/admin/all',
  isAdmin,
  supplyController.getAllSupplies
);

router.get(
  '/admin/vendor/:vendorId',
  isAdmin,
  supplyController.getSuppliesByVendor
);

router.get(
  '/admin/product/:productId',
  isAdmin,
  supplyController.getProductSupplyHistory
);

router.get(
  '/admin/summary',
  isAdmin,
  supplyController.getSupplySummary
);

module.exports = router;
