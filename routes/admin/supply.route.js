const express = require('express');
const router = express.Router();
const supplyController = require('../../controllers/supply.controller');
const { protect, isAdmin } = require('../../middlewares/auth');

// All routes require admin authentication
router.use(protect);
router.use(isAdmin);

// Admin routes for supplies
router.get('/all', supplyController.getAllSupplies);
router.get('/vendor/:vendorId', supplyController.getSuppliesByVendor);
router.get('/product/:productId', supplyController.getProductSupplyHistory);
router.get('/summary', supplyController.getSupplySummary);

module.exports = router;
