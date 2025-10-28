const PermissionService = require('../services/permission.service');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Middleware to check if user has specific permission
 * @param {string|string[]} permissions - Permission name(s) to check
 * @returns {Function} Express middleware function
 */
const requirePermission = (permissions) => {
  return catchAsync(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Convert single permission to array
    const permissionArray = Array.isArray(permissions) ? permissions : [permissions];

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Check specific permissions
    let hasPermission = false;

    for (const permission of permissionArray) {
      if (await PermissionService.checkPermission(req.user, permission)) {
        hasPermission = true;
        break;
      }
    }

    if (!hasPermission) {
      return next(new AppError(`Access denied. Required permission: ${permissionArray.join(' or ')}`, 403));
    }

    next();
  });
};

/**
 * Middleware to check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
const requireAnyPermission = (permissions) => {
  return catchAsync(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Check if user has any of the specified permissions
    const hasAnyPermission = await req.user.hasAnyPermission(permissions);

    if (!hasAnyPermission) {
      return next(new AppError(`Access denied. Required one of: ${permissions.join(', ')}`, 403));
    }

    next();
  });
};

/**
 * Middleware to check if user has all of the specified permissions
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
const requireAllPermissions = (permissions) => {
  return catchAsync(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Check if user has all specified permissions
    let hasAllPermissions = true;

    for (const permission of permissions) {
      if (!(await PermissionService.checkPermission(req.user, permission))) {
        hasAllPermissions = false;
        break;
      }
    }

    if (!hasAllPermissions) {
      return next(new AppError(`Access denied. Required all permissions: ${permissions.join(', ')}`, 403));
    }

    next();
  });
};

/**
 * Middleware to check resource ownership or admin permission
 * @param {string} resourcePermission - Permission needed for the resource
 * @param {Function} getResourceOwnerId - Function to get resource owner ID from request
 * @returns {Function} Express middleware function
 */
const requireResourcePermission = (resourcePermission, getResourceOwnerId) => {
  return catchAsync(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role or specific permission
    if (PermissionService.hasAdminRole(req.user) ||
        await PermissionService.checkPermission(req.user, resourcePermission)) {
      return next();
    }

    // If ownership check is provided, check if user owns the resource
    if (getResourceOwnerId) {
      try {
        const resourceOwnerId = await getResourceOwnerId(req);
        if (resourceOwnerId === req.user.id) {
          return next(); // User owns the resource
        }
      } catch (error) {
        // If ownership check fails, continue to permission check
      }
    }

    return next(new AppError(`Access denied. Required permission: ${resourcePermission}`, 403));
  });
};

/**
 * Middleware to load user permissions into request
 * @returns {Function} Express middleware function
 */
const loadUserPermissions = catchAsync(async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      // Load user with roles and permissions
      const { User, Role, Permission } = require('../models');

      const userWithPermissions = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'roles',
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] }
              }
            ],
            through: { attributes: [] }
          }
        ]
      });

      if (userWithPermissions) {
        req.user = userWithPermissions;
      }
    } catch (error) {
      // If loading permissions fails, continue without them
      console.warn('Failed to load user permissions:', error.message);
    }
  }

  next();
});

/**
 * Middleware to check if user has permissions from specific groups
 * @param {string[]} groups - Array of permission groups to check
 * @returns {Function} Express middleware function
 */
const requirePermissionGroups = (groups) => {
  return catchAsync(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Get all permissions for the specified groups
    const groupPermissions = PermissionService.getPermissionsByGroups(groups);
    const permissionNames = groupPermissions.map(p => p.name);

    // Check if user has any of the permissions from the groups
    let hasGroupPermission = false;
    for (const permission of permissionNames) {
      if (await PermissionService.checkPermission(req.user, permission)) {
        hasGroupPermission = true;
        break;
      }
    }

    if (!hasGroupPermission) {
      return next(new AppError(`Access denied. Required permissions from groups: ${groups.join(', ')}`, 403));
    }

    next();
  });
};

/**
 * Helper function to check permission without middleware
 * @param {Object} user - User object with roles and permissions
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
const hasPermission = async (user, permission) => {
  return await PermissionService.checkPermission(user, permission);
};

/**
 * Helper function to check if user has permissions from specific groups
 * @param {Object} user - User object with roles and permissions
 * @param {string[]} groups - Array of permission groups
 * @returns {boolean} True if user has permissions from any of the groups
 */
const hasPermissionGroups = async (user, groups) => {
  // Check if user has admin role (backward compatibility)
  if (PermissionService.hasAdminRole(user)) {
    return true;
  }

  // Get all permissions for the specified groups
  const groupPermissions = PermissionService.getPermissionsByGroups(groups);
  const permissionNames = groupPermissions.map(p => p.name);

  // Check if user has any of the permissions from the groups
  for (const permission of permissionNames) {
    if (await PermissionService.checkPermission(user, permission)) {
      return true;
    }
  }

  return false;
};

/**
 * Helper function to check if user has admin role
 * @param {Object} user - User object
 * @returns {boolean} True if user has admin role
 */
const isAdmin = (user) => {
  return PermissionService.hasAdminRole(user);
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireResourcePermission,
  requirePermissionGroups,
  loadUserPermissions,
  hasPermission,
  hasPermissionGroups,
  isAdmin
};
