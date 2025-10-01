const { Op, Sequelize, fn, col, literal } = require('sequelize');
const db = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Helper function for pagination
const paginate = (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset };
};

// Helper function for pagination response
const createPaginationResponse = (data, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: parseInt(limit),
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Retrieves paginated list of newest products based on their supply creation date.
 * Shows recently added products to the platform for discovery and browsing.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of products per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated new arrivals
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of new arrival products
 * @returns {number} data[].id - Product ID
 * @returns {string} data[].name - Product name
 * @returns {string} data[].slug - Product slug
 * @returns {number} data[].price - Product price
 * @returns {Object} data[].Category - Product category info
 * @returns {Object} data[].vendor - Product vendor info
 * @returns {Array} data[].Supplies - Product supplies (with creation dates)
 * @returns {Object} pagination - Pagination metadata
 * @returns {number} pagination.currentPage - Current page number
 * @returns {number} pagination.totalPages - Total number of pages
 * @returns {number} pagination.totalItems - Total number of products
 * @returns {number} pagination.itemsPerPage - Items per page
 * @returns {boolean} pagination.hasNextPage - Whether next page exists
 * @returns {boolean} pagination.hasPrevPage - Whether previous page exists
 * @api {get} /api/dashboard/new-arrivals Get New Arrivals
 * @public
 * @example
 * // Request
 * GET /api/dashboard/new-arrivals?page=1&limit=10
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "id": 123,
 *       "name": "New Wireless Headphones",
 *       "slug": "new-wireless-headphones",
 *       "price": 129.99,
 *       "Category": {"name": "Electronics", "slug": "electronics"},
 *       "vendor": {"id": 1, "User": {"first_name": "John", "last_name": "Doe"}},
 *       "Supplies": [{"created_at": "2024-09-26T10:00:00.000Z"}]
 *     }
 *   ],
 *   "pagination": {
 *     "currentPage": 1,
 *     "totalPages": 5,
 *     "totalItems": 45,
 *     "itemsPerPage": 10,
 *     "hasNextPage": true,
 *     "hasPrevPage": false
 *   }
 * }
 */
const getNewArrivals = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const { limit: limitNum, offset } = paginate(page, limit);

  const { count, rows: products } = await db.Product.findAndCountAll({
    attributes: [
      'id', 'vendor_id', 'category_id', 'name', 'slug', 'description',
      'thumbnail', 'price', 'discounted_price', 'sku', 'status',
      'impressions', 'sold_units', 'created_at', 'updated_at'
    ],
    include: [
      {
        model: db.Supply,
        as: 'Supplies',
        attributes: ['id', 'created_at'],
        order: [['created_at', 'DESC']]
      },
      {
        model: db.Category,
        attributes: ['id', 'name', 'slug']
      },
      {
        model: db.Vendor,
        as: 'vendor',
        attributes: ['id'],
        include: [{
          model: db.User,
          attributes: ['id', 'first_name', 'last_name']
        }]
      }
    ],
    where: {
      status: 'active'
    },
    order: [
      [{ model: db.Supply, as: 'Supplies' }, 'created_at', 'DESC']
    ],
    limit: limitNum,
    offset,
    distinct: true
  });

  const response = createPaginationResponse(products, page, limit, count);
  res.status(200).json({
    status: 'success',
    ...response
  });
});

/**
 * Retrieves the 12 most recently updated active products for trending display.
 * Shows products that have been recently modified or updated on the platform.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with trending products
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of 12 trending products
 * @returns {number} data[].id - Product ID
 * @returns {string} data[].name - Product name
 * @returns {string} data[].slug - Product slug
 * @returns {number} data[].price - Product price
 * @returns {string} data[].updated_at - Last update timestamp
 * @returns {Object} data[].Category - Product category info
 * @returns {Object} data[].vendor - Product vendor info
 * @api {get} /api/dashboard/trending-now Get Trending Now
 * @public
 * @example
 * // Request
 * GET /api/dashboard/trending-now
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "id": 123,
 *       "name": "Updated Wireless Headphones",
 *       "slug": "updated-wireless-headphones",
 *       "price": 99.99,
 *       "updated_at": "2024-09-26T10:00:00.000Z",
 *       "Category": {"name": "Electronics", "slug": "electronics"},
 *       "vendor": {"id": 1, "User": {"first_name": "John", "last_name": "Doe"}}
 *     }
 *   ]
 * }
 */
