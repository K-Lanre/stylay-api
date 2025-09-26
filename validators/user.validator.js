const { body, param, validationResult } = require('express-validator');
const { User, Role } = require('../models');
const AppError = require('../utils/appError');

// Common validation rules for user data
const userValidationRules = [
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(async (value, { req }) => {
      // Skip if we're updating and email hasn't changed
      if (req.params.id) {
        const user = await User.findByPk(req.params.id);
        if (user && user.email === value) {
          return true;
        }
      }
      
      // Check if email is already in use
      const existingUser = await User.findOne({ where: { email: value } });
      if (existingUser) {
        throw new Error('Email already in use');
      }
      return true;
    }),

  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\+234(70|80|81|90|91)[0-9]{8}$/)
    .withMessage('Phone number must be in the format +234[70|80|81|90|91]XXXXXXX (e.g., +2348012345678)'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer not to say'])
    .withMessage('Invalid gender value'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value'),
];

// Validation for creating a user (admin only)
/**
 * Validation rules for creating a new user account (admin only).
 * Comprehensive validation including personal info, email uniqueness, password strength, phone format, and role assignments.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} first_name - Required, 2-50 chars, letters/spaces/hyphens/apostrophes
 * @property {ValidationChain} last_name - Required, 2-50 chars, letters/spaces/hyphens/apostrophes
 * @property {ValidationChain} email - Required, valid email, normalized, unique check
 * @property {ValidationChain} password - Required, min 8 chars, uppercase/lowercase/number/special char
 * @property {ValidationChain} phone - Optional, Nigerian format validation, unique check
 * @property {ValidationChain} gender - Optional, male/female/other/prefer not to say
 * @property {ValidationChain} is_active - Optional, boolean value
 * @property {ValidationChain} role_ids - Optional array of role IDs, validates role existence
 * @returns {Array} Express validator middleware array for user creation
 * @example
 * // Use in route:
 * router.post('/users', createUserValidation, validate, createUser);
 */
const createUserValidation = [
  ...userValidationRules,
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^a-zA-Z0-9]/)
    .withMessage('Password must contain at least one special character'),

  body('role_ids')
    .optional()
    .isArray()
    .withMessage('role_ids must be an array')
    .custom(async (value) => {
      if (value && value.length > 0) {
        const roles = await Role.findAll({
          where: { id: value },
          attributes: ['id']
        });
        
        if (roles.length !== value.length) {
          throw new Error('One or more role IDs are invalid');
        }
      }
      return true;
    })
];

// Validation for updating a user
/**
 * Validation rules for updating an existing user account.
 * Validates user ID parameter and optional field updates with uniqueness checks.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required user ID parameter, validates user exists
 * @property {ValidationChain} first_name - Optional, 2-100 chars
 * @property {ValidationChain} last_name - Optional, 2-100 chars
 * @property {ValidationChain} email - Optional, valid email, unique check (excluding current user)
 * @property {ValidationChain} phone - Optional, valid phone, unique check (excluding current user)
 * @property {ValidationChain} gender - Optional, male/female/other
 * @property {ValidationChain} dob - Optional, valid ISO8601 date, user must be >= 13 years old
 * @property {ValidationChain} role_ids - Optional array of role IDs, validates role existence
 * @returns {Array} Express validator middleware array for user updates
 * @example
 * // Use in route:
 * router.put('/users/:id', updateUserValidation, validate, updateUser);
 */
const updateUserValidation = [
  param('id')
    .isInt()
    .withMessage('User ID must be an integer')
    .custom(async (value) => {
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  
  ...userValidationRules.filter(rule => {
    // Skip password validation for updates
    if (!rule || !rule.fields || !Array.isArray(rule.fields)) return true;
    return rule.fields[0] !== 'password';
  }),
  
  body('role_ids')
    .optional()
    .isArray()
    .withMessage('role_ids must be an array')
    .custom(async (value) => {
      if (value && value.length > 0) {
        const roles = await Role.findAll({
          where: { id: value },
          attributes: ['id']
        });
        
        if (roles.length !== value.length) {
          throw new Error('One or more role IDs are invalid');
        }
      }
      return true;
    })
];

// Validation for assigning roles to a user
/**
 * Validation rules for assigning roles to a user account.
 * Validates user existence and role validity before assignment.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required user ID parameter, validates user exists
 * @property {ValidationChain} role_ids - Required array of role IDs (minimum 1), validates role existence
 * @returns {Array} Express validator middleware array for role assignment
 * @example
 * // Use in route:
 * router.post('/users/:id/roles', assignRolesValidation, validate, assignRoles);
 */
const assignRolesValidation = [
  param('id')
    .isInt()
    .withMessage('User ID must be an integer')
    .custom(async (value) => {
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  
  body('role_ids')
    .isArray({ min: 1 })
    .withMessage('At least one role ID is required')
    .custom(async (value) => {
      const roles = await Role.findAll({
        where: { id: value },
        attributes: ['id']
      });
      
      if (roles.length !== value.length) {
        throw new Error('One or more role IDs are invalid');
      }
      return true;
    })
];

// Validation for removing roles from a user
/**
 * Validation rules for removing roles from a user account.
 * Validates role validity before removal (user existence checked implicitly).
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} role_ids - Required array of role IDs (minimum 1), validates role existence
 * @returns {Array} Express validator middleware array for role removal
 * @example
 * // Use in route:
 * router.delete('/users/:id/roles', removeRolesValidation, validate, removeRoles);
 */
const removeRolesValidation = [
  param('id').isInt().withMessage('User ID must be an integer'),
  body('role_ids')
    .isArray({ min: 1 })
    .withMessage('At least one role ID is required')
    .custom(async (value) => {
      const roles = await Role.findAll({ where: { id: value } });
      if (roles.length !== value.length) {
        throw new Error('One or more role IDs are invalid');
      }
      return true;
    })
];

// Validation middleware
/**
 * Express middleware to handle validation errors using express-validator.
 * Checks for validation errors and returns formatted error response if any exist.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} JSON error response if validation fails
 * @returns {boolean} status - Always false for validation errors
 * @returns {string} message - "Validation error"
 * @returns {Array} errors - Array of validation errors from express-validator
 * @example
 * // Use as middleware in routes:
 * router.post('/users', createUserValidation, validate, createUser);
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  createUserValidation,
  updateUserValidation,
  assignRolesValidation,
  removeRolesValidation,
  validate
};
