const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

/**
 * Middleware to validate request using express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (errors.isEmpty()) {
    return next();
  }

  // Format errors to be more client-friendly
  const extractedErrors = errors.array().map(err => ({
    field: err.param,
    message: err.msg,
    value: err.value,
    location: err.location
  }));
  
  // Log validation errors for debugging
  console.error('Validation failed:', {
    timestamp: new Date().toISOString(),
    url: req.originalUrl,
    method: req.method,
    errors: extractedErrors
  });

  // Return validation error response
  return res.status(400).json({
    status: 'error',
    message: 'Validation failed',
    errors: extractedErrors
  });
};

module.exports = validate;
