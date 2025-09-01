const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { protect, isVendor, isAdmin } = require('../middlewares/auth');

// Protect all routes
router.use(protect);

// Vendor routes
router.get('/product/:productId', isVendor, inventoryController.getProductInventory);
router.patch('/product/:productId', isVendor, inventoryController.updateProductInventory);
router.get('/low-stock', isVendor, inventoryController.getLowStockItems);
router.get('/history/:productId', isVendor, inventoryController.getInventoryHistory);

// Admin routes
router.get('/admin/all', isAdmin, inventoryController.getAllInventory);
router.get('/admin/vendor/:vendorId', isAdmin, inventoryController.getVendorInventory);
router.get('/admin/low-stock', isAdmin, inventoryController.getGlobalLowStockItems);
router.get('/admin/history', isAdmin, inventoryController.getInventoryHistoryAdmin);

module.exports = router;