const getTrendingNow = catchAsync(async (req, res, next) => {
  const products = await db.Product.findAll({
    attributes: [
      'id', 'vendor_id', 'category_id', 'name', 'slug', 'description',
      'thumbnail', 'price', 'discounted_price', 'sku', 'status',
      'impressions', 'sold_units', 'created_at', 'updated_at'
    ],
    include: [
      {
        model: db.Category,
        attributes: ['id', 'name', 'slug']
      },
      {
        model: db.Vendor,
        as: 'vendor',
        attributes: ['id'],
        include: [{
          model: db.User,
          attributes: ['id', 'first_name', 'last_name']
        }]
      }
    ],
    where: {
      status: 'active'
    },
    order: [['updated_at', 'DESC']],
    limit: 12
  });

  res.status(200).json({
    status: 'success',
    data: products
  });
});

/**
 * Retrieves paginated list of most recent journal entries for content discovery.
 * Shows recently updated or published journal content with associated products.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Number of journal entries per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with latest journal entries
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of journal entries
 * @returns {number} data[].id - Journal entry ID
 * @returns {string} data[].title - Journal title
 * @returns {string} data[].content - Journal content
 * @returns {string} data[].updated_at - Last update timestamp
 * @returns {Object} data[].product - Associated product information
 * @returns {number} data[].product.id - Product ID
 * @returns {string} data[].product.name - Product name
 * @returns {string} data[].product.slug - Product slug
 * @returns {string} data[].product.thumbnail - Product thumbnail
 * @returns {Object} data[].product.Category - Product category
 * @returns {Object} pagination - Pagination metadata
 * @returns {number} pagination.currentPage - Current page number
 * @returns {number} pagination.totalPages - Total number of pages
 * @returns {number} pagination.totalItems - Total number of journal entries
 * @returns {number} pagination.itemsPerPage - Items per page
 * @returns {boolean} pagination.hasNextPage - Whether next page exists
 * @returns {boolean} pagination.hasPrevPage - Whether previous page exists
 * @api {get} /api/dashboard/latest-journal Get Latest Journal
 * @public
 * @example
 * // Request
 * GET /api/dashboard/latest-journal?page=1&limit=12
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "id": 456,
 *       "title": "New Product Launch",
 *       "content": "Exciting new features...",
 *       "updated_at": "2024-09-26T10:00:00.000Z",
 *       "product": {
 *         "id": 123,
 *         "name": "Wireless Headphones",
 *         "slug": "wireless-headphones",
 *         "thumbnail": "https://example.com/thumbnail.jpg",
 *         "Category": {"name": "Electronics"}
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "currentPage": 1,
 *     "totalPages": 3,
 *     "totalItems": 32,
 *     "itemsPerPage": 12,
 *     "hasNextPage": true,
 *     "hasPrevPage": false
 *   }
 * }
 */
const getLatestJournal = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 12 } = req.query;
  const { limit: limitNum, offset } = paginate(page, limit);

  const { count, rows: journals } = await db.Journal.findAndCountAll({
    include: [
      {
        model: db.Product,
        as: 'product',
        attributes: ['id', 'name', 'slug', 'thumbnail'],
        include: [{
          model: db.Category,
          attributes: ['name']
        }]
      }
    ],
    order: [['updated_at', 'DESC']],
    limit: limitNum,
    offset
  });

  const response = createPaginationResponse(journals, page, limit, count);
  res.status(200).json({
    status: 'success',
    ...response
  });
});

