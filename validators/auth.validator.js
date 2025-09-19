const { body, validationResult, check } = require('express-validator');
const { User } = require('../models');

// Helper to validate phone number format
const isValidPhoneNumber = (phone) => {
  // Nigerian phone number validation in E.164 format
  // Supports all major networks and common number formats
  const phoneRegex = /^\+234[789][01]\d{8}$/; // E.164 format with country code +234
  return phoneRegex.test(phone);
};

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
    .withMessage('Please select a valid gender'),
    
  // Validate request
  validateRequest,
    
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be either male, female, or other')
];

// Validation rules for login
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
exports.resetPasswordValidation = [
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
    .withMessage('Reset code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Reset code must be 6 digits')
    .isNumeric()
    .withMessage('Reset code must contain only numbers'),
    
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
exports.cancelPhoneChangeValidation = [
  // No specific validation needed for cancel request
];

// Middleware to handle validation errors
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
