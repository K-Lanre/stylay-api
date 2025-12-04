const { body, validationResult, check } = require('express-validator');
const { User } = require('../models');

// Helper to validate phone number format
const isValidPhoneNumber = (phone) => {
  // Nigerian phone number validation in E.164 format
  // Supports all major networks and common number formats
  const phoneRegex = /^\+234[789][01]\d{8}$/; // E.164 format with country code +234
  return phoneRegex.test(phone);
};

/**
 * Middleware function to validate request and format validation errors.
 * Processes express-validator errors and returns formatted error response.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} JSON error response with validation errors if validation fails
 * @returns {boolean} status - Error status
 * @returns {string} message - "Validation failed"
 * @returns {Array} errors - Array of validation error objects with field, message, value, location
 * @returns {Object} meta - Request metadata (path, method, timestamp)
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg
    }));
    
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errorMessages,
      meta: {
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

/**
 * Validation rules for user registration.
 * Validates all required user registration fields including personal information,
 * email uniqueness, password strength, and Nigerian phone number format.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} first_name - Required, 2-50 chars, letters/spaces/hyphens/apostrophes only
 * @property {ValidationChain} last_name - Required, 2-50 chars, letters/spaces/hyphens/apostrophes only
 * @property {ValidationChain} email - Required, valid email, normalized, unique check
 * @property {ValidationChain} password - Required, min 8 chars, must contain uppercase, lowercase, number, special char
 * @property {ValidationChain} phone - Required, Nigerian phone format (+2348012345678), unique check
 * @property {ValidationChain} gender - Optional, must be 'male', 'female', 'other', or 'prefer not to say'
 * @returns {Array} Express validator middleware array for user registration
 * @example
 * // Use in route:
 * router.post('/auth/register', registerValidation, validate, registerUser);
 */
exports.registerValidation = [
  body('first_name')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('last_name')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
    
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail()
    .custom(async (email) => {
      const user = await User.findOne({ where: { email } });
      if (user) {
        throw new Error('This email is already registered');
      }
      return true;
    }),
    
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&]/).withMessage('Password must contain at least one special character (@$!%*?&)'),
    
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidPhoneNumber(value)) {
        throw new Error('Please provide a valid Nigerian phone number (e.g., +2348012345678)');
      }
      return true;
    })
    .custom(async (phone) => {
      const user = await User.findOne({ where: { phone } });
      if (user) {
        throw new Error('This phone number is already in use');
      }
      return true;
    }),
    
  body('gender')
    .optional({ checkFalsy: true })
    .isIn(['male', 'female', 'other', 'prefer not to say'])
    .withMessage('Please select a valid gender')
];


// Validation rules for login
/**
 * Validation rules for user login.
 * Validates email format and ensures password is provided.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} email - Required, valid email format, normalized
 * @property {ValidationChain} password - Required, not empty
 * @returns {Array} Express validator middleware array for user login
 * @example
 * // Use in route:
 * router.post('/auth/login', loginValidation, validate, loginUser);
 */
exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
    
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
];

// Validation rules for email verification
/**
 * Validation rules for email verification.
 * Validates email format and 6-digit verification code.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} email - Required, valid email format, normalized
 * @property {ValidationChain} code - Required, exactly 6 digits, numeric only
 * @returns {Array} Express validator middleware array for email verification
 * @example
 * // Use in route:
 * router.post('/auth/verify-email', verifyEmailValidation, validate, verifyEmail);
 */
exports.verifyEmailValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
    
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers')
];

// Validation rules for resending verification code
/**
 * Validation rules for resending verification code.
 * Validates email format for resending verification emails.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} email - Required, valid email format, normalized
 * @returns {Array} Express validator middleware array for resending verification
 * @example
 * // Use in route:
 * router.post('/auth/resend-verification', resendVerificationValidation, validate, resendVerification);
 */
exports.resendVerificationValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

// Validation rules for forgot password
/**
 * Validation rules for forgot password request.
 * Validates email format for password reset requests.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} email - Required, valid email format, normalized
 * @returns {Array} Express validator middleware array for forgot password
 * @example
 * // Use in route:
 * router.post('/auth/forgot-password', forgotPasswordValidation, validate, forgotPassword);
 */
exports.forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