/**
 * Retrieves comprehensive dashboard metrics for an approved vendor.
 * Provides key performance indicators including live products count, sales data, and analytics.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor dashboard metrics
 * @returns {boolean} status - Success status
 * @returns {Object} data - Dashboard metrics data
 * @returns {number} data.liveProducts - Number of active products
 * @returns {string} data.totalSales - Total sales amount (formatted to 2 decimal places)
 * @returns {number} data.monthlyUnitsSold - Units sold in current month
 * @returns {number} data.totalViews - Total product views across all products
 * @throws {AppError} 404 - When vendor not found or not approved
 * @api {get} /api/dashboard/vendor Get Vendor Dashboard
 * @private vendor
 * @example
 * // Request
 * GET /api/dashboard/vendor
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "liveProducts": 25,
 *     "totalSales": "15450.75",
 *     "monthlyUnitsSold": 45,
 *     "totalViews": 1250
 *   }
 * }
 */
const getVendorDashboard = catchAsync(async (req, res, next) => {
  // Get vendor information for the authenticated user
  const vendor = await db.Vendor.findOne({
    where: {
      user_id: req.user.id,
      status: 'approved' // Only get approved vendors
    }
  });

  if (!vendor) {
    return next(new AppError('Vendor not found or not approved', 404));
  }

  const vendorId = vendor.id;

  // Live Products Count
  const liveProductsCount = await db.Product.count({
    where: {
      vendor_id: vendorId,
      status: 'active'
    }
  });

  // Total Sales
  const totalSales = await db.OrderItem.sum('sub_total', {
    where: { vendor_id: vendorId },
    include: [{
      model: db.Order,
      as: 'order',
      where: { payment_status: 'paid' }
    }]
  }) || 0;

  // Units Sold Monthly
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const monthlyUnitsSold = await db.OrderItem.sum('quantity', {
    where: {
      vendor_id: vendorId,
      created_at: {
        [Op.gte]: currentMonth,
        [Op.lt]: nextMonth
      }
    },
    include: [{
      model: db.Order,
      as: 'order',
      where: { payment_status: 'paid' }
    }]
  }) || 0;

  // Product Views
  const totalViews = await db.Product.sum('viewers', {
    where: { vendor_id: vendorId }
  }) || 0;

  res.status(200).json({
    status: 'success',
    data: {
      liveProducts: liveProductsCount,
      totalSales: parseFloat(totalSales).toFixed(2),
      monthlyUnitsSold,
      totalViews
    }
  });
});

/**
 * Retrieves paginated list of products owned by the authenticated vendor.
 * Provides detailed product information for vendor product management.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of products per page
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor's products
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of vendor products
 * @returns {number} data[].id - Product ID
 * @returns {string} data[].name - Product name
 * @returns {number} data[].price - Product price
 * @returns {number} data[].discounted_price - Discounted price (if applicable)
 * @returns {string} data[].status - Product status
 * @returns {number} data[].viewers - Number of product views
 * @returns {number} data[].sold_units - Number of units sold
 * @returns {string} data[].thumbnail - Product thumbnail URL
 * @returns {string} data[].slug - Product slug
 * @returns {string} data[].description - Product description
 * @returns {Object} data[].Category - Product category info
 * @returns {Object} pagination - Pagination metadata
 * @returns {number} pagination.currentPage - Current page number
 * @returns {number} pagination.totalPages - Total number of pages
 * @returns {number} pagination.totalItems - Total number of products
 * @returns {number} pagination.itemsPerPage - Items per page
 * @returns {boolean} pagination.hasNextPage - Whether next page exists
 * @returns {boolean} pagination.hasPrevPage - Whether previous page exists
 * @throws {AppError} 404 - When vendor not found or not approved
 * @api {get} /api/dashboard/vendor/products Get Vendor Products
 * @private vendor
 * @example
 * // Request
 * GET /api/dashboard/vendor/products?page=1&limit=20
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "id": 123,
 *       "name": "Wireless Headphones",
 *       "price": 99.99,
 *       "discounted_price": 89.99,
 *       "status": "active",
 *       "viewers": 150,
 *       "sold_units": 25,
 *       "thumbnail": "https://example.com/thumbnail.jpg",
 *       "slug": "wireless-headphones",
 *       "description": "High-quality wireless headphones",
 *       "Category": {"name": "Electronics", "slug": "electronics"}
 *     }
 *   ],
 *   "pagination": {
 *     "currentPage": 1,
 *     "totalPages": 2,
 *     "totalItems": 25,
 *     "itemsPerPage": 20,
 *     "hasNextPage": true,
 *     "hasPrevPage": false
 *   }
 * }
 */
