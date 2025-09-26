const {
  Inventory,
  InventoryHistory,
  Product,
  Supply,
  Store,
  Vendor,
  sequelize,
} = require("../models");
const AppError = require("../utils/appError");
const { Op } = require("sequelize");

/**
 * Get inventory details for a specific product (vendor only)
 * Returns current stock levels, supply information, and product details.
 * Vendor can only access inventory for their own products.
 *
 * @param {import('express').Request} req - Express request object (vendor authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.productId - Product ID to get inventory for
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with inventory details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data.inventory - Inventory object with stock and supply info
 * @throws {AppError} 404 - Vendor or product not found, or access denied
 * @throws {Error} 500 - Server error during inventory retrieval
 * @api {get} /api/v1/inventory/product/:productId Get product inventory
 * @private Requires vendor authentication
 * @example
 * GET /api/v1/inventory/product/123
 * Authorization: Bearer <vendor_jwt_token>
 */
const getProductInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
    });

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const vendorId = vendor.get("id");
    // Verify product belongs to the vendor
    const product = await Product.findOne({
      where: { id: productId, vendor_id: vendorId },
    });

    if (!product) {
      return next(new AppError("Product not found or access denied", 404));
    }

    const inventory = await Inventory.findOne({
      where: { product_id: productId },
      include: [
        {
          model: Supply,
          attributes: ["id", "quantity_supplied", "supply_date"],
        },
        {
          model: Product,
          attributes: ["id", "name", "sku"],
          include: [{
            model: Vendor,
            attributes: ["id"],
            include: [{
              model: Store,
              attributes: ["id", "business_name"]
            }]
          }]
        }
      ],
    });

    res.status(200).json({
      status: "success",
      data: {
        inventory: inventory || { product_id: productId, stock: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update inventory stock level
 * @route   PATCH /api/v1/inventory/product/:productId
 * @access  Private/Vendor
 */
const updateProductInventory = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { productId } = req.params;
    const { adjustment, note } = req.body;
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
    });

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const vendorId = vendor.get("id");

    // Verify product belongs to the vendor
    const product = await Product.findOne({
      where: { id: productId, vendor_id: vendorId },
      transaction,
    });

    if (!product) {
      await transaction.rollback();
      return next(new AppError("Product not found or access denied", 404));
    }

    // Find or create inventory record
    const [inventory] = await Inventory.findOrCreate({
      where: { product_id: productId },
      defaults: { stock: 0 },
      transaction,
    });

    // Calculate new stock level
    const newStock = inventory.stock + adjustment;

    if (newStock < 0) {
      await transaction.rollback();
      return next(new AppError("Insufficient stock for this adjustment", 400));
    }

    let supplyId = null;
    
    // If we're increasing stock, create a supply record
    if (adjustment > 0) {
      const supply = await Supply.create({
        vendor_id: vendorId,
        product_id: productId,
        quantity_supplied: adjustment,
        supply_date: new Date()
      }, { transaction });
      supplyId = supply.id;
    }

    // Update inventory with the new stock level
    await inventory.update(
      {
        stock: newStock,
        ...(adjustment > 0 && { 
          restocked_at: new Date(),
          supply_id: supplyId 
        })
      },
      { transaction }
    );

    // Log the inventory adjustment
    await InventoryHistory.create(
      {
        inventory_id: inventory.id,
        adjustment,
        previous_stock: inventory.stock,
        new_stock: newStock,
        note: note || (adjustment > 0 ? "Manual restock" : "Manual adjustment"),
        adjusted_by: vendorId,
        supply_id: supplyId
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      status: "success",
      data: {
        inventory,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * @desc    Get low stock items
 * @route   GET /api/v1/inventory/low-stock
 * @access  Private/Vendor
 */
const getLowStockItems = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
    });

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const vendorId = vendor.get("id");
    const threshold = req.query.threshold || 10; // Default threshold of 10 items

    const lowStockItems = await Inventory.findAll({
      include: [
        {
          model: Product,
          where: {
            vendor_id: vendorId,
            is_active: true,
          },
          attributes: ["id", "name", "sku"],
          required: true,
        },
      ],
      where: {
        stock: {
          [Op.lte]: threshold,
        },
      },
      order: [["stock", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      results: lowStockItems.length,
      data: {
        items: lowStockItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory history for a product
 * @route   GET /api/v1/inventory/history/:productId
 * @access  Private/Vendor
 */
const getInventoryHistory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
    });

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const vendorId = vendor.get("id");

    // Verify product belongs to the vendor
    const product = await Product.findOne({
      where: { id: productId, vendor_id: vendorId },
    });

    if (!product) {
      return next(new AppError("Product not found or access denied", 404));
    }

    const inventory = await Inventory.findOne({
      where: { product_id: productId },
    });

    if (!inventory) {
      return res.status(200).json({
        status: "success",
        data: { history: [] },
      });
    }

    const history = await InventoryHistory.findAll({
      where: { inventory_id: inventory.id },
      order: [["created_at", "DESC"]],
      limit: 50, // Last 50 adjustments
    });

    res.status(200).json({
      status: "success",
      data: {
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all inventory across all vendors (Admin only)
 * @route   GET /api/v1/inventory/admin/all
 * @access  Private/Admin
 */
const getAllInventory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: inventory } = await Inventory.findAndCountAll({
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'sku'],
          include: [{
            model: Vendor,
            attributes: ['id'],
            include: [{
              model: Store,
              attributes: ['id', 'business_name']
            }]
          }]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['updated_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        inventory
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory for a specific vendor (Admin only)
 * @route   GET /api/v1/inventory/admin/vendor/:vendorId
 * @access  Private/Admin
 */
const getVendorInventory = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: inventory } = await Inventory.findAndCountAll({
      include: [
        {
          model: Product,
          where: { vendor_id: vendorId },
          attributes: ['id', 'name', 'sku'],
          required: true
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['updated_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        inventory
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low stock items across all vendors (Admin only)
 * @route   GET /api/v1/inventory/admin/low-stock
 * @access  Private/Admin
 */
const getGlobalLowStockItems = async (req, res, next) => {
  try {
    const threshold = req.query.threshold || 10;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: lowStockItems } = await Inventory.findAndCountAll({
      where: {
        stock: {
          [Op.lte]: threshold
        }
      },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'sku', 'price'],
          include: [{
            model: Vendor,
            attributes: ['id'],
            include: [{
              model: Store,
              attributes: ['business_name']
            }]
          }]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['stock', 'ASC']]
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        lowStockItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory history across all products (Admin only)
 * @route   GET /api/v1/inventory/admin/history
 * @access  Private/Admin
 */
const getInventoryHistoryAdmin = async (req, res, next) => {
  try {
    const { productId, vendorId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (productId) where.inventory_id = productId;
    if (vendorId) where['$Inventory.Product.vendor_id$'] = vendorId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const { count, rows: history } = await InventoryHistory.findAndCountAll({
      where,
      include: [
        {
          model: Inventory,
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'sku'],
              include: [{
                model: Vendor,
                attributes: ['id'],
                include: [{
                  model: Store,
                  attributes: ['business_name']
                }]
              }]
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProductInventory,
  updateProductInventory,
  getLowStockItems,
  getInventoryHistory,
  // Admin methods
  getAllInventory,
  getVendorInventory,
  getGlobalLowStockItems,
  getInventoryHistoryAdmin,
};
