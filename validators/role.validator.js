const { body } = require('express-validator');
const { Role } = require('../models');
const logger = require('../utils/logger');

// Common validation rules for role creation and update
const roleValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Role name is required')
    .isLength({ min: 3, max: 50 }).withMessage('Role name must be between 3 and 50 characters')
    .matches(/^[a-z0-9-]+$/).withMessage('Role name can only contain lowercase letters, numbers, and hyphens')
    .custom(async (value, { req }) => {
      // Check if role name is already taken (case insensitive)
      const role = await Role.findOne({ where: { name: value.toLowerCase() } });
      if (role && role.id !== req.params?.id) {
        throw new Error('Role with this name already exists');
      }
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot be longer than 500 characters')
];

// Validation for creating a new role
const createRoleValidation = [
  ...roleValidationRules,
  body('name')
    .custom((value) => {
      // Prevent creating system roles
      const systemRoles = ['customer', 'vendor', 'admin'];
      if (systemRoles.includes(value.toLowerCase())) {
        throw new Error('Cannot create a system role');
      }
      return true;
    })
];

// Validation for updating a role
const updateRoleValidation = [
  ...roleValidationRules,
  body('name')
    .optional()
    .custom(async (value, { req }) => {
      // Prevent modifying system roles
      const role = await Role.findByPk(req.params.id);
      if (!role) {
        throw new Error('Role not found');
      }
      
      const systemRoles = ['customer', 'vendor', 'admin'];
      if (systemRoles.includes(role.name)) {
        throw new Error('System roles cannot be modified');
      }
      return true;
    })
];

// Validation for deleting a role
const deleteRoleValidation = [
  body()
    .custom(async (_, { req }) => {
      const role = await Role.findByPk(req.params.id);
      if (!role) {
        throw new Error('Role not found');
      }
      
      // Prevent deleting system roles
      const systemRoles = ['customer', 'vendor', 'admin'];
      if (systemRoles.includes(role.name)) {
        throw new Error('System roles cannot be deleted');
      }
      
      // Check if role is assigned to any user
      const userCount = await role.countUsers();
      if (userCount > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }
      
      return true;
    })
];

// Middleware to handle validation errors
/**
 * Express middleware to handle validation errors using express-validator.
 * Formats validation errors with detailed field information and sends structured error response.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} JSON error response if validation fails
 * @returns {boolean} status - Error status
 * @returns {string} message - "Validation failed"
 * @returns {Array} errors - Array of validation error objects with field, message details
 * @example
 * // Use as middleware in routes:
 * router.post('/roles', createRoleValidation, validate, createRole);
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', { errors: errors.array() });
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

module.exports = {
  createRoleValidation,
  updateRoleValidation,
  deleteRoleValidation,
  validate
};
