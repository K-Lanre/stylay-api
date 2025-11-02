const PermissionService = require('../services/permission.service');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Get all permissions with filtering and pagination
 * @route GET /api/v1/permissions
 * @access Private/Admin
 */
const getAllPermissions = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      resource: req.query.resource,
      action: req.query.action,
      search: req.query.search,
      sortBy: req.query.sortBy || 'name',
      sortOrder: req.query.sortOrder || 'ASC'
    };

    const result = await PermissionService.getAllPermissions(options);

    res.status(200).json({
      status: 'success',
      results: result.permissions.length,
      pagination: result.pagination,
      data: result.permissions
    });
  } catch (error) {
    logger.error('Error fetching permissions:', error);
    next(new AppError('Failed to fetch permissions', 500));
  }
};

/**
 * Get a single permission by ID
 * @route GET /api/v1/permissions/:id
 * @access Private/Admin
 */
const getPermission = async (req, res, next) => {
  try {
    const permission = await PermissionService.getPermission(req.params.id);

    res.status(200).json({
      status: 'success',
      data: {
        permission
      }
    });
  } catch (error) {
    logger.error(`Error fetching permission ${req.params.id}:`, error);
    if (error.message.includes('not found')) {
      return next(new AppError('Permission not found', 404));
    }
    next(new AppError('Failed to fetch permission', 500));
  }
};

/**
 * Create a new permission
 * @route POST /api/v1/permissions
 * @access Private/Admin
 */
const createPermission = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const permission = await PermissionService.createPermission(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        permission
      }
    });
  } catch (error) {
    logger.error('Error creating permission:', error);
    if (error.message.includes('already exists')) {
      return next(new AppError(error.message, 409));
    }
    if (error.message.includes('Invalid resource') || error.message.includes('Invalid action')) {
      return next(new AppError(error.message, 400));
    }
    next(new AppError('Failed to create permission', 500));
  }
};

/**
 * Update a permission
 * @route PATCH /api/v1/permissions/:id
 * @access Private/Admin
 */
const updatePermission = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const permission = await PermissionService.updatePermission(req.params.id, req.body);

    res.status(200).json({
      status: 'success',
      data: {
        permission
      }
    });
  } catch (error) {
    logger.error(`Error updating permission ${req.params.id}:`, error);
    if (error.message.includes('not found')) {
      return next(new AppError('Permission not found', 404));
    }
    if (error.message.includes('already exists')) {
      return next(new AppError(error.message, 409));
    }
    next(new AppError('Failed to update permission', 500));
  }
};

/**
 * Delete a permission
 * @route DELETE /api/v1/permissions/:id
 * @access Private/Admin
 */
const deletePermission = async (req, res, next) => {
  try {
    await PermissionService.deletePermission(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error(`Error deleting permission ${req.params.id}:`, error);
    if (error.message.includes('not found')) {
      return next(new AppError('Permission not found', 404));
    }
    next(new AppError('Failed to delete permission', 500));
  }
};

/**
 * Assign permission to role
 * @route POST /api/v1/permissions/:id/roles
 * @access Private/Admin
 */
const assignPermissionToRole = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const { role_id } = req.body;
    const result = await PermissionService.assignPermissionToRole(req.params.id, role_id);

    res.status(200).json({
      status: 'success',
      data: {
        assignment: result.permissionRole,
        created: result.created
      }
    });
  } catch (error) {
    logger.error('Error assigning permission to role:', error);
    if (error.message.includes('not found')) {
      return next(new AppError(error.message, 404));
    }
    next(new AppError('Failed to assign permission to role', 500));
  }
};

/**
 * Remove permission from role
 * @route DELETE /api/v1/permissions/:id/roles/:roleId
 * @access Private/Admin
 */
