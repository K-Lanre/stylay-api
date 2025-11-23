
const AppError = require("../utils/appError");
const { Op } = require("sequelize");

const recentlyViewedService = require("../services/recently-viewed.service");

/**
 * Retrieves the user's recently viewed products with full product details.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.limit=10] - Number of products to return (max 50)
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with recently viewed products
 * @returns {boolean} data.success - Success flag
 * @returns {number} data.count - Number of products returned
 * @returns {Array} data.data - Array of recently viewed products with details
 * @throws {AppError} 401 - When user not authenticated
 * @api {get} /api/v1/products/recent Get Recently Viewed Products
 * @private user
 * @example
 * // Request
 * GET /api/v1/products/recent?limit=5
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 3,
 *   "data": [
 *     {
 *       "id": 123,
 *       "name": "Wireless Headphones",
 *       "slug": "wireless-headphones",
 *       "description": "High-quality wireless headphones",
 *       "price": 99.99,
 *       "status": "active",
 *       "Category": {"id": 1, "name": "Electronics"},
 *       "Vendor": {"id": 1, "business_name": "Tech Store"},
 *       "images": [{"id": 1, "image_url": "https://example.com/image.jpg"}]
 *     }
 *   ]
 * }
 */
const getRecentViews = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user.id;

    // Get recently viewed products
    const recentViews = await recentlyViewedService.getRecentViews({
      userId,
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      count: recentViews.length,
      data: recentViews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clears the user's recently viewed products history.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Deletion result
 * @returns {number} data.data.deletedCount - Number of records deleted
 * @throws {AppError} 401 - When user not authenticated
 * @api {delete} /api/v1/products/recent Clear Recently Viewed Products
 * @private user
 * @example
 * // Request
 * DELETE /api/v1/products/recent
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "deletedCount": 15
 *   }
 * }
 */
const clearRecentViews = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await recentlyViewedService.clearRecentViews({ userId });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets viewing statistics for the authenticated user.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with view statistics
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Statistics data
 * @returns {number} data.data.totalViews - Total number of product views
 * @returns {number} data.data.uniqueProducts - Number of unique products viewed
 * @returns {string} data.data.lastViewDate - Date of most recent view
 * @throws {AppError} 401 - When user not authenticated
 * @api {get} /api/v1/products/recent/stats Get View Statistics
 * @private user
 * @example
 * // Request
 * GET /api/v1/products/recent/stats
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "totalViews": 45,
 *     "uniqueProducts": 23,
 *     "lastViewDate": "2024-11-08T20:15:00.000Z"
 *   }
 * }
 */
const getViewStatistics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const statistics = await recentlyViewedService.getViewStatistics({
      userId,
    });

    res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Anonymizes user's view data for GDPR compliance.
 * Removes personal identifiers while keeping aggregate analytics.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID to anonymize
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming anonymization
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Anonymization result
 * @returns {number} data.data.anonymizedCount - Number of records anonymized
 * @throws {AppError} 401 - When user not authenticated
 * @api {patch} /api/v1/products/recent/anonymize Anonymize User View Data (GDPR)
 * @private user
 * @example
 * // Request
 * PATCH /api/v1/products/recent/anonymize
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "anonymizedCount": 12
 *   }
 * }
 */
const anonymizeUserData = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await recentlyViewedService.anonymizeUserData(userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Recently viewed products methods
  getRecentViews,
  clearRecentViews,
  getViewStatistics,
  anonymizeUserData,
};
