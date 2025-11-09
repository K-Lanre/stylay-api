const { Supply, Product, Vendor, Store, Inventory, VendorProductTag, sequelize } = require('../models');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');

/**
 * Create a new supply record for a vendor's product
 * Records product supply transactions and automatically updates inventory levels.
 * Uses database transactions to ensure data consistency.
 *
 * @param {import('express').Request} req - Express request object (vendor authentication required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {number} req.body.product_id - Product ID being supplied (required)
 * @param {number} req.body.quantity - Quantity supplied (required)
 * @param {number} [req.body.vendor_product_tag_id] - Optional vendor product tag ID
 * @param {string} [req.body.supply_date] - Supply date (defaults to current date)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created supply record
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data.supply - Created supply record
 * @throws {AppError} 404 - Vendor not found or not approved, or product not owned by vendor
 * @throws {Error} 500 - Server error during supply creation
 * @api {post} /api/v1/supplies Create supply
 * @private Requires vendor authentication
 * @example
 * POST /api/v1/supplies
 * Authorization: Bearer <vendor_jwt_token>
 * {
 *   "product_id": 123,
 *   "quantity": 50,
 *   "vendor_product_tag_id": 456,
 *   "supply_date": "2024-01-15"
 * }
 */
const createSupply = async (req, res, next) => {
  const transaction = await Supply.sequelize.transaction();
  
  try {
    const { product_id, quantity, vendor_product_tag_id, supply_date = new Date() } = req.body;
    
    // Get the vendor record for the authenticated user
    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    
    if (!vendor) {
      await transaction.rollback();
      return next(new AppError('Vendor account not found', 404));
    }
    
    if (vendor.status !== 'approved') {
      await transaction.rollback();
      return next(new AppError('Only approved vendors can supply products', 403));
    }

    // Check if product exists and belongs to the vendor
    const product = await Product.findOne({
      where: { id: product_id, vendor_id: vendor.id }
    });

    if (!product) {
      await transaction.rollback();
      return next(new AppError('Product not found or not owned by vendor', 404));
    }

    // Create supply record
    const supply = await Supply.create({
      vendor_id: vendor.id,
      product_id,
      vendor_product_tag_id,
      quantity_supplied: quantity,
      supply_date,
      created_at: new Date()
    }, { transaction });

    // Update inventory with the new supply
    await updateInventory(product_id, quantity, transaction, supply.id);

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      data: {
        supply
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * @desc    Create multiple supplies in bulk
 * @route   POST /api/v1/supplies/bulk
 * @access  Private/Vendor
 */
const createBulkSupply = async (req, res, next) => {
  const transaction = await Supply.sequelize.transaction();
  try {
    const { items } = req.body;
    const vendorId = req.vendor?.id; // Set by the validator
    
    console.log('Starting bulk supply with vendor ID:', vendorId);
    console.log('Items to process:', JSON.stringify(items, null, 2));
    
    if (!vendorId) {
      throw new Error('Vendor ID not found in request');
    }
    
    // Get all product IDs from the request
    const productIds = [...new Set(items.map(item => item.product_id))];
    
    // 1. Get current product assignments before update
    const productsBefore = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
      attributes: ['id', 'vendor_id'],
      raw: true,
      transaction
    });
    
    console.log('Product assignments before update:');
    productsBefore.forEach(p => {
      console.log(`- Product ID: ${p.id}, Current Vendor ID: ${p.vendor_id}`);
    });
    
    // 2. Assign any unassigned products to the current vendor
    const [updatedCount] = await Product.update(
      { vendor_id: vendorId, updated_at: new Date() },
      {
        where: {
          id: { [Op.in]: productIds },
          [Op.or]: [
            { vendor_id: null },  // Unassigned products
            { vendor_id: vendorId } // Already assigned to this vendor (no change)
          ]
        },
        transaction
      }
    );
    
    console.log(`Updated ${updatedCount} product assignments`);

    // 2. Create supply records and update inventory
    const supplies = [];
    
    for (const item of items) {
      const { product_id, quantity, vendor_product_tag_id } = item;
      const productId = String(product_id); // Ensure consistent type
      const quantitySupplied = Number(quantity); // Ensure quantity is a number
      
      console.log(`Processing product ${productId} with quantity ${quantitySupplied}`);
      
      // Create supply record with all required fields
      const supplyData = {
        vendor_id: vendorId,
        product_id: productId,
        vendor_product_tag_id,
        quantity_supplied: quantitySupplied,
        supply_date: new Date(),
        created_at: new Date() // Explicitly set created_at
      };
      
      console.log('Creating supply record with data:', JSON.stringify(supplyData, null, 2));
      
      // Create the supply record with raw: true to bypass any potential hooks
      const supply = await Supply.create(supplyData, {
        transaction,
        fields: ['vendor_id', 'product_id', 'vendor_product_tag_id', 'quantity_supplied', 'supply_date', 'created_at']
      });
      
      supplies.push(supply);
      
      console.log(`Updating inventory for product ${productId} - adding ${quantitySupplied} items`);
      
      // Update inventory using the helper function
      await updateInventory(productId, quantitySupplied, transaction, supply.id);
    }
    
    // 3. Get product details for the response
    const productDetails = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
      attributes: ['id', 'name', 'sku'],
      raw: true
    });
    
    // 4. Commit the transaction
    await transaction.commit();

    // 5. Prepare response
    const response = {
      status: 'success',
      message: `${supplies.length} products have been successfully supplied`,
      data: {
        supplies: supplies.map(supply => ({
          id: supply.id,
          product_id: supply.product_id,
          vendor_product_tag_id: supply.vendor_product_tag_id,
          product_name: productDetails.find(p => p.id === supply.product_id)?.name || 'Unknown',
          sku: productDetails.find(p => p.id === supply.product_id)?.sku || 'N/A',
          quantity: supply.quantity,
          supply_date: supply.supply_date,
          status: supply.status
        }))
      }
    };

    res.status(201).json(response);

  } catch (error) {
    // Rollback transaction on error
    if (transaction && !transaction.finished) {
      await transaction.rollback();
      console.error('Transaction rolled back due to error:', error);
    }
    
    // Handle specific error types
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(new AppError('A product can only be supplied once per transaction', 400));
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return next(new AppError('Invalid product or vendor reference', 400));
    }
    
    // Pass other errors to the error handler
    next(error);
  }
};

