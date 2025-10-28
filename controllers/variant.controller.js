// controllers/variant.controller.js
const {
  VariantType,
  VariantCombination,
  ProductVariant,
  Product,
  sequelize
} = require('../models');
const VariantService = require('../services/variant.service');
const AppError = require('../utils/appError');

/**
 * Get all variant types
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with variant types
 */
const getVariantTypes = async (req, res, next) => {
  try {
    const variantTypes = await VariantType.findAll({
      attributes: ['id', 'name', 'display_name', 'sort_order'],
      order: [['sort_order', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: variantTypes.length,
      data: variantTypes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new variant type
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Variant type name (e.g., "color")
 * @param {string} req.body.display_name - Display name (e.g., "Color")
 * @param {number} [req.body.sort_order] - Sort order
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created variant type
 */
const createVariantType = async (req, res, next) => {
  try {
    const { name, display_name, sort_order } = req.body;

    // Check if variant type already exists
    const existingType = await VariantType.findOne({
      where: { name: name.toLowerCase() }
    });

    if (existingType) {
      return next(new AppError('Variant type already exists', 400));
    }

    const variantType = await VariantType.create({
      name: name.toLowerCase(),
      display_name: display_name || name,
      sort_order: sort_order || 0
    });

    res.status(201).json({
      success: true,
      data: variantType
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a variant type
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Variant type ID
 * @param {Object} req.body - Request body
 * @param {string} [req.body.display_name] - New display name
 * @param {number} [req.body.sort_order] - New sort order
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated variant type
 */
const updateVariantType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { display_name, sort_order } = req.body;

    const variantType = await VariantType.findByPk(id);

    if (!variantType) {
      return next(new AppError('Variant type not found', 404));
    }

    await variantType.update({
      display_name: display_name || variantType.display_name,
      sort_order: sort_order !== undefined ? sort_order : variantType.sort_order
    });

    res.status(200).json({
      success: true,
      data: variantType
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a variant type
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Variant type ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 */
const deleteVariantType = async (req, res, next) => {
  try {
    const { id } = req.params;

    const variantType = await VariantType.findByPk(id);

    if (!variantType) {
      return next(new AppError('Variant type not found', 404));
    }

    // Check if variant type is being used
    const usageCount = await ProductVariant.count({
      where: { variant_type_id: id }
    });

    if (usageCount > 0) {
      return next(new AppError('Cannot delete variant type that is being used by products', 400));
    }

    await variantType.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get combinations for a specific product
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.productId - Product ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with product combinations
 */
const getProductCombinations = async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Verify product exists and user has access
    const product = await Product.findByPk(productId);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if user owns this product or is admin
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
    const isVendor = req.user.roles && req.user.roles.some(role => role.name === 'vendor');

    if (!isAdmin && (!isVendor || product.vendor_id !== req.user.vendor_id)) {
      return next(new AppError('Not authorized to view this product\'s combinations', 403));
    }

    const combinations = await VariantCombination.findAll({
      where: { product_id: productId },
      include: [{
        model: ProductVariant,
        as: 'variants',
        attributes: ['id', 'name', 'value', 'additional_price'],
        through: { attributes: [] }
      }],
      order: [['combination_name', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: combinations.length,
      data: combinations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific combination by ID
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Combination ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with combination details
 */
const getCombinationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const combination = await VariantCombination.findByPk(id, {
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'sku']
        },
        {
          model: ProductVariant,
          as: 'variants',
          attributes: ['id', 'name', 'value', 'additional_price'],
          through: { attributes: [] }
        }
      ]
    });

    if (!combination) {
      return next(new AppError('Variant combination not found', 404));
    }

    // Check authorization
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
    const isVendor = req.user.roles && req.user.roles.some(role => role.name === 'vendor');

    if (!isAdmin && (!isVendor || combination.Product.vendor_id !== req.user.vendor_id)) {
      return next(new AppError('Not authorized to view this combination', 403));
    }

    res.status(200).json({
      success: true,
      data: combination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update combination stock
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Combination ID
 * @param {Object} req.body - Request body
 * @param {number} req.body.stock - New stock level
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated combination
 */
const updateCombinationStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    const combination = await VariantCombination.findByPk(id, {
      include: [{
        model: Product,
        attributes: ['id', 'vendor_id']
      }]
    });

    if (!combination) {
      return next(new AppError('Variant combination not found', 404));
    }

    // Check authorization
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
    const isVendor = req.user.roles && req.user.roles.some(role => role.name === 'vendor');

    if (!isAdmin && (!isVendor || combination.Product.vendor_id !== req.user.vendor_id)) {
      return next(new AppError('Not authorized to update this combination', 403));
    }

    await VariantService.updateCombinationStock(id, stock);

    // Fetch updated combination
    const updatedCombination = await VariantCombination.findByPk(id, {
      include: [{
        model: ProductVariant,
        as: 'variants',
        attributes: ['id', 'name', 'value', 'additional_price'],
        through: { attributes: [] }
      }]
    });

    res.status(200).json({
      success: true,
      data: updatedCombination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update combination price modifier
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Combination ID
 * @param {Object} req.body - Request body
 * @param {number} req.body.price_modifier - New price modifier
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated combination
 */
const updateCombinationPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price_modifier } = req.body;

    const combination = await VariantCombination.findByPk(id, {
      include: [{
        model: Product,
        attributes: ['id', 'vendor_id']
      }]
    });

    if (!combination) {
      return next(new AppError('Variant combination not found', 404));
    }

    // Check authorization
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
    const isVendor = req.user.roles && req.user.roles.some(role => role.name === 'vendor');

    if (!isAdmin && (!isVendor || combination.Product.vendor_id !== req.user.vendor_id)) {
      return next(new AppError('Not authorized to update this combination', 403));
    }

    await combination.update({ price_modifier });

    res.status(200).json({
      success: true,
      data: combination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle combination active status
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Combination ID
 * @param {Object} req.body - Request body
 * @param {boolean} req.body.is_active - New active status
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated combination
 */
const toggleCombinationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const combination = await VariantCombination.findByPk(id, {
      include: [{
        model: Product,
        attributes: ['id', 'vendor_id']
      }]
    });

    if (!combination) {
      return next(new AppError('Variant combination not found', 404));
    }

    // Check authorization
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
    const isVendor = req.user.roles && req.user.roles.some(role => role.name === 'vendor');

    if (!isAdmin && (!isVendor || combination.Product.vendor_id !== req.user.vendor_id)) {
      return next(new AppError('Not authorized to update this combination', 403));
    }

    await combination.update({ is_active });

    res.status(200).json({
      success: true,
      data: combination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVariantTypes,
  createVariantType,
  updateVariantType,
  deleteVariantType,
  getProductCombinations,
  getCombinationById,
  updateCombinationStock,
  updateCombinationPrice,
  toggleCombinationStatus
};
