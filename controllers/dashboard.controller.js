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

// 1. New Arrivals - Products sorted by supply creation date
const getNewArrivals = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const { limit: limitNum, offset } = paginate(page, limit);

  const { count, rows: products } = await db.Product.findAndCountAll({
    include: [
      {
        model: db.Supply,
        as: 'Supplies',
        attributes: ['created_at'],
        order: [['created_at', 'DESC']]
      },
      {
        model: db.Category,
        attributes: ['name', 'slug']
      },
      {
        model: db.Vendor,
        as: 'vendor',
        attributes: ['id'],
        include: [{
          model: db.User,
          attributes: ['first_name', 'last_name']
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

// 2. Trending Now - 12 most recently updated products
const getTrendingNow = catchAsync(async (req, res, next) => {
  const products = await db.Product.findAll({
    include: [
      {
        model: db.Category,
        attributes: ['name', 'slug']
      },
      {
        model: db.Vendor,
        as: 'vendor',
        attributes: ['id'],
        include: [{
          model: db.User,
          attributes: ['first_name', 'last_name']
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

// 3. Latest Journal - Recent journal entries by updated_at
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

// 4. Vendor Dashboard Data
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

// 5. Vendor Product Details (Paginated)
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
        attributes: ['name', 'slug']
      }
    ],
    attributes: [
      'id', 'name', 'price', 'discounted_price', 'status',
      'viewers', 'sold_units', 'thumbnail', 'slug', 'description'
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

// 6. Vendor Earnings Data
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

// 7. Vendor Earnings Breakdown (Paginated)
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
        attributes: ['id', 'order_date', 'total_amount']
      },
      {
        model: db.Product,
        attributes: ['id', 'name', 'price']
      }
    ],
    attributes: [
      'id', 'quantity', 'price', 'sub_total', 'created_at'
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

// 8. Admin Dashboard Data
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

// 9. Admin Sales Statistics (Monthly)
const getAdminSalesStats = catchAsync(async (req, res, next) => {
  const currentYear = new Date().getFullYear();

  const salesStats = await db.Order.findAll({
    attributes: [
      [fn('MONTH', col('created_at')), 'month'],
      [fn('SUM', col('total_amount')), 'total_sales'],
      [fn('COUNT', col('id')), 'order_count']
    ],
    where: {
      payment_status: 'paid',
      created_at: {
        [Op.gte]: new Date(currentYear, 0, 1),
        [Op.lt]: new Date(currentYear + 1, 0, 1)
      }
    },
    group: [fn('MONTH', col('created_at'))],
    order: [[fn('MONTH', col('created_at')), 'ASC']],
    raw: true
  });

  res.status(200).json({
    status: 'success',
    data: salesStats
  });
});

// 10. Admin Top Categories (Monthly)
const getAdminTopCategories = catchAsync(async (req, res, next) => {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const topCategories = await db.Category.findAll({
    attributes: [
      'id', 'name', 'slug',
      [fn('COUNT', col('products.id')), 'product_count'],
      [fn('SUM', col('products.sold_units')), 'total_sold']
    ],
    include: [{
      model: db.Product,
      attributes: [],
      where: {
        created_at: {
          [Op.gte]: currentMonth,
          [Op.lt]: nextMonth
        }
      },
      required: false
    }],
    group: ['Category.id'],
    order: [[fn('SUM', col('products.sold_units')), 'DESC']],
    limit: 10,
    raw: true
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
