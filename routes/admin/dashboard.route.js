const express = require('express');
const {
  getAdminDashboard,
  getTopSellingVendors,
  getAdminSalesStats,
  getAdminTopCategories,
  getRecentOrders,
  getTopSellingItems,
} = require('../../controllers/dashboard.controller');

const auth = require('../../middlewares/auth');

const router = express.Router();


// Admin routes (admin authentication required)
router.get('/metrics', auth.protect, auth.restrictTo('admin'), getAdminDashboard);
router.get('/recent-orders', auth.protect, auth.restrictTo('admin'), getRecentOrders);
router.get('/top-selling-vendors', auth.protect, auth.restrictTo('admin'), getTopSellingVendors);
router.get('/top-selling-items', auth.protect, auth.restrictTo('admin'), getTopSellingItems);
router.get('/sales-stats', auth.protect, auth.restrictTo('admin'), getAdminSalesStats);
router.get('/top-categories', auth.protect, auth.restrictTo('admin'), getAdminTopCategories);

module.exports = router;