const getVendorProducts = catchAsync(async (req, res, next) => {
  // Get vendor information for the authenticated user
  const vendor = await db.Vendor.findOne({
    where: {
      user_id: req.user.id,
      status: 'approved' // Only get approved vendors
    }
  });

  if (!vendor) {
    return next(new AppError('Vendor not found or not approved', 404));
  }

  const vendorId = vendor.id;
  const { page = 1, limit = 20 } = req.query;
  const { limit: limitNum, offset } = paginate(page, limit);

  const { count, rows: products } = await db.Product.findAndCountAll({
    where: { vendor_id: vendorId },
    include: [
      {
        model: db.Category,
        attributes: ['id', 'name', 'slug']
      }
    ],
    attributes: [
      'id', 'vendor_id', 'category_id', 'name', 'slug', 'description',
      'thumbnail', 'price', 'discounted_price', 'sku', 'status',
      'viewers', 'sold_units', 'created_at', 'updated_at'
    ],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset
  });

  const response = createPaginationResponse(products, page, limit, count);
  res.status(200).json({
    status: 'success',
    ...response
  });
});

/**
 * Retrieves comprehensive earnings data for an approved vendor.
 * Includes total earnings, monthly performance metrics, and payout information.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor earnings data
 * @returns {boolean} status - Success status
 * @returns {Object} data - Earnings metrics data
 * @returns {string} data.totalEarnings - Total earnings from all time (formatted to 2 decimal places)
 * @returns {string} data.monthlySales - Sales amount for current month (formatted to 2 decimal places)
 * @returns {number} data.monthlyPayouts - Number of completed payouts this month
 * @returns {number} data.monthlyProductsSold - Number of products sold this month
 * @throws {AppError} 404 - When vendor not found or not approved
 * @api {get} /api/dashboard/vendor/earnings Get Vendor Earnings
 * @private vendor
 * @example
 * // Request
 * GET /api/dashboard/vendor/earnings
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "totalEarnings": "15450.75",
 *     "monthlySales": "2350.50",
 *     "monthlyPayouts": 2,
 *     "monthlyProductsSold": 45
 *   }
 * }
 */
