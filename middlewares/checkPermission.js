const PermissionService = require('../services/permission.service');
const { 
  permissionMap, 
  publicRoutes, 
  generateRouteKey, 
  isPublicRoute, 
  getRequiredPermission 
} = require('../config/permission-mapping');
const { User, Role, Permission } = require('../models');

/**
 * CheckPermission Middleware
 * Automatically protects routes based on permission mappings, similar to Laravel CheckPermission
 * 
 * Features:
 * - Public route exemption
 * - Route-to-permission mapping
 * - User context setting for vendors
 * - Permission caching in session
 * - Comprehensive error handling
 */

const checkPermission = async (req, res, next) => {
  try {
    const routeKey = generateRouteKey(req.method, req.originalUrl);
    
    // DEBUG: Log permission check process
    // console.log("=== PERMISSION CHECK DEBUG ===");
    // console.log("Request method:", req.method);
    // console.log("Request originalUrl:", req.originalUrl);
    // console.log("Generated route key:", routeKey);
    console.log("Is public route:", isPublicRoute(req.method, req.originalUrl));
    console.log("Required permission:", getRequiredPermission(req.method, req.originalUrl));
    console.log("User authenticated:", !!req.user);
    console.log("================================");
    
    // 1. Check if route is public
    if (isPublicRoute(req.method, req.originalUrl)) {
      console.log("Route is public, allowing access");
      return next(); // Allow access to public routes
    }

    // 2. Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this resource.'
      });
    } 

    // 3. Set user context if not already set
    await setUserContext(req);

    // 4. Get required permission for the route
    const requiredPermission = getRequiredPermission(req.method, req.originalUrl);
    
    if (!requiredPermission) {
      // Route exists but no specific permission required - allow access to authenticated users
      return next();
    }

    // 5. Check if user has required permission
    const hasPermission = await checkUserPermission(req, req.user, requiredPermission);
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${requiredPermission}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // 6. Store permission check result in request for future middleware
    req.permissionCheck = {
      requiredPermission,
      checked: true,
      timestamp: new Date()
    };

    next();
  } catch (error) {
    console.error('CheckPermission middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during permission check',
      code: 'PERMISSION_CHECK_ERROR'
    });
  }
};

/**
 * Set user context, particularly vendor context
 * @param {Object} req - Express request object
 */
async function setUserContext(req) {
  try {
    // If user context is already set, skip
    if (req.userContext && req.userContext.set) {
      return;
    }

    // Load full user with roles and permissions if not already loaded
    if (!req.user.roles || !Array.isArray(req.user.roles)) {
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
    }

    // Set vendor context for vendor users
    if (req.user.roles && req.user.roles.some(role => role.name === 'vendor')) {
      // Check if vendor profile exists
      const { Vendor } = require('../models');
      const vendorProfile = await Vendor.findOne({
        where: { user_id: req.user.id },
        attributes: ['id', 'status']
      });

      if (vendorProfile) {
        req.vendorContext = {
          id: vendorProfile.id,
          status: vendorProfile.status,
          set: true
        };
      } else {
        // Vendor user without profile - might be during onboarding
        req.vendorContext = {
          id: null,
          status: 'pending',
          set: true,
          onboarding: true
        };
      }
    }

    // Set admin context for admin users
    if (req.user.roles && req.user.roles.some(role => role.name === 'admin')) {
      req.adminContext = {
        isAdmin: true,
        permissions: await PermissionService.getUserPermissions(req.user.id)
      };
    }

    req.userContext = { set: true, timestamp: new Date() };
  } catch (error) {
    console.warn('Failed to set user context:', error.message);
    // Continue without context - don't block access
  }
}

/**
 * Check if user has required permission with caching
 * @param {Object} user - User object with roles and permissions
 * @param {string} requiredPermission - Required permission name
 * @returns {boolean} True if user has permission
 */
async function checkUserPermission(req, user, requiredPermission) {
  try {
    // Check session cache first
    if (req.session && req.session.userPermissions) {
      const cachedPermissions = req.session.userPermissions;
      const cacheTimestamp = req.session.permissionsTimestamp;
      
      // Check if cache is still valid (1 hour)
      if (cacheTimestamp && (Date.now() - cacheTimestamp) < 3600000) {
        return cachedPermissions.includes(requiredPermission);
      }
    }

    // Use PermissionService to check permission
    const hasPermission = await PermissionService.checkPermission(user, requiredPermission);

    // Cache permission result in session
    if (req.session) {
      const allPermissions = await PermissionService.getUserPermissions(user.id);
      req.session.userPermissions = allPermissions.map(p => p.name);
      req.session.permissionsTimestamp = Date.now();
    }

    return hasPermission;
  } catch (error) {
    console.error('Permission check error:', error);
    // On error, deny access for safety
    return false;
  }
}

/**
 * Helper function to get route information
 * @param {Object} req - Express request object
 * @returns {Object} Route information
 */
function getRouteInfo(req) {
  return {
    method: req.method,
    path: req.originalUrl,
    routeKey: generateRouteKey(req.method, req.originalUrl),
    requiredPermission: getRequiredPermission(req.method, req.originalUrl),
    isPublic: isPublicRoute(req.method, req.originalUrl)
  };
}

/**
 * Middleware to check specific permission (convenience method)
 * @param {string} permission - Permission name to check
 * @returns {Function} Express middleware
 */
const requireSpecificPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const hasPermission = await PermissionService.checkPermission(req.user, permission);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`
        });
      }

      next();
    } catch (error) {
      console.error('Specific permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

/**
 * Middleware to check multiple permissions (any of them)
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware
 */
const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const hasAnyPermission = await Promise.any(
        permissions.map(perm => PermissionService.checkPermission(req.user, perm))
      ).then(() => true).catch(() => false);

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required one of: ${permissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Any permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

/**
 * Middleware to get route permission info for debugging
 * @returns {Function} Express middleware
 */
const debugRoutePermissions = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    req.routeInfo = getRouteInfo(req);
    console.log('Route Permission Debug:', req.routeInfo);
  }
  next();
};

module.exports = {
  checkPermission,
  requireSpecificPermission,
  requireAnyPermission,
  debugRoutePermissions,
  generateRouteKey,
  isPublicRoute,
  getRequiredPermission,
  getRouteInfo
};
