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

const { cache, invalidate } = require('../../utils/cache');

const router = express.Router();

// Admin routes - protected by global checkPermission middleware
// The checkPermission middleware handles both authentication and permission checks

// Core dashboard metrics with admin-specific caching
router.get('/metrics', cache({ ttl: 300, type: 'admin', invalidateOn: ['order:created', 'order:updated'] }), getAdminDashboard);

// Recent orders with shorter cache due to high update frequency
router.get('/recent-orders', cache({ ttl: 180, type: 'admin', invalidateOn: ['order:created', 'order:status_changed'] }), getRecentOrders);

// Top selling vendors with medium cache duration
router.get('/top-selling-vendors', cache({ ttl: 600, type: 'admin', invalidateOn: ['order:created', 'vendor:approved', 'vendor:status_changed'] }), getTopSellingVendors);

// Top selling items with medium cache duration
router.get('/top-selling-items', cache({ ttl: 600, type: 'admin', invalidateOn: ['order:created', 'product:created', 'product:updated'] }), getTopSellingItems);

// Sales statistics with longer cache due to calculation complexity
router.get('/sales-stats', cache({ ttl: 900, type: 'admin', invalidateOn: ['order:created', 'order:updated'] }), getAdminSalesStats);

// Top categories with medium cache duration
router.get('/top-categories', cache({ ttl: 600, type: 'admin', invalidateOn: ['order:created', 'category:updated'] }), getAdminTopCategories);

// Vendor onboarding statistics with longer cache
router.get('/vendor-onboarding-stats', cache({ ttl: 900, type: 'admin', invalidateOn: ['vendor:created', 'vendor:approved', 'vendor:rejected'] }), getVendorOnboardingStats);

// Vendor overview with specific vendor ID in key for targeted caching
router.get('/vendor-overview/:vendorId', cache({
  ttl: 600,
  type: 'admin',
  keyGenerator: (req) => `admin:vendor-overview:${req.params.vendorId}`,
  invalidateOn: ['vendor:updated', 'vendor:status_changed']
}), getVendorOverview);

// Admin products with products-specific caching
router.get('/products', cache({ ttl: 300, type: 'admin', invalidateOn: ['product:created', 'product:updated', 'product:deleted'] }), getAdminProducts);

module.exports = router;