/**
 * @desc    Get all supplies
 * @route   GET /api/v1/supplies
 * @access  Private/Admin
 */
const getAllSupplies = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, vendor_id, product_id, vendor_product_tag_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (vendor_id) where.vendor_id = vendor_id;
    if (product_id) where.product_id = product_id;
    if (vendor_product_tag_id) where.vendor_product_tag_id = vendor_product_tag_id;
    if (start_date || end_date) {
      where.supply_date = {};
      if (start_date) where.supply_date[Op.gte] = new Date(start_date);
      if (end_date) where.supply_date[Op.lte] = new Date(end_date);
    }
    
    const { count, rows: supplies } = await Supply.findAndCountAll({
      where,
      include: [
        {
          model: Vendor,
          attributes: ['id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: ['id', 'business_name']
          }]
        },
        { model: Product, attributes: ['id', 'name', 'sku'] },
        { model: VendorProductTag, as: 'vendorProductTag', attributes: ['id'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['supply_date', 'DESC']]
    });
    
    res.status(200).json({
      status: 'success',
      count: supplies.length,
      total: count,
      data: supplies
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get supplies for the authenticated vendor
 * @route   GET /api/v1/supplies/vendor
 * @access  Private/Vendor
 */
const getVendorSupplies = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, product_id, vendor_product_tag_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    
    // Get the vendor ID for the authenticated user
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
      attributes: ['id']
    });
    
    if (!vendor) {
      return next(new AppError('Vendor not found', 404));
    }
    
    const where = { vendor_id: vendor.id };
    
    if (product_id) where.product_id = product_id;
    if (vendor_product_tag_id) where.vendor_product_tag_id = vendor_product_tag_id;
    if (start_date || end_date) {
      where.supply_date = {};
      if (start_date) where.supply_date[Op.gte] = new Date(start_date);
      if (end_date) where.supply_date[Op.lte] = new Date(end_date);
    }
    
    const { count, rows: supplies } = await Supply.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'sku']
        },
        { model: VendorProductTag, as: 'vendorProductTag', attributes: ['id'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['supply_date', 'DESC']]
    });
    
    res.status(200).json({
      status: 'success',
      count: supplies.length,
      total: count,
      data: supplies
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get supply by ID
 * @route   GET /api/v1/supplies/:id
 * @access  Private/Admin
 */
const getSupplyById = async (req, res, next) => {
  try {
    const supply = await Supply.findByPk(req.params.id, {
      include: [
        { model: Vendor, attributes: ['id', 'business_name'] },
        { model: Product, attributes: ['id', 'name', 'sku'] },
        { model: VendorProductTag, as: 'vendorProductTag', attributes: ['id'] }
      ]
    });
    
    if (!supply) {
      return next(new AppError('Supply not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: supply
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to update inventory
 */
const updateInventory = async (productId, quantity, transaction, supplyId = null) => {
  try {
    // First, check if an inventory record exists
    const existingInventory = await Inventory.findOne({
      where: { product_id: productId },
      transaction,
      lock: transaction.LOCK.UPDATE // Lock the row for update
    });

    if (existingInventory) {
      // Update existing record
      await existingInventory.increment('stock', {
        by: quantity,
        transaction
      });
      
      await existingInventory.update(
        {
          restocked_at: new Date(),
          supply_id: supplyId || existingInventory.supply_id
        },
        { transaction }
      );
    } else {
      // Create new record if it doesn't exist
      await Inventory.create(
        {
          product_id: productId,
          supply_id: supplyId,
          stock: quantity,
          restocked_at: new Date()
        },
        { transaction }
      );
    }
    
    console.log(`Successfully updated inventory for product ${productId}`);
  } catch (error) {
    console.error('Error updating inventory for product', productId, ':', error);
    throw error;
  }
};

/**
 * @desc    Get supplies by vendor ID (Admin only)
 * @route   GET /api/v1/admin/supplies/vendor/:vendorId
 * @access  Private/Admin
 */
const getSuppliesByVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const where = { vendor_id: vendorId };
    
    if (startDate || endDate) {
      where.supply_date = {};
      if (startDate) where.supply_date[Op.gte] = new Date(startDate);
      if (endDate) where.supply_date[Op.lte] = new Date(endDate);
    }

    const { count, rows: supplies } = await Supply.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'sku']
        },
        {
          model: Vendor,
          attributes: ['id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: ['id', 'business_name']
          }]
        },
        { model: VendorProductTag, as: 'vendorProductTag', attributes: ['id'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['supply_date', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        supplies
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get supply history for a product (Admin only)
 * @route   GET /api/v1/admin/supplies/product/:productId
 * @access  Private/Admin
 */
const getProductSupplyHistory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const where = { product_id: productId };
    
    if (startDate || endDate) {
      where.supply_date = {};
      if (startDate) where.supply_date[Op.gte] = new Date(startDate);
      if (endDate) where.supply_date[Op.lte] = new Date(endDate);
    }

    const { count, rows: supplies } = await Supply.findAndCountAll({
      where,
      include: [
        {
          model: Vendor,
          attributes: ['id']
        },
        {
          model: Product,
          attributes: ['id', 'name', 'sku']
        },
        { model: VendorProductTag, as: 'vendorProductTag', attributes: ['id'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['supply_date', 'DESC']],
      raw: true,
      nest: true
    });

    // Get vendor details for each supply
    const suppliesWithVendorDetails = await Promise.all(
      supplies.map(async (supply) => {
        const vendor = await Vendor.findByPk(supply.vendor_id);
        const vendorDetails = await vendor.getVendorDetails();
        return {
          ...supply,
          Vendor: {
            id: vendor.id,
            Store: vendorDetails.Store
          }
        };
      })
    );

    // Get current inventory level
    const inventory = await Inventory.findOne({
      where: { product_id: productId },
      attributes: ['stock']
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        currentStock: inventory ? inventory.stock : 0,
        supplies: suppliesWithVendorDetails
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get supply summary (Admin only)
 * @route   GET /api/v1/admin/supplies/summary
 * @access  Private/Admin
 */
const getSupplySummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    
    if (startDate || endDate) {
      where.supply_date = {};
      if (startDate) where.supply_date[Op.gte] = new Date(startDate);
      if (endDate) where.supply_date[Op.lte] = new Date(endDate);
    }

    // Total supplies
    const totalSupplies = await Supply.sum('quantity_supplied', { where });
    
    // Total unique products supplied
    const totalProducts = await Supply.count({
      distinct: true,
      col: 'product_id',
      where
    });
    
    // Total vendors who supplied
    const totalVendors = await Supply.count({
      distinct: true,
      col: 'vendor_id',
      where
    });
    
    // Top products by quantity
    const topProducts = await Supply.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.col('quantity_supplied')), 'total_quantity']
      ],
      include: [
        {
          model: Product,
          attributes: ['name', 'sku']
        },
        { model: VendorProductTag, as: 'vendorProductTag', attributes: ['id'] }
      ],
      where,
      group: ['product_id'],
      order: [[sequelize.literal('total_quantity'), 'DESC']],
      limit: 5,
      raw: true,
      nest: true
    });
    
    // Top vendors by quantity
    const topVendorsResult = await Supply.findAll({
      attributes: [
        'vendor_id',
        [sequelize.fn('SUM', sequelize.col('quantity_supplied')), 'total_quantity']
      ],
      where,
      group: ['vendor_id'],
      order: [[sequelize.literal('total_quantity'), 'DESC']],
      limit: 5,
      raw: true
    });

    // Get vendor details for each top vendor
    const topVendors = await Promise.all(
      topVendorsResult.map(async (vendor) => {
        const vendorDetails = await Vendor.findByPk(vendor.vendor_id);
        const vendorWithDetails = await vendorDetails.getVendorDetails();
        return {
          ...vendor,
          Vendor: {
            id: vendorDetails.id,
            Store: vendorWithDetails.Store
          }
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        totalSupplies: parseInt(totalSupplies) || 0,
        totalProducts,
        totalVendors,
        topProducts,
        topVendors
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSupply,
  createBulkSupply,
  getAllSupplies,
  getSupplyById,
  getVendorSupplies,
  // Admin methods
  getSuppliesByVendor,
  getProductSupplyHistory,
  getSupplySummary,
};
