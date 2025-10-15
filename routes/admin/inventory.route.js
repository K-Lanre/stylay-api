const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventory.controller');
const auth = require('../../middlewares/auth');


// Admin routes
router.get('/all', auth.isAdmin, inventoryController.getAllInventory);
router.get('/vendor/:vendorId', auth.isAdmin, inventoryController.getVendorInventory);
router.get('/low-stock', auth.isAdmin, inventoryController.getGlobalLowStockItems);
router.get('/history', auth.isAdmin, inventoryController.getInventoryHistoryAdmin);

module.exports = router;
