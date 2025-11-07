const express = require('express');
const {
  getAdminDashboard,
  getTopSellingVendors,
  getAdminSalesStats,
  getAdminTopCategories,
  getRecentOrders,
  getTopSellingItems,
  getVendorOnboardingStats,
  getVendorOverview,
  getAdminProducts,
} = require('../../controllers/dashboard.controller');

const auth = require('../../middlewares/auth');
const cache = require('../../utils/cache');

const router = express.Router();


// Admin routes (admin authentication required)
router.get('/metrics', auth.protect, auth.restrictTo('admin'), cache(300), getAdminDashboard);
router.get('/recent-orders', auth.protect, auth.restrictTo('admin'), cache(300), getRecentOrders);
router.get('/top-selling-vendors', auth.protect, auth.restrictTo('admin'), cache(300), getTopSellingVendors);
router.get('/top-selling-items', auth.protect, auth.restrictTo('admin'), cache(300), getTopSellingItems);
router.get('/sales-stats', auth.protect, auth.restrictTo('admin'), cache(300), getAdminSalesStats);
router.get('/top-categories', auth.protect, auth.restrictTo('admin'), cache(300), getAdminTopCategories);
router.get('/vendor-onboarding-stats', auth.protect, auth.restrictTo('admin'), cache(300), getVendorOnboardingStats);
router.get('/vendor-overview/:vendorId', auth.protect, auth.restrictTo('admin'), getVendorOverview);
router.get('/products', auth.protect, auth.restrictTo('admin'), cache(300), getAdminProducts);

module.exports = router;