const getVendorEarnings = catchAsync(async (req, res, next) => {
  // Get vendor information for the authenticated user
  const vendor = await db.Vendor.findOne({
    where: {
      user_id: req.user.id,
      status: 'approved' // Only get approved vendors
    }
  });

  if (!vendor) {
    return next(new AppError('Vendor not found or not approved', 404));
  }

  const vendorId = vendor.id;

  // Total Earnings
  const totalEarnings = await db.OrderItem.sum('sub_total', {
    where: { vendor_id: vendorId },
    include: [{
      model: db.Order,
      as: 'order',
      where: { payment_status: 'paid' }
    }]
  }) || 0;

  // Monthly Sales
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const monthlySales = await db.OrderItem.sum('sub_total', {
    where: {
      vendor_id: vendorId,
      created_at: {
        [Op.gte]: currentMonth,
        [Op.lt]: nextMonth
      }
    },
    include: [{
      model: db.Order,
      as: 'order',
      where: { payment_status: 'paid' }
    }]
  }) || 0;

  // Completed Payouts Monthly
  const monthlyPayouts = await db.Payout.count({
    where: {
      vendor_id: vendorId,
      status: 'paid',
      payout_date: {
        [Op.gte]: currentMonth,
        [Op.lt]: nextMonth
      }
    }
  });

  // Products Sold Monthly
  const monthlyProductsSold = await db.OrderItem.sum('quantity', {
    where: {
      vendor_id: vendorId,
      created_at: {
        [Op.gte]: currentMonth,
        [Op.lt]: nextMonth
      }
    },
    include: [{
      model: db.Order,
      as: 'order',
      where: { payment_status: 'paid' }
    }]
  }) || 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalEarnings: parseFloat(totalEarnings).toFixed(2),
      monthlySales: parseFloat(monthlySales).toFixed(2),
      monthlyPayouts,
      monthlyProductsSold
    }
  });
});

/**
 * Retrieves detailed breakdown of vendor earnings with pagination.
 * Shows individual sales transactions with product details and payout information.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of earnings records per page
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with detailed earnings breakdown
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of earnings breakdown records
 * @returns {string} data[].date - Transaction date
 * @returns {string} data[].product - Product name
 * @returns {number} data[].orderId - Associated order ID
 * @returns {string} data[].earnings - Earnings amount (formatted to 2 decimal places)
 * @returns {number} data[].units - Number of units sold
 * @returns {string|null} data[].payoutDate - Date when payout was processed (null if not paid)
 * @returns {Object} pagination - Pagination metadata
 * @returns {number} pagination.currentPage - Current page number
 * @returns {number} pagination.totalPages - Total number of pages
 * @returns {number} pagination.totalItems - Total number of earnings records
 * @returns {number} pagination.itemsPerPage - Items per page
 * @returns {boolean} pagination.hasNextPage - Whether next page exists
 * @returns {boolean} pagination.hasPrevPage - Whether previous page exists
 * @throws {AppError} 404 - When vendor not found or not approved
 * @api {get} /api/dashboard/vendor/earnings-breakdown Get Vendor Earnings Breakdown
 * @private vendor
 * @example
 * // Request
 * GET /api/dashboard/vendor/earnings-breakdown?page=1&limit=20
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "date": "2024-09-26T10:30:00.000Z",
 *       "product": "Wireless Headphones",
 *       "orderId": 12345,
 *       "earnings": "99.99",
 *       "units": 1,
 *       "payoutDate": "2024-09-30T00:00:00.000Z"
 *     },
 *     {
 *       "date": "2024-09-25T14:20:00.000Z",
 *       "product": "Bluetooth Speaker",
 *       "orderId": 12344,
 *       "earnings": "59.99",
 *       "units": 1,
 *       "payoutDate": null
 *     }
 *   ],
 *   "pagination": {
 *     "currentPage": 1,
 *     "totalPages": 3,
 *     "totalItems": 45,
 *     "itemsPerPage": 20,
 *     "hasNextPage": true,
 *     "hasPrevPage": false
 *   }
 * }
 */
