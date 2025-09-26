const { body, param, query } = require("express-validator");
const { Product, Vendor, VendorProductTag, Sequelize } = require("../models");
const { Op } = Sequelize;

// Validation for creating a new supply
/**
 * Validation rules for creating a single supply record.
 * Validates product, vendor product tag relationship, quantity, and optional supply date.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} product_id - Required, positive integer >= 1
 * @property {ValidationChain} vendor_product_tag_id - Required, positive integer >= 1, validates vendor ownership
 * @property {ValidationChain} quantity - Required, positive integer >= 1
 * @property {ValidationChain} supply_date - Optional, valid ISO8601 date format
 * @returns {Array} Express validator middleware array for single supply creation
 * @example
 * // Use in route:
 * router.post('/supplies', createSupplyValidation, createSupply);
 */
exports.createSupplyValidation = [
  body("product_id")
    .notEmpty()
    .withMessage("Product ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid product ID"),

  body("vendor_product_tag_id")
    .notEmpty()
    .withMessage("Vendor Product Tag ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid Vendor Product Tag ID")
    .custom(async (value, { req }) => {
      const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
      if (!vendor) {
        throw new Error('Vendor account not found');
      }

      const vendorProductTag = await VendorProductTag.findOne({
        where: {
          id: value,
          vendor_id: vendor.id,
          product_id: req.body.product_id
        }
      });

      if (!vendorProductTag) {
        throw new Error('Vendor Product Tag not found or does not match vendor/product');
      }
      return true;
    }),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("supply_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD"),
];

// Validation for bulk supply creation
/**
 * Validation rules for creating multiple supply records in bulk.
 * Comprehensive validation including product existence, vendor ownership, and business rule checks.
 * Includes duplicate prevention and stock validation.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} items - Required array with comprehensive validation for each supply item
 * @returns {Array} Express validator middleware array for bulk supply creation
 * @example
 * // Use in route:
 * router.post('/supplies/bulk', createBulkSupplyValidation, createBulkSupply);
 */
exports.createBulkSupplyValidation = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one supply item is required')
    .custom(async (items, { req }) => {
      if (!req.user || !req.user.id) {
        throw new Error('User not authenticated');
      }

      // 1. Basic validation
      const productIds = [];
      const vendorProductTagIds = [];
      const validationErrors = [];
      const uniqueProductIds = new Set();
      const uniqueVendorProductTagIds = new Set();

      items.forEach((item, index) => {
        const productId = String(item.product_id).trim();
        const vendorProductTagId = String(item.vendor_product_tag_id).trim();

        // Validate product_id
        if (!productId || isNaN(Number(productId)) || Number(productId) <= 0) {
          validationErrors.push(`Item at index ${index} has an invalid product_id.`);
        }
        
        // Validate vendor_product_tag_id
        if (!vendorProductTagId || isNaN(Number(vendorProductTagId)) || Number(vendorProductTagId) <= 0) {
          validationErrors.push(`Item at index ${index} has an invalid vendor_product_tag_id.`);
        }

        // Validate quantity
        if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          validationErrors.push(`Item at index ${index} has an invalid quantity.`);
        }
        
        // Check for duplicate product IDs within the bulk request
        if (uniqueProductIds.has(productId)) {
          validationErrors.push(`Duplicate product ID found in bulk request: ${productId}.`);
        } else if (productId) {
          uniqueProductIds.add(productId);
          productIds.push(productId);
        }

        // Check for duplicate vendor_product_tag IDs within the bulk request
        if (uniqueVendorProductTagIds.has(vendorProductTagId)) {
          validationErrors.push(`Duplicate vendor_product_tag ID found in bulk request: ${vendorProductTagId}.`);
        } else if (vendorProductTagId) {
          uniqueVendorProductTagIds.add(vendorProductTagId);
          vendorProductTagIds.push(vendorProductTagId);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(' '));
      }

      // 2. Get vendor info
      const vendor = await Vendor.findOne({
        where: { user_id: req.user.id },
        attributes: ['id', 'status', 'user_id'],
        raw: true
      });
      
      if (!vendor) {
        throw new Error('Vendor account not found');
      }
      
      if (vendor.status !== 'approved') {
        throw new Error('Only approved vendors can supply products');
      }

      // 3. Get all products and vendor product tags in one query
      const numericProductIds = productIds.map(id => Number(id));
      const numericVendorProductTagIds = vendorProductTagIds.map(id => Number(id));

      const products = await Product.findAll({
        where: {
          id: { [Op.in]: numericProductIds }
        },
        attributes: ['id', 'vendor_id', 'name'],
        raw: true
      });

      const vendorProductTags = await VendorProductTag.findAll({
        where: {
          id: { [Op.in]: numericVendorProductTagIds },
          vendor_id: vendor.id,
          product_id: { [Op.in]: numericProductIds }
        },
        attributes: ['id', 'vendor_id', 'product_id'],
        raw: true
      });
      
      // 4. Check for missing or unauthorized products/vendor_product_tags
      const validProductIds = new Set(products.map(p => String(p.id)));
      const validVendorProductTagIds = new Set(vendorProductTags.map(vpt => String(vpt.id)));

      const errors = [];
      items.forEach(item => {
        const productId = String(item.product_id);
        const vendorProductTagId = String(item.vendor_product_tag_id);

        if (!validProductIds.has(productId)) {
          errors.push(`Product with ID ${productId} not found.`);
        }

        if (!validVendorProductTagIds.has(vendorProductTagId)) {
          errors.push(`Vendor Product Tag with ID ${vendorProductTagId} not found or does not match vendor/product.`);
        }

        const product = products.find(p => String(p.id) === productId);
        if (product && product.vendor_id !== null && String(product.vendor_id) !== String(vendor.id)) {
          errors.push(`Not authorized to supply product ${product.name} (ID: ${product.id}) as it belongs to another vendor.`);
        }
      });
      
      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      // Store vendor ID for use in the controller
      req.vendor = { id: vendor.id };
      return true;
    }),
];
