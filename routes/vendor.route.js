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
  registerVendorValidation,
  validate,
  vendorController.registerVendor
);

router.get("/", vendorController.getAllVendors);
router.get("/:id", vendorController.getVendor);

// Protected routes (require authentication)
router.use(protect);

// Vendor profile route (accessible by vendor or admin)
router.get(
  "/profile",
  (req, res, next) => {
    if (isAdmin) {
      return next('route'); // Skip to the next route if admin
    }
    next();
  },
  restrictTo('vendor'),
  vendorController.getVendorProfile
);

// Admin access to vendor profile by ID
router.get(
  "/:id/profile",
  restrictTo('admin'),
  vendorController.getVendorProfile
);

// Dynamic parameter routes (must come after specific routes)
router.get(
  "/:id/products",
  getVendorProductsValidation,
  validate,
  vendorController.getVendorProducts
);


// Complete vendor onboarding (vendor only)
router.patch(
  "/complete-onboarding",
  restrictTo("vendor"),
  setVendorId,
  handleOnboardingUploads,
  processOnboardingFiles,
  completeOnboardingValidation,
  validate,
  vendorController.completeOnboarding
);

// Follower routes (authenticated users)
router.post("/:vendorId/follow", vendorController.followVendor);
router.delete("/:vendorId/follow", vendorController.unfollowVendor);
router.get("/:vendorId/followers", vendorController.getVendorFollowers);
router.get("/:vendorId/follow-status", vendorController.checkFollowStatus);

// User following routes
router.get("/user/:userId/following", vendorController.getUserFollowing);
router.get("/user/following", vendorController.getUserFollowing);

// Vendor-specific follower routes (vendor only)
router.get("/profile/followers", restrictTo("vendor"), vendorController.getMyFollowers);

// Admin routes

// Approve vendor
router.patch(
  "/:id/approve",
  restrictTo("admin"),
  vendorController.approveVendor
);

// Reject vendor
router.patch("/:id/reject", restrictTo("admin"), vendorController.rejectVendor);

module.exports = router;
