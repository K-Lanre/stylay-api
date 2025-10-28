const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventory.controller');
const auth = require('../../middlewares/auth');


// Admin routes (admin authentication required)
router.get('/all', auth.protect, auth.restrictTo('admin'), inventoryController.getAllInventory);
router.get('/vendor/:vendorId', auth.protect, auth.restrictTo('admin'), inventoryController.getVendorInventory);
router.get('/low-stock', auth.protect, auth.restrictTo('admin'), inventoryController.getGlobalLowStockItems);
router.get('/history', auth.protect, auth.restrictTo('admin'), inventoryController.getInventoryHistoryAdmin);

module.exports = router;
