const passport = require('passport');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { Op } = require('sequelize');
const AppError = require('../utils/appError');
const { User, Role, Permission } = require('../models');
const PermissionService = require('../services/permission.service');

/**
 * Middleware to handle local authentication using Passport
 * @returns {Function} Express middleware function
 */
const localAuth = () => {
  return (req, res, next) => {
    passport.authenticate('local', { session: false }, (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return next(new AppError(info?.message || 'Authentication failed', 401));
      }
      // Store user in request for the next middleware
      req.user = user;
      next();
    })(req, res, next);
  };
};

/**
 * Protect routes - check if user is authenticated using JWT
 * Attaches user object to req.user with roles
 */
const protect = (req, res, next) => {
  return passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      let message = 'You are not authorized to access this resource';
      if (info) {
        if (info.name === 'TokenExpiredError') {
          message = 'Your token has expired! Please log in again.';
        } else if (info.message) {
          message = info.message;
        }
      }
      return next(new AppError(message, 401));
    }

    // Attach user to request object
    req.user = user;
    return next();
  })(req, res, next);
};

/**
 * Middleware to handle JWT errors consistently
 */
const handleJWT = (req, res, next) => {
  return passport.authenticate('jwt', { session: false, failWithError: true }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      const message = info?.message || 'Authentication failed';
      return next(new AppError(message, 401));
    }
    
    req.user = user;
    return next();
  })(req, res, next);
};

/**
 * Restrict route to specific roles
 * @param {...string} roles - Roles that have access to the route
 * @example router.get('/admin', restrictTo('admin'), adminController.dashboard)
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Please log in to access this route', 401));
    }

    // Safely get user roles, defaulting to an empty array if roles is undefined
    const userRoles = req.user.roles ? req.user.roles.map(role => role.name.toLowerCase()) : [];
    const requiredRoles = roles.map(role => role.toLowerCase());
    
    // Debug logging
    
    // Check if user has any of the required roles (case-insensitive)
    const hasRequiredRole = requiredRoles.some(role => 
      userRoles.some(userRole => userRole === role)
    );
    
    if (!hasRequiredRole) {
      console.log('Access denied. User does not have required role.');
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

/**
 * Check if user is logged in (for optional authentication)
 * Attaches user to req.user if token is valid
 */
const isLoggedIn = async (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const currentUser = await User.findByPk(decoded.id, {
        include: [{
          model: Role,
          through: { attributes: [] },
          attributes: ['id', 'name', 'description']
        }]
      });

      if (currentUser) {
        req.user = currentUser.get({ plain: true });
      }
    } catch (err) {
      // If token is invalid, continue without setting req.user
    }
  }
  next();
};

/**
 * Check if user is logged out
 * Prevents access to auth routes when already logged in
 */
const isLoggedOut = (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer')) {
    return next(new AppError('You are already logged in', 400));
  }
  next();
};

/**
 * Check if user has admin role
 * Can be used as a middleware or conditionally in routes
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Please log in to access this route', 401));
  }

  const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
  
  if (!isAdmin) {
    return next(
      new AppError('You do not have permission to perform this action', 403)
    );
  }
  
  next();
};

/**
 * Check if user has customer role
 * Can be used as a middleware or conditionally in routes
 */
const isCustomer = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Please log in to access this route', 401));
  }

  const isCustomer = req.user.roles.some(role => role.name === 'customer');

  if (!isCustomer) {
    return next(
      new AppError('This action is restricted to customers only', 403)
    );
  }

  next();
};

/**
 * Check if user has vendor role
 * Can be used as a middleware or conditionally in routes
 */
const isVendor = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Please log in to access this route', 401));
  }

  // Check if user has the vendor role
  const hasVendorRole = req.user.roles &&
    Array.isArray(req.user.roles) &&
    req.user.roles.some(role => role.name === 'vendor');

  if (!hasVendorRole) {
    return next(
      new AppError('This action is restricted to vendors only', 403)
    );
  }

  next();
};

/**
 * Role-based access control middleware
 * @param {...string} roles - Roles that have access to the route
 * @example router.get('/admin', hasRole('admin', 'superadmin'), adminController.dashboard)
 */