// Validation rules for resetting password
/**
 * Validation rules for password reset.
 * Validates email, reset code, and new password requirements.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} email - Required, valid email format, normalized
 * @property {ValidationChain} code - Required, exactly 6 digits, numeric only
 * @property {ValidationChain} newPassword - Required, min 8 chars, must contain uppercase, lowercase, number
 * @returns {Array} Express validator middleware array for password reset
 * @example
 * // Use in route:
 * router.post('/auth/reset-password', resetPasswordValidation, validate, resetPassword);
 */
exports.resetPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
];

// Validation rules for updating password
/**
 * Validation rules for updating user password.
 * Validates current password and new password requirements.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} currentPassword - Required, current password for verification
 * @property {ValidationChain} newPassword - Required, min 8 chars, must contain uppercase, lowercase, number
 * @returns {Array} Express validator middleware array for password update
 * @example
 * // Use in route:
 * router.put('/auth/update-password', updatePasswordValidation, validate, updatePassword);
 */
exports.updatePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
    
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
];

// Validation rules for updating user profile
/**
 * Validation rules for updating user profile information.
 * Validates optional profile fields with proper constraints.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} first_name - Optional, 2-100 chars
 * @property {ValidationChain} last_name - Optional, 2-100 chars
 * @property {ValidationChain} email - Optional, valid email, unique check (excluding current user)
 * @property {ValidationChain} phone - Optional, valid phone, unique check (excluding current user)
 * @property {ValidationChain} gender - Optional, must be 'male', 'female', or 'other'
 * @property {ValidationChain} dob - Optional, valid ISO8601 date, user must be at least 13 years old
 * @returns {Array} Express validator middleware array for profile update
 * @example
 * // Use in route:
 * router.put('/auth/update-profile', updateProfileValidation, validate, updateProfile);
 */
exports.updateProfileValidation = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),
    
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),
    
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(async (email, { req }) => {
      if (email) {
        const user = await User.findOne({ where: { email } });
        if (user && user.id !== req.user.id) {
          throw new Error('Email already in use');
        }
      }
      return true;
    }),
    
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
    .custom(async (phone, { req }) => {
      if (phone) {
        const user = await User.findOne({ where: { phone } });
        if (user && user.id !== req.user.id) {
          throw new Error('Phone number already in use');
        }
      }
      return true;
    }),
    
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be either male, female, or other'),
    
  body('dob')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const dob = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      
      if (age < 13) {
        throw new Error('You must be at least 13 years old');
      }
      return true;
    })
];

// Validation rules for requesting phone change
/**
 * Validation rules for requesting phone number change.
 * Validates new phone number format and ensures it's not already in use.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} newPhone - Required, valid Nigerian phone format, unique check
 * @returns {Array} Express validator middleware array for phone change request
 * @example
 * // Use in route:
 * router.post('/auth/request-phone-change', requestPhoneChangeValidation, validate, requestPhoneChange);
 */
exports.requestPhoneChangeValidation = [
  body('newPhone')
    .trim()
    .notEmpty()
    .withMessage('New phone number is required')
    .custom((value) => {
      if (!isValidPhoneNumber(value)) {
        throw new Error('Please provide a valid Nigerian phone number (e.g., +2348012345678)');
      }
      return true;
    })
    .custom(async (phone, { req }) => {
      const user = await User.findOne({ where: { phone } });
      if (user && user.id !== req.user.id) {
        throw new Error('This phone number is already in use');
      }
      return true;
    })
];

// Validation rules for canceling phone change
/**
 * Validation rules for canceling phone change request.
 * No specific validation rules needed for cancellation.
 * @type {Array} Empty array for phone change cancellation
 * @returns {Array} Empty express validator middleware array
 * @example
 * // Use in route:
 * router.post('/auth/cancel-phone-change', cancelPhoneChangeValidation, validate, cancelPhoneChange);
 */
exports.cancelPhoneChangeValidation = [
  // No specific validation needed for cancel request
];

// Middleware to handle validation errors
/**
 * Express middleware to handle validation errors using express-validator.
 * Checks for validation errors and returns formatted error response if any exist.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} JSON error response if validation fails
 * @returns {boolean} status - Error status
 * @returns {string} message - "Validation error"
 * @returns {Array} errors - Array of validation errors from express-validator
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value,
      location: err.location
    }));



    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errorDetails
    });
  }
  next();
};
