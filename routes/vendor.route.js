const express = require("express");
const router = express.Router();
const fs = require("fs");
const vendorController = require("../controllers/vendor.controller");
const productController = require("../controllers/product.controller");
const {
  registerVendorValidation,
  completeOnboardingValidation,
  validate,
} = require("../validators/vendor.validator");
const { protect, restrictTo } = require("../middlewares/auth");
const uploadFiles = require("../middlewares/fileUpload");
const {
  getVendorProductsValidation,
} = require("../validators/product.validator");

// Helper function to check if user is admin
const isAdmin = (user) => {
  return (
    user.roles && user.roles.some((role) => role.name.toLowerCase() === "admin")
  );
};

// Public routes
router.post(
  "/register",
  registerVendorValidation,
  validate,
  vendorController.registerVendor
);

// Public routes
router.get("/", vendorController.getAllVendors);

// Protected routes (require authentication)
router.use(protect);

// Vendor profile route (accessible by vendor or admin)
router.get(
  "/profile",
  (req, res, next) => {
    if (isAdmin(req.user)) {
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
  productController.getVendorProducts
);

// General vendor access by ID
router.get("/:id", vendorController.getVendor);

// Complete vendor onboarding (vendor only)
router.patch(
  "/complete-onboarding",
  restrictTo("vendor"),
  // Set vendor ID and handle file uploads
  (req, res, next) => {
    req.vendorId = String(req.user.id);
    next();
  },
  // Handle file uploads for both logo and business images in parallel
  (req, res, next) => {
    const logoMiddleware = uploadFiles("logo", 1);
    const businessImagesMiddleware = uploadFiles("business_images", 10);

    // Run both middlewares in sequence
    logoMiddleware(req, res, (err) => {
      if (err) return next(err);
      businessImagesMiddleware(req, res, next);
    });
  },
  // Process files before validation
  async (req, res, next) => {
    try {
      // Process uploaded files from req.uploadedFiles
      const uploadedFiles = req.uploadedFiles || [];
      const processedData = {};

      // Separate logo from business images
      const logoFile = uploadedFiles.find((f) => f.fieldname === "logo");
      const businessImageFiles = uploadedFiles.filter(
        (f) => f.fieldname === "business_images"
      );

      // Handle logo (optional) - use the URL from the uploaded file
      processedData.logo = logoFile ? logoFile.url : null;

      // Business images are required
      if (businessImageFiles.length === 0) {
        // Clean up any uploaded files if validation fails
        if (logoFile && logoFile.path) {
          try {
            await fs.promises.unlink(logoFile.path);
          } catch (e) {
            console.error("Error cleaning up logo file:", e);
          }
        }

        return res.status(400).json({
          status: "error",
          message: "Validation error",
          errors: [
            {
              field: "business_images",
              message: "At least one business image is required",
            },
          ],
        });
      }

      // Process business images
      processedData.business_images = businessImageFiles.map((file) => ({
        url: file.url,
        alt: file.name,
        size: file.size,
        mimeType: file.mimetype,
      }));

      // Attach processed data to request object
      req.processedFiles = processedData;
      next();
    } catch (error) {
      console.error("Error processing files:", error);

      // Clean up any uploaded files on error
      if (req.uploadedFiles && req.uploadedFiles.length > 0) {
        await Promise.all(
          req.uploadedFiles.map(async (file) => {
            try {
              if (file.path) {
                await fs.promises.unlink(file.path);
              }
            } catch (e) {
              console.error("Error cleaning up file:", e);
            }
          })
        );
      }

      res.status(500).json({
        status: "error",
        message: "Error processing uploaded files",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
  // Add validation middleware
  completeOnboardingValidation,
  validate,
  // Controller
  vendorController.completeOnboarding
);

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