const hasRole = (...roles) => {
  return [
    protect,
    (req, res, next) => {
      const userRoles = req.user.roles.map(role => role.name);
      const hasRequiredRole = roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return next(
          new AppError('You do not have permission to perform this action', 403)
        );
      }
      next();
    }
  ];
};

/**
 * Check if user is the owner of the resource or has admin role
 * @param {Model} model - Sequelize model to check ownership against
 * @param {string} [idParam='id'] - Name of the route parameter containing the resource ID
 * @param {string} [userIdField='userId'] - Name of the field in the model that references the user
 */
const isOwnerOrAdmin = (model, idParam = 'id', userIdField = 'userId') => {
  return [
    protect,
    async (req, res, next) => {
      try {
        const resource = await model.findByPk(req.params[idParam]);
        
        if (!resource) {
          return next(new AppError('No resource found with that ID', 404));
        }

        const userRoles = req.user.roles.map(role => role.name);

        // Grant access if user is admin
        if (userRoles.includes('admin')) {
          return next();
        }

        // Grant access if user is the owner
        if (resource[userIdField] === req.user.id) {
          return next();
        }

        return next(
          new AppError('You do not have permission to perform this action', 403)
        );
      } catch (error) {
        next(error);
      }
    }
  ];
};

/**
 * Check if user has any of the specified roles
 * Similar to restrictTo but returns a boolean instead of middleware
 * @param {Object} user - The user object with Roles
 * @param {...string} roles - Roles to check against
 * @returns {boolean} - True if user has any of the specified roles
 */
const hasAnyRole = (user, ...roles) => {
  if (!user?.roles) return false;
  const userRoles = user.roles.map(role => role.name);
  return roles.some(role => userRoles.includes(role));
};

/**
 * Check if user has all of the specified roles
 * @param {Object} user - The user object with Roles
 * @param {...string} roles - Roles to check against
 * @returns {boolean} - True if user has all of the specified roles
 */
const hasAllRoles = (user, ...roles) => {
  if (!user?.roles) return false;
  const userRoles = user.roles.map(role => role.name);
  return roles.every(role => userRoles.includes(role));
};

/**
 * Load user permissions into request
 * @returns {Function} Express middleware function
 */
const loadPermissions = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      // Load user with roles and permissions
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
};

/**
 * Check if user has specific permission (backward compatible with admin role)
 * @param {string} permission - Permission name to check
 * @returns {Function} Express middleware function
 */
const hasPermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Check specific permission
    const hasPerm = await PermissionService.checkPermission(req.user, permission);
    if (!hasPerm) {
      return next(new AppError(`Access denied. Required permission: ${permission}`, 403));
    }

    next();
  };
};

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
const hasAnyPermission = (permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Check if user has any of the specified permissions
    const hasAnyPerm = await req.user.hasAnyPermission(permissions);
    if (!hasAnyPerm) {
      return next(new AppError(`Access denied. Required one of: ${permissions.join(', ')}`, 403));
    }

    next();
  };
};

/**
 * Check if user has all of the specified permissions
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
const hasAllPermissions = (permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    // Check if user has all specified permissions
    let hasAllPerms = true;
    for (const permission of permissions) {
      if (!(await PermissionService.checkPermission(req.user, permission))) {
        hasAllPerms = false;
        break;
      }
    }

    if (!hasAllPerms) {
      return next(new AppError(`Access denied. Required all permissions: ${permissions.join(', ')}`, 403));
    }

    next();
  };
};

/**
 * Restrict to users with specific permissions or admin role
 * @param {string|string[]} permissions - Permission(s) required
 * @returns {Function} Express middleware function
 */
const restrictToPermission = (permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // Check if user has admin role (backward compatibility)
    if (PermissionService.hasAdminRole(req.user)) {
      return next();
    }

    const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
    let hasRequiredPermission = false;

    for (const permission of permissionArray) {
      if (await PermissionService.checkPermission(req.user, permission)) {
        hasRequiredPermission = true;
        break;
      }
    }

    if (!hasRequiredPermission) {
      return next(new AppError(`Access denied. Required permission: ${permissionArray.join(' or ')}`, 403));
    }

    next();
  };
};

module.exports = {
  localAuth,
  protect,
  restrictTo,
  isLoggedIn,
  isLoggedOut,
  isAdmin,
  isCustomer,
  isVendor,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isOwnerOrAdmin,
  loadPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  restrictToPermission
};
