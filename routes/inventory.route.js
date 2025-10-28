const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { protect, isVendor } = require('../middlewares/auth');

// Protect all routes
router.use(protect);

// Vendor routes
router.get('/product/:productId', isVendor, inventoryController.getProductInventory);
router.patch('/product/:productId', isVendor, inventoryController.updateProductInventory);
router.get('/low-stock', isVendor, inventoryController.getLowStockItems);
router.get('/history/:productId', isVendor, inventoryController.getInventoryHistory);



module.exports = router;
