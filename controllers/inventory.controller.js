const {
  Inventory,
  InventoryHistory,
  Product,
  Supply,
  Store,
  Vendor,
  VariantCombination,
  ProductVariant,
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

    const combinations = await VariantCombination.findAll({
      where: { product_id: product.id },
      attributes: [
        "id",
        "combination_name",
        "sku_suffix",
        "stock",
        "price_modifier",
        "is_active",
      ],
      include: [
        {
          model: ProductVariant,
          as: "variants",
          attributes: ["id", "name", "value"],
          through: { attributes: [] },
        },
      ],
      order: [["combination_name", "ASC"]],
    });

    // Calculate total stock for the product from its combinations
    const totalProductStock = combinations.reduce(
      (sum, combo) => sum + combo.stock,
      0
    );

    // Get the basic inventory record (for restock date, not stock quantity)
    const inventoryLog = await Inventory.findOne({
      where: { product_id: product.id },
      attributes: ["restocked_at", "updated_at"],
    });

    res.status(200).json({
      status: "success",
      data: {
        product_id: product.id,
        product_name: product.name,
        total_stock: totalProductStock,
        last_restocked_at: inventoryLog ? inventoryLog.restocked_at : null,
        updated_at: inventoryLog ? inventoryLog.updated_at : null,
        combinations_count: combinations.length,
        combinations: combinations,
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
    const { combinationId, adjustment, note } = req.body; // Expect combinationId now
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
      transaction,
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError("Vendor not found", 404));
    }
    const vendorId = vendor.get("id");

    const product = await Product.findOne({
      where: { id: productId, vendor_id: vendorId },
      transaction,
    });
    if (!product) {
      await transaction.rollback();
      return next(new AppError("Product not found or access denied", 404));
    }

    if (!combinationId) {
      await transaction.rollback();
      return next(
        new AppError(
          "combinationId is required to update stock for a product with variants.",
          400
        )
      );
    }

    const combination = await VariantCombination.findByPk(combinationId, {
      transaction,
    });
    if (!combination || combination.product_id !== product.id) {
      await transaction.rollback();
      return next(
        new AppError("Variant combination not found for this product", 404)
      );
    }

    const previousStock = combination.stock;
    const newStock = previousStock + adjustment;

    if (newStock < 0) {
      await transaction.rollback();
      return next(new AppError("Insufficient stock for this adjustment", 400));
    }

    // Update combination stock (single source of truth)
    await combination.update({ stock: newStock }, { transaction });

    let supplyId = null;
    if (adjustment > 0) {
      const supply = await Supply.create(
        {
          vendor_id: vendorId,
          product_id: productId,
          combination_id: combinationId,
          quantity_supplied: adjustment,
          supply_date: new Date(),
          created_at: new Date(),
        },
        { transaction }
      );
      supplyId = supply.id;
    }

    // Find or create the product-level Inventory record (now just a log/status holder)
    const [inventoryLog, created] = await Inventory.findOrCreate({
      where: { product_id: productId },
      defaults: {
        supply_id: supplyId,
        restocked_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      transaction,
    });

    if (!created) {
      await inventoryLog.update(
        {
          supply_id: supplyId,
          restocked_at: new Date(),
          updated_at: new Date(),
        },
        { transaction }
      );
    }

    // Log the inventory adjustment in history, referencing the combination and product inventory log
    await InventoryHistory.create(
      {
        inventory_id: inventoryLog.id,
        combination_id: combinationId,
        change_amount: adjustment,
        change_type: adjustment > 0 ? "supply" : "manual_adjustment",
        previous_stock: previousStock,
        new_stock: newStock,
        note: note || (adjustment > 0 ? "Manual restock" : "Manual adjustment"),
        adjusted_by: req.user.id, // User performing the adjustment
        supply_id: supplyId,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      status: "success",
      data: {
        combination_id: combination.id,
        product_id: product.id,
        combination_name: combination.combination_name,
        new_stock: newStock,
        message: "Inventory updated successfully.",
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

    const lowStockItems = await VariantCombination.findAll({
      attributes: [
        "id",
        "combination_name",
        "sku_suffix",
        "stock",
        [sequelize.literal("`Product`.`id`"), "product_id"],
        [sequelize.literal("`Product`.`name`"), "product_name"],
        [sequelize.literal("`Product`.`sku`"), "product_sku"],
      ],
      include: [
        {
          model: Product,
          attributes: [], // Only select attributes from VariantCombination directly
          where: {
            vendor_id: vendorId,
            status: "active",
          },
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
const getProductInventoryHistory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const numericProductId = parseInt(productId, 10); // Convert string to number
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
    });

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const vendorId = vendor.get("id");

    // Verify product belongs to the vendor
    const product = await Product.findOne({
      where: { id: numericProductId, vendor_id: vendorId },
    });

    if (!product) {
      return next(new AppError("Product not found or access denied", 404));
    }

    // InventoryHistory is now linked to product_id through Inventory, but also stores combination_id
    const history = await InventoryHistory.findAll({
      attributes: [
        "id",
        "change_amount",
        "change_type",
        "previous_stock",
        "new_stock",
        "note",
        "adjusted_by",
        "changed_at",
        "created_at",
        "combination_id",
      ],
      include: [
        {
          model: Inventory,
          attributes: ["id", "product_id"],
          where: { product_id: numericProductId },
          required: true, // Ensure only history for this product's inventory is fetched
        },
        {
          model: VariantCombination,
          as: "combination",
          attributes: ["combination_name", "sku_suffix"],
          required: false, // Not all history might be tied to a combination (e.g., initial product-level if it existed)
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 50, // Last 50 adjustments
    });

    // Format history to include product/combination details directly
    const formattedHistory = history.map((record) => ({
      id: record.id,
      combination_id: record.combination_id,
      combination_name: record.combination
        ? record.combination.combination_name
        : "N/A",
      change_amount: record.change_amount,
      change_type: record.change_type,
      previous_stock: record.previous_stock,
      new_stock: record.new_stock,
      note: record.note,
      adjusted_by: record.adjusted_by,
      changed_at: record.changed_at,
      created_at: record.created_at,
    }));

    res.status(200).json({
      status: "success",
      data: {
        history: formattedHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all inventory across all vendors (Admin only)
 * @route   GET /api/v1/admin/inventory/all
 * @access  Private/Admin
 */
const getAllInventory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: combinations } =
      await VariantCombination.findAndCountAll({
        attributes: [
          "id",
          "combination_name",
          "sku_suffix",
          "stock",
          "price_modifier",
          "is_active",
        ],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "sku"],
            include: [
              {
                model: Vendor,
                as: "vendor",
                attributes: ["id"],
                include: [
                  {
                    model: Store,
                    as: "store",
                    attributes: ["id", "business_name"],
                  },
                ],
              },
            ],
            required: true, // Only show combinations linked to existing products
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        subQuery: false, // Prevent subquery to avoid join issues with includes
        order: [[{ model: Product, as: "product" }, "updated_at", "DESC"]], // Order by product update time
      });
    res.status(200).json({
      status: "success",
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        inventory: combinations.map((combo) => ({
          // Rename to inventory for consistency in API response
          combination_id: combo.id,
          combination_name: combo.combination_name,
          sku_suffix: combo.sku_suffix,
          stock: combo.stock,
          price_modifier: combo.price_modifier,
          is_active: combo.is_active,
          product: combo.product
            ? {
                id: combo.product.id,
                name: combo.product.name,
                sku: combo.product.sku,
                vendor: combo.product.vendor
                  ? {
                      id: combo.product.vendor.id,
                      store_name: combo.product.vendor.store
                        ? combo.product.vendor.store.business_name
                        : null,
                    }
                  : null,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory for a specific vendor (Admin only)
 * @route   GET /api/v1/admin/inventory/vendor/:vendorId
 * @access  Private/Admin
 */
const getVendorInventory = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: combinations } =
      await VariantCombination.findAndCountAll({
        attributes: [
          "id",
          "combination_name",
          "sku_suffix",
          "stock",
          "price_modifier",
          "is_active",
        ],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "sku"], // Product attributes, but fetched as part of combination
            where: { vendor_id: vendorId },
            required: true,
          },
        ],
        limit: parseInt(limit),
        subQuery: false, // Prevent subquery to avoid join issues with includes
        offset: parseInt(offset),
        order: [[{ model: Product, as: "product" }, "updated_at", "DESC"]],
      });

    res.status(200).json({
      status: "success",
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        inventory: combinations.map((combo) => ({
          // Rename to inventory for consistency in API response
          combination_id: combo.id,
          combination_name: combo.combination_name,
          sku_suffix: combo.sku_suffix,
          stock: combo.stock,
          price_modifier: combo.price_modifier,
          is_active: combo.is_active,
          product: combo.product
            ? {
                id: combo.product.id,
                name: combo.product.name,
                sku: combo.product.sku,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low stock items across all vendors (Admin only)
 * @route   GET /api/v1/admin/inventory/low-stock
 * @access  Private/Admin
 */
const getGlobalLowStockItems = async (req, res, next) => {
  try {
    const threshold = req.query.threshold || 10;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: lowStockCombinations } =
      await VariantCombination.findAndCountAll({
        where: {
          stock: {
            [Op.lte]: threshold,
          },
        },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "sku", "price"], // Product details
            include: [
              {
                model: Vendor,
                as: "vendor",
                attributes: ["id"],
                include: [
                  {
                    model: Store,
                    as: "store",
                    attributes: ["business_name"],
                  },
                ],
              },
            ],
            required: true,
          },
          {
            model: ProductVariant,
            as: "variants",
            attributes: ["id", "name", "value"],
            through: { attributes: [] },
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        subQuery: false, // Prevent subquery to avoid join issues with includes
        order: [["stock", "ASC"]],
      });

    res.status(200).json({
      status: "success",
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        lowStockItems: lowStockCombinations.map((combo) => ({
          combination_id: combo.id,
          combination_name: combo.combination_name,
          sku_suffix: combo.sku_suffix,
          stock: combo.stock,
          price_modifier: combo.price_modifier,
          product: combo.product,
          variants: combo.variants,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory history across all products (Admin only)
 * @route   GET /api/v1/admin/inventory/history
 * @access  Private/Admin
 */
const getInventoryHistoryAdmin = async (req, res, next) => {
  try {
    const {
      productId,
      vendorId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    if (productId) {
      // Find the product's inventory log ID first
      const inventoryLog = await Inventory.findOne({
        where: { product_id: productId },
        attributes: ["id"],
      });
      if (inventoryLog) {
        where.inventory_id = inventoryLog.id;
      } else {
        // If no inventory log, no history
        return res.status(200).json({
          status: "success",
          data: { total: 0, page: parseInt(page), pages: 0, history: [] },
        });
      }
    }
    if (vendorId) {
      where["$Inventory.Product.vendor_id$"] = vendorId;
    }
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }

    const { count, rows: history } = await InventoryHistory.findAndCountAll({
      where,
      include: [
        {
          model: Inventory,
          attributes: ["id", "product_id"],
          include: [
            {
              model: Product,
              attributes: ["id", "name", "sku"],
              include: [
                {
                  model: Vendor,
                  as: "vendor",
                  attributes: ["id"],
                  include: [
                    {
                      model: Store,
                      as: "store",
                      attributes: ["business_name"],
                    },
                  ],
                },
              ],
              required: true, // Ensure product exists
            },
          ],
          required: true, // Ensure inventory log exists
        },
        {
          model: VariantCombination,
          as: "combination", // Assuming this association exists in InventoryHistory model
          attributes: ["id", "combination_name", "sku_suffix"],
          required: false, // Not all history might be tied to a combination (e.g., old product-level history)
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProductInventory,
  updateProductInventory,
  getLowStockItems,
  getProductInventoryHistory,
  // Admin methods
  getAllInventory,
  getVendorInventory,
  getGlobalLowStockItems,
  getInventoryHistoryAdmin,
};
