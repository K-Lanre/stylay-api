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
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

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
