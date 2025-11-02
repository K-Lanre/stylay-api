'use strict';

const AppError = require('../utils/appError');
const PermissionService = require('../services/permission.service');
const logger = require('../utils/logger');

/**
 * Check if user has a specific permission
 * @param {string} permissionName - Name of the permission to check
 * @returns {Function} Express middleware function
 */
const hasPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      const hasPermission = await PermissionService.hasPermission(req.user.id, permissionName);

      if (!hasPermission) {
        logger.warn(`User ${req.user.email} attempted to access ${req.originalUrl} without permission: ${permissionName}`);
        return next(
          new AppError(`You do not have permission to perform this action: ${permissionName}`, 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in hasPermission middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

/**
 * Check if user has any of the specified permissions
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Function} Express middleware function
 */
const hasAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      const userPermissions = await PermissionService.getUserPermissions(req.user.id);
      const userPermissionNames = userPermissions.map(p => p.name);

      const hasAnyPermission = permissionNames.some(permission => 
        userPermissionNames.includes(permission)
      );

      if (!hasAnyPermission) {
        logger.warn(`User ${req.user.email} attempted to access ${req.originalUrl} without any of permissions: ${permissionNames.join(', ')}`);
        return next(
          new AppError(`You do not have permission to perform this action. Required: ${permissionNames.join(' or ')}`, 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in hasAnyPermission middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

/**
 * Check if user has all of the specified permissions
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Function} Express middleware function
 */
const hasAllPermissions = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      const userPermissions = await PermissionService.getUserPermissions(req.user.id);
      const userPermissionNames = userPermissions.map(p => p.name);

      const hasAllPermissions = permissionNames.every(permission => 
        userPermissionNames.includes(permission)
      );

      if (!hasAllPermissions) {
        logger.warn(`User ${req.user.email} attempted to access ${req.originalUrl} without all permissions: ${permissionNames.join(', ')}`);
        return next(
          new AppError(`You do not have permission to perform this action. Required: ${permissionNames.join(' and ')}`, 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in hasAllPermissions middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

/**
 * Check if user has permission for a specific resource and action
 * @param {string} resource - Resource name (e.g., 'products', 'orders')
 * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Function} Express middleware function
 */
const hasPermissionTo = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      const hasPermission = await PermissionService.hasPermissionTo(req.user.id, resource, action);

      if (!hasPermission) {
        logger.warn(`User ${req.user.email} attempted to access ${req.originalUrl} without permission: ${action} ${resource}`);
        return next(
          new AppError(`You do not have permission to ${action} ${resource}`, 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in hasPermissionTo middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

/**
 * Quick resource-action check middleware (same as hasPermissionTo but shorter name)
 * @param {string} resource - Resource name
 * @param {string} action - Action name
 * @returns {Function} Express middleware function
 */
const can = (resource, action) => {
  return hasPermissionTo(resource, action);
};

/**
 * Check if user is admin or has specific permission
 * @param {string} permissionName - Permission name to check if not admin
 * @returns {Function} Express middleware function
 */
const isAdminOrHasPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      // Check if user is admin
      const isAdmin = await req.user.isAdmin();

      if (isAdmin) {
        return next();
      }

      // If not admin, check for specific permission
      const hasPermission = await PermissionService.hasPermission(req.user.id, permissionName);

      if (!hasPermission) {
        logger.warn(`User ${req.user.email} attempted to access ${req.originalUrl} without admin role or permission: ${permissionName}`);
        return next(
          new AppError('You must be an administrator or have specific permission to access this route', 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in isAdminOrHasPermission middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

/**
 * Check if user owns resource or has permission
 * @param {string} permissionName - Permission name to check if not owner
 * @param {string} userIdField - Field name containing user ID in the resource (default: 'user_id')
 * @returns {Function} Express middleware function
 */
const isOwnerOrHasPermission = (permissionName, userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      // If resource is in req.params, get the user ID from the resource
      const resourceUserId = req.params[userIdField] || req.body[userIdField];

      // Check if user owns the resource
      if (resourceUserId && parseInt(resourceUserId) === req.user.id) {
        return next();
      }

      // If not owner, check for permission
      const hasPermission = await PermissionService.hasPermission(req.user.id, permissionName);

      if (!hasPermission) {
        logger.warn(`User ${req.user.email} attempted to access ${req.originalUrl} without ownership or permission: ${permissionName}`);
        return next(
          new AppError('You can only access your own resources or have specific permission', 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in isOwnerOrHasPermission middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

/**
 * Middleware to load user permissions for use in route handlers
 * @returns {Function} Express middleware function
 */
const loadUserPermissions = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      const permissions = await PermissionService.getUserPermissions(req.user.id);
      req.user.permissions = permissions;
      req.user.permissionNames = permissions.map(p => p.name);
    }
    next();
  } catch (error) {
    logger.error('Error loading user permissions:', error);
    // Don't block the request if permission loading fails
    next();
  }
};

/**
 * Utility function to check permissions synchronously (for use in route handlers)
 * @param {Object} user - User object
 * @param {string} permissionName - Permission name to check
 * @returns {boolean} Has permission
 */
const userHasPermission = (user, permissionName) => {
  if (!user || !user.permissionNames) {
    return false;
  }
  return user.permissionNames.includes(permissionName);
};

/**
 * Utility function to check resource-action permissions synchronously
 * @param {Object} user - User object
 * @param {string} resource - Resource name
 * @param {string} action - Action name
 * @returns {boolean} Has permission
 */
const userCan = (user, resource, action) => {
  if (!user || !user.permissions) {
    return false;
  }
  return user.permissions.some(permission => 
    permission.resource === resource && permission.action === action
  );
};

/**
 * Middleware to check multiple permissions at once
 * @param {Array<Object>} checks - Array of check objects { permission, resource, action }
 * @returns {Function} Express middleware function
 */
const checkMultiplePermissions = (checks) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Please log in to access this route', 401));
      }

      const userPermissions = await PermissionService.getUserPermissions(req.user.id);
      const userPermissionNames = userPermissions.map(p => p.name);

      const failedChecks = [];

      for (const check of checks) {
        let hasCheck = false;

        if (check.permission) {
          hasCheck = userPermissionNames.includes(check.permission);
        } else if (check.resource && check.action) {
          hasCheck = userPermissions.some(p => 
            p.resource === check.resource && p.action === check.action
          );
        }

        if (!hasCheck) {
          failedChecks.push(check.permission || `${check.action} ${check.resource}`);
        }
      }

      if (failedChecks.length > 0) {
        logger.warn(`User ${req.user.email} failed permission checks: ${failedChecks.join(', ')}`);
        return next(
          new AppError(`Insufficient permissions. Missing: ${failedChecks.join(', ')}`, 403)
        );
      }

      next();
    } catch (error) {
      logger.error('Error in checkMultiplePermissions middleware:', error);
      next(new AppError('Internal server error', 500));
    }
  };
};

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasPermissionTo,
  can,
  isAdminOrHasPermission,
  isOwnerOrHasPermission,
  loadUserPermissions,
  userHasPermission,
  userCan,
  checkMultiplePermissions
};
