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

const { cache, invalidate } = require('../utils/cache');
const auth = require('../middlewares/auth');

const router = express.Router();

// Public routes (no authentication required) with caching

// New arrivals with public caching and product invalidation
router.get('/new-arrivals', cache({
  ttl: 900,
  type: 'public',
  invalidateOn: ['product:created', 'supply:created', 'product:updated']
}), getNewArrivals);

// Trending products with longer cache due to calculation complexity
router.get('/trending-now', cache({
  ttl: 1800,
  type: 'public',
  invalidateOn: ['product:updated', 'order:created', 'impression:updated']
}), getTrendingNow);

// Latest journal with medium cache
router.get('/latest-journal', cache({
  ttl: 900,
  type: 'public',
  invalidateOn: ['journal:created', 'journal:updated']
}), getLatestJournal);

// Product overview with specific product ID in key for targeted caching
router.get('/product/:id', cache({
  ttl: 600,
  type: 'public',
  keyGenerator: (req) => `public:product:${req.params.id}`,
  invalidateOn: ['product:updated', 'product:deleted', 'inventory:updated', 'review:created']
}), getProductOverview);

// Vendor routes (vendor authentication required) with vendor-specific caching
router.get('/vendor/metrics',
  auth.protect,
  auth.restrictTo('vendor'),
  cache({
    ttl: 300,
    type: 'vendor',
    keyGenerator: (req) => `vendor:metrics:${req.user.id}`,
    invalidateOn: ['order:created', 'order:updated', 'vendor:profile_updated']
  },
  getVendorDashboard));

router.get('/vendor/products',
  auth.protect,
  auth.restrictTo('vendor'),
  cache({
    ttl: 600,
    type: 'vendor',
    keyGenerator: (req) => `vendor:products:${req.user.id}`,
    invalidateOn: ['product:created', 'product:updated', 'product:deleted', 'vendor:product_updated']
  },
  getVendorProducts));

router.get('/vendor/earnings',
  auth.protect,
  auth.restrictTo('vendor'),
  cache({
    ttl: 300,
    type: 'vendor',
    keyGenerator: (req) => `vendor:earnings:${req.user.id}`,
    invalidateOn: ['order:created', 'order:updated', 'payout:created', 'vendor:earnings_updated']
  },
  getVendorEarnings));

router.get('/vendor/earnings-breakdown',
  auth.protect,
  auth.restrictTo('vendor'),
  cache({
    ttl: 180,
    type: 'vendor',
    keyGenerator: (req) => `vendor:earnings:breakdown:${req.user.id}`,
    invalidateOn: ['order:created', 'order:updated', 'payout:created', 'vendor:earnings_updated']
  },
  getVendorEarningsBreakdown));

// Admin routes have been moved to /api/admin/dashboard

module.exports = router;
