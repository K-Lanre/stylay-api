const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getAllPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
  assignPermissionToRole,
  removePermissionFromRole,
  getRolePermissions,
  assignPermissionToUser,
  removePermissionFromUser,
  getUserPermissions,
  getUserDirectPermissions,
  seedDefaultPermissions,
  assignDefaultPermissionsToRoles,
  assignMultiplePermissionsToRole,
  removeMultiplePermissionsFromRole
} = require('../controllers/permission.controller');

const { protect, isAdmin } = require('../middlewares/auth');
const { hasPermission, can } = require('../middlewares/permission');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(isAdmin);

// Validation middleware for CREATE (all fields required)
const validatePermissionData = [
  body('name')
    .notEmpty()
    .withMessage('Permission name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Permission name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Permission name can only contain letters, numbers, and underscores'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('resource')
    .notEmpty()
    .withMessage('Resource is required')
    .isIn([
      'users', 'roles', 'permissions', 'products', 'categories', 'orders',
      'inventory', 'reviews', 'vendors', 'addresses', 'payments', 'carts',
      'collections', 'journals', 'variants', 'supply', 'notifications',
      'support', 'dashboard', 'reports', 'settings'
    ])
    .withMessage('Invalid resource'),
  
  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn([
      'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
      'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
      'archive', 'restore'
    ])
    .withMessage('Invalid action')
];

// Validation middleware for PATCH (all fields optional)
const validatePermissionDataOptional = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Permission name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Permission name can only contain letters, numbers, and underscores'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('resource')
    .optional()
    .isIn([
      'users', 'roles', 'permissions', 'products', 'categories', 'orders',
      'inventory', 'reviews', 'vendors', 'addresses', 'payments', 'carts',
      'collections', 'journals', 'variants', 'supply', 'notifications',
      'support', 'dashboard', 'reports', 'settings'
    ])
    .withMessage('Invalid resource'),
  
  body('action')
    .optional()
    .isIn([
      'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
      'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
      'archive', 'restore'
    ])
    .withMessage('Invalid action')
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

const validateRoleId = [
  body('role_id')
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer')
];

const validateUserId = [
  body('user_id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

const validateBulkPermissions = [
  body('role_id')
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer'),
  body('permission_ids')
    .isArray({ min: 1 })
    .withMessage('Permission IDs must be a non-empty array'),
  body('permission_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each permission ID must be a positive integer')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['id', 'name', 'resource', 'action', 'created_at', 'updated_at'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  
  query('resource')
    .optional()
    .isIn([
      'users', 'roles', 'permissions', 'products', 'categories', 'orders',
      'inventory', 'reviews', 'vendors', 'addresses', 'payments', 'carts',
      'collections', 'journals', 'variants', 'supply', 'notifications',
      'support', 'dashboard', 'reports', 'settings'
    ])
    .withMessage('Invalid resource filter'),
  
  query('action')
    .optional()
    .isIn([
      'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
      'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
      'archive', 'restore'
    ])
    .withMessage('Invalid action filter'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
];

// ===== PERMISSION CRUD ROUTES =====

/**
 * @route GET /api/v1/permissions
 * @desc Get all permissions with filtering and pagination
 * @access Private/Admin
 */
router.get('/', 
  validatePagination,
  hasPermission('manage_permissions'),
  getAllPermissions
);

/**
 * @route GET /api/v1/permissions/:id
 * @desc Get a single permission by ID
 * @access Private/Admin
 */
router.get('/:id',
  validateId,
  hasPermission('manage_permissions'),
  getPermission
);

/**
 * @route POST /api/v1/permissions
 * @desc Create a new permission
 * @access Private/Admin
 */
router.post('/',
  validatePermissionData,
  hasPermission('create_permissions'),
  createPermission
);

/**
 * @route PATCH /api/v1/permissions/:id
 * @desc Update a permission
 * @access Private/Admin
 */
router.patch('/:id',
  validateId,
  validatePermissionDataOptional,
  hasPermission('update_permissions'),
  updatePermission
);

/**
 * @route DELETE /api/v1/permissions/:id
 * @desc Delete a permission
 * @access Private/Admin
 */
router.delete('/:id',
  validateId,
  hasPermission('delete_permissions'),
  deletePermission
);

// ===== ROLE-PERMISSION MANAGEMENT ROUTES =====

/**
 * @route POST /api/v1/permissions/:id/roles
 * @desc Assign permission to role
 * @access Private/Admin
 */
router.post('/:id/roles',
  validateId,
  validateRoleId,
  hasPermission('manage_permissions'),
  assignPermissionToRole
);

/**
 * @route DELETE /api/v1/permissions/:id/roles/:roleId
 * @desc Remove permission from role
 * @access Private/Admin
 */
router.delete('/:id/roles/:roleId',
  validateId,
  param('roleId').isInt({ min: 1 }).withMessage('Role ID must be a positive integer'),
  hasPermission('manage_permissions'),
  removePermissionFromRole
);

/**
 * @route GET /api/v1/roles/:id/permissions
 * @desc Get permissions for a role
 * @access Private/Admin
 */
router.get('/roles/:id/permissions',
  validateId,
  hasPermission('manage_permissions'),
  getRolePermissions
);

/**
 * @route POST /api/v1/permissions/bulk-assign-to-role
 * @desc Assign multiple permissions to a role
 * @access Private/Admin
 */
router.post('/bulk-assign-to-role',
  validateBulkPermissions,
  hasPermission('manage_permissions'),
  assignMultiplePermissionsToRole
);

/**
 * @route POST /api/v1/permissions/bulk-remove-from-role
 * @desc Remove multiple permissions from a role
 * @access Private/Admin
 */
router.post('/bulk-remove-from-role',
  validateBulkPermissions,
  hasPermission('manage_permissions'),
  removeMultiplePermissionsFromRole
);

// ===== USER-PERMISSION MANAGEMENT ROUTES =====

/**
 * @route POST /api/v1/permissions/:id/users
 * @desc Assign permission to user directly
 * @access Private/Admin
 */
router.post('/:id/users',
  validateId,
  validateUserId,
  hasPermission('manage_permissions'),
  assignPermissionToUser
);

/**
 * @route DELETE /api/v1/permissions/:id/users/:userId
 * @desc Remove permission from user
 * @access Private/Admin
 */
router.delete('/:id/users/:userId',
  validateId,
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  hasPermission('manage_permissions'),
  removePermissionFromUser
);

/**
 * @route GET /api/v1/users/:id/permissions
 * @desc Get all permissions for a user (role-based + direct)
 * @access Private/Admin or User (own permissions)
 */
router.get('/users/:id/permissions',
  param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  can('users', 'read'),
  getUserPermissions
);

/**
 * @route GET /api/v1/users/:id/direct-permissions
 * @desc Get direct permissions for a user only
 * @access Private/Admin or User (own permissions)
 */
router.get('/users/:id/direct-permissions',
  param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  can('users', 'read'),
  getUserDirectPermissions
);

// ===== ADMIN UTILITY ROUTES =====

/**
 * @route POST /api/v1/permissions/seed
 * @desc Seed default permissions into the database
 * @access Private/Admin
 */
router.post('/seed',
  hasPermission('manage_permissions'),
  seedDefaultPermissions
);

/**
 * @route POST /api/v1/permissions/assign-defaults
 * @desc Assign default permissions to existing roles
 * @access Private/Admin
 */
router.post('/assign-defaults',
  hasPermission('manage_permissions'),
  assignDefaultPermissionsToRoles
);

module.exports = router;
