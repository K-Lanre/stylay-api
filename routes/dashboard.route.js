const express = require("express");
const {
  getNewArrivals,
  getTrendingNow,
  getLatestJournal,
  getVendorDashboard,
  getVendorProducts,
  getVendorEarnings,
  getVendorEarningsBreakdown,
  getProductOverview,
} = require("../controllers/dashboard.controller");

const { cache } = require("../utils/cache");
const { protect, isVendor } = require("../middlewares/auth");

const router = express.Router();

// Public routes (no authentication required) with caching
router.get(
  "/new-arrivals",
  cache({
    ttl: 900,
    type: "public",
    invalidateOn: ["product:created", "supply:created", "product:updated"],
  }),
  getNewArrivals
);

// Trending products with longer cache due to calculation complexity
router.get(
  "/trending-now",
  cache({
    ttl: 1800,
    type: "public",
    invalidateOn: ["product:updated", "order:created", "impression:updated"],
  }),
  getTrendingNow
);

// Latest journal with medium cache
router.get(
  "/latest-journal",
  cache({
    ttl: 900,
    type: "public",
    invalidateOn: ["journal:created", "journal:updated"],
  }),
  getLatestJournal
);

// Product overview with specific product ID in key for targeted caching
router.get(
  "/products/:id",
  cache({
    ttl: 600,
    type: "public",
    keyGenerator: (req) => `public:product:${req.params.id}`,
    invalidateOn: [
      "product:updated",
      "product:deleted",
      "inventory:updated",
      "review:created",
    ],
  }),
  getProductOverview
);

// Vendor dashboard routes (protected and vendor-only)
const vendorRouter = express.Router({ mergeParams: true });

// Apply vendor middleware to all vendor routes
vendorRouter.use(protect, isVendor);

// Vendor dashboard metrics
vendorRouter.get(
  "/metrics",
  cache({
    ttl: 300,
    type: "vendor",
    keyGenerator: (req) => `vendor:metrics:${req.user.id}`,
    invalidateOn: ["order:created", "order:updated", "vendor:profile_updated"],
  }),
  getVendorDashboard
);

// Vendor products
vendorRouter.get(
  "/products",
  cache({
    ttl: 600,
    type: "vendor",
    keyGenerator: (req) => `vendor:products:${req.user.id}`,
    invalidateOn: [
      "product:created",
      "product:updated",
      "product:deleted",
      "vendor:product_updated",
    ],
  }),
  getVendorProducts
);

// Vendor earnings
vendorRouter.get(
  "/earnings",
  cache({
    ttl: 300,
    type: "vendor",
    keyGenerator: (req) => `vendor:earnings:${req.user.id}`,
    invalidateOn: [
      "order:created",
      "order:updated",
      "payout:created",
      "vendor:earnings_updated",
    ],
  }),
  getVendorEarnings
);

// Vendor earnings breakdown
vendorRouter.get(
  "/earnings/breakdown",
  cache({
    ttl: 180,
    type: "vendor",
    keyGenerator: (req) => `vendor:earnings:breakdown:${req.user.id}`,
    invalidateOn: [
      "order:created",
      "order:updated",
      "payout:created",
      "vendor:earnings_updated",
    ],
  }),
  getVendorEarningsBreakdown
);

// Mount vendor routes under /vendor
router.use("/vendor", vendorRouter);

// Admin routes are in the admin route file

module.exports = router;
