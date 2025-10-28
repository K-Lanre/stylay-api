const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/appError');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    return next(new AppError(errorMessages.join(', '), 400));
  }
  next();
};

// Validation rules for creating a sub-admin
const createSubAdminValidation = [
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),

  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('role_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer'),

  body('permission_ids')
    .optional()
    .isArray()
    .withMessage('Permission IDs must be an array'),

  body('permission_ids.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each permission ID must be a positive integer'),

  handleValidationErrors
];

// Validation rules for updating sub-admin permissions
const updateSubAdminPermissionsValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Sub-admin ID must be a positive integer'),

  body('role_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer'),

  body('permission_ids')
    .optional()
    .isArray()
    .withMessage('Permission IDs must be an array'),

  body('permission_ids.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each permission ID must be a positive integer'),

  handleValidationErrors
];

// Validation rules for updating sub-admin profile
const updateSubAdminValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Sub-admin ID must be a positive integer'),

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

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value'),

  handleValidationErrors
];

// Validation rules for getting sub-admins (with pagination and search)
const getSubAdminsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  handleValidationErrors
];

// Validation rules for getting a specific sub-admin
const getSubAdminValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Sub-admin ID must be a positive integer'),

  handleValidationErrors
];

// Validation rules for deleting a sub-admin
const deleteSubAdminValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Sub-admin ID must be a positive integer'),

  handleValidationErrors
];

// Validation rules for getting permission groups
const getPermissionGroupsValidation = [
  query('includeIds')
    .optional()
    .isBoolean()
    .withMessage('includeIds must be a boolean value'),

  handleValidationErrors
];

module.exports = {
  createSubAdminValidation,
  updateSubAdminPermissionsValidation,
  updateSubAdminValidation,
  getSubAdminsValidation,
  getSubAdminValidation,
  deleteSubAdminValidation,
  getPermissionGroupsValidation
};