const getVendorEarningsBreakdown = catchAsync(async (req, res, next) => {
  // Get vendor information for the authenticated user
  const vendor = await db.Vendor.findOne({
    where: {
      user_id: req.user.id,
      status: 'approved' // Only get approved vendors
    }
  });

  if (!vendor) {
    return next(new AppError('Vendor not found or not approved', 404));
  }

  const vendorId = vendor.id;
  const { page = 1, limit = 20 } = req.query;
  const { limit: limitNum, offset } = paginate(page, limit);

  const { count, rows: earnings } = await db.OrderItem.findAndCountAll({
    where: { vendor_id: vendorId },
    include: [
      {
        model: db.Order,
        as: 'order',
        where: { payment_status: 'paid' },
        attributes: ['id', 'order_date', 'total_amount', 'payment_status', 'status']
      },
      {
        model: db.Product,
        attributes: ['id', 'name', 'price', 'thumbnail']
      }
    ],
    attributes: [
      'id', 'order_id', 'product_id', 'vendor_id', 'quantity', 
      'price', 'sub_total', 'created_at', 'updated_at'
    ],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset
  });

  // Get payout dates for each earning
  const earningsWithPayouts = await Promise.all(
    earnings.map(async (earning) => {
      const payout = await db.Payout.findOne({
        where: {
          vendor_id: vendorId,
          created_at: {
            [Op.lte]: earning.created_at
          }
        },
        order: [['created_at', 'DESC']]
      });

      return {
        date: earning.created_at,
        product: earning.Product.name,
        orderId: earning.Order.id,
        earnings: parseFloat(earning.sub_total).toFixed(2),
        units: earning.quantity,
        payoutDate: payout ? payout.payout_date : null
      };
    })
  );

  const response = createPaginationResponse(earningsWithPayouts, page, limit, count);
  res.status(200).json({
    status: 'success',
    ...response
  });
});

/**
 * Retrieves comprehensive dashboard metrics for administrative oversight.
 * Provides platform-wide statistics including vendor counts, financial metrics, and operational data.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with admin dashboard metrics
 * @returns {boolean} status - Success status
 * @returns {Object} data - Dashboard metrics data
 * @returns {number} data.totalVendors - Total number of approved vendors
 * @returns {string} data.monthlyIncome - Platform income for current month (formatted to 2 decimal places)
 * @returns {number} data.totalProducts - Total number of products on platform
 * @returns {string} data.monthlySales - Total sales amount for current month (formatted to 2 decimal places)
 * @returns {number} data.pendingOrders - Number of orders with pending status
 * @api {get} /api/dashboard/admin Get Admin Dashboard
 * @private admin
 * @example
 * // Request
 * GET /api/dashboard/admin
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "totalVendors": 25,
 *     "monthlyIncome": "15450.75",
 *     "totalProducts": 150,
 *     "monthlySales": "125000.50",
 *     "pendingOrders": 12
 *   }
 * }
 */
const getAdminDashboard = catchAsync(async (req, res, next) => {
  // Total Vendors
  const totalVendors = await db.Vendor.count({
    where: { status: 'approved' }
  });

  // Platform Income Monthly
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const monthlyIncome = await db.PaymentTransaction.sum('amount', {
    where: {
      type: 'commission',
      status: 'completed',
      created_at: {
        [Op.gte]: currentMonth,
        [Op.lt]: nextMonth
      }
    }
  }) || 0;

  // Total Products
  const totalProducts = await db.Product.count();

  // Total Sales Monthly
  const monthlySales = await db.Order.sum('total_amount', {
    where: {
      payment_status: 'paid',
      created_at: {
        [Op.gte]: currentMonth,
        [Op.lt]: nextMonth
      }
    }
  }) || 0;

  // Pending Orders
  const pendingOrders = await db.Order.count({
    where: { order_status: 'pending' }
  });

  res.status(200).json({
    status: 'success',
    data: {
      totalVendors,
      monthlyIncome: parseFloat(monthlyIncome).toFixed(2),
      totalProducts,
      monthlySales: parseFloat(monthlySales).toFixed(2),
      pendingOrders
    }
  });
});

/**
 * Retrieves monthly sales statistics for the current year.
 * Provides aggregated sales data grouped by month for trend analysis.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with monthly sales statistics
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of monthly sales data
 * @returns {number} data[].month - Month number (1-12)
 * @returns {number|null} data[].total_sales - Total sales amount for the month
 * @returns {number|null} data[].order_count - Number of orders for the month
 * @api {get} /api/dashboard/admin/sales-stats Get Admin Sales Statistics
 * @private admin
 * @example
 * // Request
 * GET /api/dashboard/admin/sales-stats
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "month": 1,
 *       "total_sales": 45000,
 *       "order_count": 150
 *     },
 *     {
 *       "month": 2,
 *       "total_sales": 52000,
 *       "order_count": 175
 *     },
 *     {
 *       "month": 9,
 *       "total_sales": 125000,
 *       "order_count": 380
 *     }
 *   ]
 * }
 */
