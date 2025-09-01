const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const AppError = require('../utils/appError');
const {User, Role} = require('../models');

/**
 * Protect routes - check if user is authenticated
 * Attaches user object to req.user with roles
 */
const protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verify token with the same options used for signing
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: process.env.APP_NAME || 'Stylay',
        audience: 'user'
      });
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again!', 401));
      }
      if (err.name === 'TokenExpiredError') {
        return next(
          new AppError('Your token has expired! Please log in again.', 401)
        );
      }
      return next(new AppError('Error processing your token', 401));
    }

    // 3) Check if user still exists with roles
    const currentUser = await User.findByPk(decoded.id, {
      include: [{
        model: Role,
        as: 'roles',
        through: { attributes: [] }, // Exclude junction table attributes
        attributes: ['id', 'name', 'description']
      }]
    });

    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password! Please log in again.', 401)
      );
    }

    // Attach user to request object with roles
    req.user = currentUser.get({ plain: true });
    next();
  } catch (err) {
    next(err);
  }
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
    console.log('User roles:', req.user.roles);
    console.log('User role names:', userRoles);
    console.log('Required roles:', requiredRoles);
    
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

  const isCustomer = req.user.Roles.some(role => role.name === 'customer');
  
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

  // Check if user has the vendor role (using lowercase 'roles' to match the model association)
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
      const userRoles = req.user.Roles.map(role => role.name);
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

        const userRoles = req.user.Roles.map(role => role.name);
        
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
  if (!user?.Roles) return false;
  const userRoles = user.Roles.map(role => role.name);
  return roles.some(role => userRoles.includes(role));
};

/**
 * Check if user has all of the specified roles
 * @param {Object} user - The user object with Roles
 * @param {...string} roles - Roles to check against
 * @returns {boolean} - True if user has all of the specified roles
 */
const hasAllRoles = (user, ...roles) => {
  if (!user?.Roles) return false;
  const userRoles = user.Roles.map(role => role.name);
  return roles.every(role => userRoles.includes(role));
};

module.exports = {
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
  isOwnerOrAdmin
};
