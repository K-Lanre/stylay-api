const express = require('express');
const {
  getNewArrivals,
  getTrendingNow,
  getLatestJournal,
  getVendorDashboard,
  getVendorProducts,
  getVendorEarnings,
  getVendorEarningsBreakdown,
  getAdminDashboard,
  getTopSellingVendors,
  getAdminSalesStats,
  getAdminTopCategories,
  getRecentOrders,
  getTopSellingItems,
  getProductOverview
} = require('../controllers/dashboard.controller');

const auth = require('../middlewares/auth');

const router = express.Router();

// Public routes (no authentication required)
router.get('/new-arrivals', getNewArrivals);
router.get('/trending-now', getTrendingNow);
router.get('/latest-journal', getLatestJournal);
router.get('/product/:id',getProductOverview);

// Vendor routes (vendor authentication required)
router.get('/vendor/metrics', auth.protect, auth.restrictTo('vendor'), getVendorDashboard);
router.get('/vendor/products', auth.protect, auth.restrictTo('vendor'), getVendorProducts);
router.get('/vendor/earnings', auth.protect, auth.restrictTo('vendor'), getVendorEarnings);
router.get('/vendor/earnings-breakdown', auth.protect, auth.restrictTo('vendor'), getVendorEarningsBreakdown);

// Admin routes (admin authentication required)
router.get('/admin/metrics', auth.protect, auth.restrictTo('admin'), getAdminDashboard);
router.get('/admin/recent-orders', auth.protect, auth.restrictTo('admin'), getRecentOrders);
router.get('/admin/top-selling-vendors', auth.protect, auth.restrictTo('admin'), getTopSellingVendors);
router.get('/admin/top-selling-items', auth.protect, auth.restrictTo('admin'), getTopSellingItems);
router.get('/admin/sales-stats', auth.protect, auth.restrictTo('admin'), getAdminSalesStats);
router.get('/admin/top-categories', auth.protect, auth.restrictTo('admin'), getAdminTopCategories);

module.exports = router;