const getAdminSalesStats = catchAsync(async (req, res, next) => {
  const currentYear = new Date().getFullYear();

  const salesStats = await db.Order.findAll({
    attributes: [
      [fn('MONTH', col('created_at')), 'month'],
      [fn('YEAR', col('created_at')), 'year'],
      [fn('SUM', col('total_amount')), 'total_sales'],
      [fn('COUNT', col('id')), 'order_count'],
      [fn('SUM', col('total_products')), 'total_products_sold']
    ],
    where: {
      payment_status: 'paid',
      status: 'completed',
      created_at: {
        [Op.gte]: new Date(currentYear, 0, 1),
        [Op.lt]: new Date(currentYear + 1, 0, 1)
      }
    },
    group: [fn('YEAR', col('created_at')), fn('MONTH', col('created_at'))],
    order: [
      [fn('YEAR', col('created_at')), 'ASC'],
      [fn('MONTH', col('created_at')), 'ASC']
    ],
    raw: true
  });

  res.status(200).json({
    status: 'success',
    data: salesStats
  });
});

/**
 * Retrieves top performing categories based on product sales in the current month.
 * Shows category performance metrics including product count and total units sold.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with top categories data
 * @returns {boolean} status - Success status
 * @returns {Array} data - Array of top 10 categories (ordered by total units sold)
 * @returns {number} data[].id - Category ID
 * @returns {string} data[].name - Category name
 * @returns {string} data[].slug - Category slug
 * @returns {number|null} data[].product_count - Number of products in category this month
 * @returns {number|null} data[].total_sold - Total units sold in category this month
 * @api {get} /api/dashboard/admin/top-categories Get Admin Top Categories
 * @private admin
 * @example
 * // Request
 * GET /api/dashboard/admin/top-categories
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Electronics",
 *       "slug": "electronics",
 *       "product_count": 25,
 *       "total_sold": 450
 *     },
 *     {
 *       "id": 2,
 *       "name": "Fashion",
 *       "slug": "fashion",
 *       "product_count": 18,
 *       "total_sold": 320
 *     },
 *     {
 *       "id": 3,
 *       "name": "Home & Garden",
 *       "slug": "home-garden",
 *       "product_count": 12,
 *       "total_sold": 280
 *     }
 *   ]
 * }
 */
const getAdminTopCategories = catchAsync(async (req, res, next) => {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const topCategories = await db.Category.findAll({
    attributes: [
      'id', 'name', 'slug', 'description', 'image',
      [fn('COUNT', col('products.id')), 'product_count'],
      [fn('SUM', col('products.sold_units')), 'total_sold'],
      [fn('SUM', col('products.price') * col('products.sold_units')), 'total_revenue']
    ],
    include: [{
      model: db.Product,
      as: 'products',
      attributes: [],
      where: {
        status: 'active',
        created_at: {
          [Op.gte]: currentMonth,
          [Op.lt]: nextMonth
        }
      },
      required: false
    }],
    group: ['Category.id', 'Category.name', 'Category.slug', 'Category.description', 'Category.image'],
    order: [[fn('SUM', col('products.sold_units')), 'DESC']],
    limit: 10,
    subQuery: false
  });

  res.status(200).json({
    status: 'success',
    data: topCategories
  });
});

module.exports = {
  getNewArrivals,
  getTrendingNow,
  getLatestJournal,
  getVendorDashboard,
  getVendorProducts,
  getVendorEarnings,
  getVendorEarningsBreakdown,
  getAdminDashboard,
  getAdminSalesStats,
  getAdminTopCategories
};
