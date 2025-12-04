const fs = require("fs");
const uploadFiles = require("./fileUpload");
const AppError = require("../utils/appError");

/**
 * Middleware to set vendor ID from authenticated user
 */
const setVendorId = (req, res, next) => {
  req.vendorId = String(req.user.id);
  next();
};

/**
 * Middleware to handle file uploads for vendor onboarding
 * Handles both logo and business_images uploads in parallel
 */
const handleOnboardingUploads = (req, res, next) => {
  const logoMiddleware = uploadFiles("logo", 1, "vendor-assets");
  const businessImagesMiddleware = uploadFiles(
    "business_images",
    10,
    "vendor-assets"
  );

  // Run both middlewares in sequence
  logoMiddleware(req, res, (err) => {
    if (err) return next(err);
    businessImagesMiddleware(req, res, next);
  });
};

/**
 * Middleware to process and validate uploaded files for vendor onboarding
 */
const processOnboardingFiles = async (req, res, next) => {
  try {
    const uploadedFiles = req.uploadedFiles || [];
    const processedData = {};

    // Separate logo from business images
    const logoFile = uploadedFiles.find((f) => f.fieldname === "logo");
    const businessImageFiles = uploadedFiles.filter(
      (f) => f.fieldname === "business_images"
    );

    // Handle logo (optional) - use the URL from the uploaded file
    processedData.logo = logoFile ? logoFile.url : null;
    
    // Store the actual file object for cleanup (not just URL)
    processedData.logoFile = logoFile;

    // Business images are required
    if (businessImageFiles.length === 0) {
      // Clean up any uploaded files if validation fails
      await cleanupUploadedFiles(uploadedFiles);
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
    processedData.business_images = businessImageFiles.map(({ url }) => url);
    
    // Store the actual file objects for cleanup (not just URLs)
    processedData.businessImageFiles = businessImageFiles;

    // Attach processed data to request object
    req.processedFiles = processedData;
    next();
  } catch (error) {
    console.error("Error processing files:", error);

    // Clean up any uploaded files on error
    await cleanupUploadedFiles(req.uploadedFiles || []);

    res.status(500).json({
      status: "error",
      message: "Error processing uploaded files",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Helper function to clean up uploaded files
 */
const cleanupUploadedFiles = async (files) => {
  if (!files || files.length === 0) return;

  await Promise.all(
    files.map(async (file) => {
      try {
        if (file.path && fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
        }
      } catch (e) {
        console.error("Error cleaning up file:", e);
      }
    })
  );
};

module.exports = {
  setVendorId,
  handleOnboardingUploads,
  processOnboardingFiles,
};
