const express = require('express');
const {
  getNewArrivals,
  getTrendingNow,
  getLatestJournal,
  getVendorDashboard,
  getVendorProducts,
  getVendorEarnings,
  getVendorEarningsBreakdown,
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

// Admin routes have been moved to /api/admin/dashboard

module.exports = router;
