const { body } = require("express-validator");
const { validationResult } = require("express-validator");
const { Store } = require("../models");
const { Op } = require('sequelize');

/**
 * Validation rules for vendor registration.
 * Comprehensive validation for business information, contact details, and CAC registration.
 */
const registerVendorValidation = [
  // User fields
  body("first_name")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("First name must be between 2 and 100 characters"),

  body("last_name")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Last name must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+234(70|80|81|90|91)[0-9]{8}$/)
    .withMessage("Phone number must be in the format +234[70|80|81|90|91]XXXXXXX (e.g., +2348012345678)"),

  // Store fields
  body("business_name")
    .trim()
    .notEmpty()
    .withMessage("Business name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters")
    .custom(async (value, { req }) => {
      const existingStore = await Store.findOne({
        where: { business_name: value },
      });
      if (existingStore && existingStore.id !== req.params.id) {
        throw new Error("Business name already in use");
      }
      return true;
    }),

  body("cac_number")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(RC|BN)\/\d{7}$/)
    .withMessage("Invalid CAC number format. Expected format: RC/1234567 or BN/1234567"),

  body("instagram_handle")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-z0-9_]{5,20}$/)
    .withMessage("Instagram handle must be between 5 and 20 characters"),

  body("facebook_handle")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-z0-9_]{5,20}$/)
    .withMessage("Facebook handle must be between 5 and 20 characters"),

  body("twitter_handle")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-z0-9_]{5,20}$/)
    .withMessage("Twitter handle must be between 5 and 20 characters"),

  // Vendor fields
  body("join_reason")
    .trim()
    .notEmpty()
    .withMessage("Please tell us why you want to join as a vendor")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Join reason must be between 10 and 1000 characters"),
  
  // ===== ENHANCED BUSINESS IMAGES VALIDATION =====
  body("business_images")
    .optional()
    .custom((value, { req }) => {
      // File validation is handled by the middleware and controller
      // This custom validator provides additional request-level checks
      
      if (req.uploadedFiles && req.uploadedFiles.length > 0) {
        const businessImages = req.uploadedFiles.filter(
          file => file.fieldname === 'businessImages'
        );
        
        // Validate count
        if (businessImages.length > 5) {
          throw new Error('Maximum 5 business images allowed');
        }
        
        // Validate file types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        const invalidFiles = businessImages.filter(
          file => !allowedTypes.includes(file.mimetype)
        );
        
        if (invalidFiles.length > 0) {
          throw new Error(
            `Invalid file types detected. Only JPEG, PNG, JPG, and WebP images are allowed. ` +
            `Found: ${invalidFiles.map(f => f.mimetype).join(', ')}`
          );
        }
        
        // Validate file sizes (5MB max per file)
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        const oversizedFiles = businessImages.filter(
          file => file.size > maxFileSize
        );
        
        if (oversizedFiles.length > 0) {
          throw new Error(
            `File size exceeds maximum limit of 5MB per file. ` +
            `Oversized files: ${oversizedFiles.map(f => f.name).join(', ')}`
          );
        }
        
        // Additional validation: Check for duplicate filenames
        const filenames = businessImages.map(f => f.name);
        const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
        
        if (duplicates.length > 0) {
          throw new Error(
            `Duplicate filenames detected: ${[...new Set(duplicates)].join(', ')}. ` +
            `Please rename files to have unique names.`
          );
        }
      }
      
      return true;
    })
    .withMessage("Business images validation failed"),
  // ===== END ENHANCED BUSINESS IMAGES VALIDATION =====
];


/**
 * Validation rules for completing vendor onboarding process.
 * Validates banking information, business description, and file uploads.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} bank_account_name - Required, 2-100 chars, trimmed
 * @property {ValidationChain} bank_account_number - Required, numeric only
 * @property {ValidationChain} bank_name - Required, 2-100 chars, trimmed
 * @property {ValidationChain} description - Optional, max 1000 chars
 * @property {ValidationChain} logo - Optional, string validation for file path
 * @property {ValidationChain} business_images - Optional, handled by file upload middleware
 * @returns {Array} Express validator middleware array for vendor onboarding completion
 * @example
 * // Use in route:
 * router.post('/vendors/complete-onboarding', completeOnboardingValidation, validate, completeOnboarding);
 */
const completeOnboardingValidation = [
  body("bank_account_name")
    .trim()
    .notEmpty()
    .withMessage("Bank account name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Bank account name must be between 2 and 100 characters"),

  body("bank_account_number")
    .trim()
    .notEmpty()
    .withMessage("Bank account number is required")
    .isNumeric()
    .withMessage("Bank account number must contain only numbers"),

  body("bank_name")
    .trim()
    .notEmpty()
    .withMessage("Bank name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Bank name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("logo")
    .optional()
    .isString()
    .withMessage("Invalid logo format"),

  // Business images validation is handled in the route middleware
  body("business_images").optional(),
];

// Validation middleware
/**
 * Express middleware to handle validation errors using express-validator.
 * Formats validation errors with detailed error information for vendor operations.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} JSON error response if validation fails
 * @returns {boolean} status - Always false for validation errors
 * @returns {string} message - "Validation error"
 * @returns {Array} errors - Array of validation errors from express-validator
 * @example
 * // Use as middleware in routes:
 * router.post('/vendors/register', registerVendorValidation, validate, registerVendor);
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "error",
      message: "Validation error",
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  registerVendorValidation,
  completeOnboardingValidation,
  validate,
};
