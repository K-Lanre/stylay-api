const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendor.controller");
const productController = require("../controllers/product.controller");
const {
  registerVendorValidation,
  completeOnboardingValidation,
  validate,
} = require("../validators/vendor.validator");
const { protect, restrictTo, isAdmin } = require("../middlewares/auth");
const { hasPermission } = require("../middlewares/permission");
const {
  setVendorId,
  handleOnboardingUploads,
  processOnboardingFiles,
} = require("../middlewares/vendorOnboarding");
const {
  getVendorProductsValidation,
} = require("../validators/product.validator");

// Public routes
router.post(
  "/register",
  hasPermission('create_vendors'),
  registerVendorValidation,
  validate,
  vendorController.registerVendor
);

router.get("/", hasPermission('read_vendors'), vendorController.getAllVendors);
// Dynamic parameter routes (must come after specific routes)
router.get(
  "/:id/products",
  hasPermission('view_products_by_vendor'),
  getVendorProductsValidation,
  validate,
  vendorController.getVendorProducts
);
router.get("/:id", hasPermission('read_vendors'), vendorController.getVendor);

// Protected routes (require authentication)
router.use(protect);

// Vendor profile route (accessible by vendor or admin)
router.get(
  "/vendor/profile",
  hasPermission('view_vendor_analytics_vendor'),
  restrictTo('vendor'),
  vendorController.getVendorProfile
);

// Admin access to vendor profile by ID
router.get(
  "/:id/profile",
  hasPermission('view_single_vendor_admin'),
  restrictTo('admin'),
  vendorController.getVendorProfile
);



// Complete vendor onboarding (vendor only)
router.patch(
  "/complete-onboarding",
  hasPermission('manage_vendor_onboarding'),
  restrictTo("vendor"),
  setVendorId,
  handleOnboardingUploads,
  processOnboardingFiles,
  completeOnboardingValidation,
  validate,
  vendorController.completeOnboarding
);

// Follower routes (authenticated users)
router.post("/:vendorId/follow", hasPermission('manage_vendor_followers'), vendorController.followVendor);
router.delete("/:vendorId/follow", hasPermission('manage_vendor_followers'), vendorController.unfollowVendor);
router.get("/:vendorId/followers", hasPermission('view_vendor_followers'), vendorController.getVendorFollowers);
router.get("/:vendorId/follow-status", hasPermission('view_vendor_followers'), vendorController.checkFollowStatus);

// User following routes
router.get("/user/:userId/following", hasPermission('view_vendor_followers'), vendorController.getUserFollowing);
router.get("/user/following", hasPermission('view_vendor_followers'), vendorController.getUserFollowing);

// Vendor-specific follower routes (vendor only)
router.get("/profile/followers", hasPermission('view_vendor_followers'), restrictTo("vendor"), vendorController.getMyFollowers);

// Admin routes

// Approve vendor
router.patch(
  "/:id/approve",
  hasPermission('approve_vendor_application_admin'),
  restrictTo("admin"),
  vendorController.approveVendor
);

// Reject vendor
router.patch(
  "/:id/reject",
  hasPermission('reject_vendor_application_admin'),
  restrictTo("admin"),
  vendorController.rejectVendor
);

module.exports = router;