const removePermissionFromRole = async (req, res, next) => {
  try {
    const success = await PermissionService.removePermissionFromRole(req.params.id, req.params.roleId);

    if (!success) {
      return next(new AppError('Permission-role assignment not found', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error('Error removing permission from role:', error);
    if (error.message.includes('not found')) {
      return next(new AppError(error.message, 404));
    }
    next(new AppError('Failed to remove permission from role', 500));
  }
};

/**
 * Get role permissions
 * @route GET /api/v1/roles/:id/permissions
 * @access Private/Admin
 */
const getRolePermissions = async (req, res, next) => {
  try {
    const permissions = await PermissionService.getRolePermissions(req.params.id);

    res.status(200).json({
      status: 'success',
      results: permissions.length,
      data: {
        permissions
      }
    });
  } catch (error) {
    logger.error(`Error fetching role permissions for role ${req.params.id}:`, error);
    next(new AppError('Failed to fetch role permissions', 500));
  }
};

/**
 * Assign permission to user directly
 * @route POST /api/v1/permissions/:id/users
 * @access Private/Admin
 */
const assignPermissionToUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const { user_id } = req.body;
    const result = await PermissionService.assignPermissionToUser(req.params.id, user_id);

    res.status(200).json({
      status: 'success',
      data: {
        assignment: result.permissionUser,
        created: result.created
      }
    });
  } catch (error) {
    logger.error('Error assigning permission to user:', error);
    if (error.message.includes('not found')) {
      return next(new AppError(error.message, 404));
    }
    next(new AppError('Failed to assign permission to user', 500));
  }
};

/**
 * Remove permission from user
 * @route DELETE /api/v1/permissions/:id/users/:userId
 * @access Private/Admin
 */
const removePermissionFromUser = async (req, res, next) => {
  try {
    const success = await PermissionService.removePermissionFromUser(req.params.id, req.params.userId);

    if (!success) {
      return next(new AppError('Permission-user assignment not found', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error('Error removing permission from user:', error);
    if (error.message.includes('not found')) {
      return next(new AppError(error.message, 404));
    }
    next(new AppError('Failed to remove permission from user', 500));
  }
};

/**
 * Get user permissions
 * @route GET /api/v1/users/:id/permissions
 * @access Private/Admin or User (own permissions)
 */
const getUserPermissions = async (req, res, next) => {
  try {
    // Check if user can access this data
    if (req.user.id !== parseInt(req.params.id) && !(await req.user.isAdmin())) {
      return next(new AppError('You can only view your own permissions or be an admin', 403));
    }

    const permissions = await PermissionService.getUserPermissions(req.params.id);

    res.status(200).json({
      status: 'success',
      results: permissions.length,
      data: {
        permissions
      }
    });
  } catch (error) {
    logger.error(`Error fetching user permissions for user ${req.params.id}:`, error);
    next(new AppError('Failed to fetch user permissions', 500));
  }
};

/**
 * Get user direct permissions only
 * @route GET /api/v1/users/:id/direct-permissions
 * @access Private/Admin or User (own permissions)
 */
const getUserDirectPermissions = async (req, res, next) => {
  try {
    // Check if user can access this data
    if (req.user.id !== parseInt(req.params.id) && !(await req.user.isAdmin())) {
      return next(new AppError('You can only view your own permissions or be an admin', 403));
    }

    const permissions = await PermissionService.getUserDirectPermissions(req.params.id);

    res.status(200).json({
      status: 'success',
      results: permissions.length,
      data: {
        permissions
      }
    });
  } catch (error) {
    logger.error(`Error fetching user direct permissions for user ${req.params.id}:`, error);
    next(new AppError('Failed to fetch user direct permissions', 500));
  }
};

/**
 * Seed default permissions
 * @route POST /api/v1/permissions/seed
 * @access Private/Admin
 */
const seedDefaultPermissions = async (req, res, next) => {
  try {
    const createdPermissions = await PermissionService.seedDefaultPermissions();

    res.status(200).json({
      status: 'success',
      message: `Seeded ${createdPermissions.length} default permissions`,
      data: {
        created_count: createdPermissions.length,
        permissions: createdPermissions
      }
    });
  } catch (error) {
    logger.error('Error seeding default permissions:', error);
    next(new AppError('Failed to seed default permissions', 500));
  }
};

/**
 * Assign default permissions to roles
 * @route POST /api/v1/permissions/assign-defaults
 * @access Private/Admin
 */
const assignDefaultPermissionsToRoles = async (req, res, next) => {
  try {
    const results = await PermissionService.assignDefaultPermissionsToRoles();

    res.status(200).json({
      status: 'success',
      message: 'Default permissions assigned to roles',
      data: {
        results
      }
    });
  } catch (error) {
    logger.error('Error assigning default permissions to roles:', error);
    next(new AppError('Failed to assign default permissions to roles', 500));
  }
};

/**
 * Assign multiple permissions to role
 * @route POST /api/v1/permissions/bulk-assign-to-role
 * @access Private/Admin
 */
const assignMultiplePermissionsToRole = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const { role_id, permission_ids } = req.body;
    const results = await PermissionService.assignMultiplePermissionsToRole(role_id, permission_ids);

    res.status(200).json({
      status: 'success',
      data: {
        role_id,
        assigned_count: results.assignedCount,
        skipped_count: results.skippedCount,
        results: results.results
      }
    });
  } catch (error) {
    logger.error('Error assigning multiple permissions to role:', error);
    if (error.message.includes('not found')) {
      return next(new AppError(error.message, 404));
    }
    next(new AppError('Failed to assign multiple permissions to role', 500));
  }
};

/**
 * Remove multiple permissions from role
 * @route POST /api/v1/permissions/bulk-remove-from-role
 * @access Private/Admin
 */
const removeMultiplePermissionsFromRole = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400, errors.array()));
    }

    const { role_id, permission_ids } = req.body;
    const results = await PermissionService.removeMultiplePermissionsFromRole(role_id, permission_ids);

    res.status(200).json({
      status: 'success',
      data: {
        role_id,
        removed_count: results.removedCount,
        not_found_count: results.notFoundCount,
        results: results.results
      }
    });
  } catch (error) {
    logger.error('Error removing multiple permissions from role:', error);
    if (error.message.includes('not found')) {
      return next(new AppError(error.message, 404));
    }
    next(new AppError('Failed to remove multiple permissions from role', 500));
  }
};

module.exports = {
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
};
