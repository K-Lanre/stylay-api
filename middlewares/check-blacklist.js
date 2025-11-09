const tokenBlacklistService = require('../services/token-blacklist.service');
const AppError = require('../utils/appError');

/**
 * Middleware to check if JWT token is blacklisted
 * Should be used after the main JWT authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
const checkBlacklist = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, skip blacklist check
    }

    const token = authHeader.split(' ')[1];
    
    // Check if token is blacklisted
    const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      return next(new AppError('Token has been invalidated. Please log in again.', 401));
    }
    
    next();
  } catch (error) {
    console.error('Error in blacklist check middleware:', error);
    // Don't block requests if blacklist check fails
    next();
  }
};

module.exports = checkBlacklist;