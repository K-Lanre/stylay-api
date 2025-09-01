const { body, param, query } = require("express-validator");
const { Product, Vendor, Sequelize } = require("../models");
const { Op } = Sequelize;

// Validation for creating a new supply
exports.createSupplyValidation = [
  body("product_id")
    .notEmpty()
    .withMessage("Product ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid product ID")
    .custom(async (value) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error("Product not found");
      }
      return true;
    }),

  // vendor_id is obtained from the authenticated user's session

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
exports.createBulkSupplyValidation = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one supply item is required')
    .custom(async (items, { req }) => {
      if (!req.user || !req.user.id) {
        throw new Error('User not authenticated');
      }

      // 1. Basic validation
      const productIds = [];
      const validationErrors = [];
      const uniqueIds = new Set();

      items.forEach((item, index) => {
        // Convert product_id to string for consistent comparison
        const productId = String(item.product_id).trim();
        
        // Validate product_id
        if (!productId || isNaN(Number(productId)) || Number(productId) <= 0) {
          validationErrors.push(`Item at index ${index} has an invalid product_id.`);
        }
        
        // Validate quantity
        if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          validationErrors.push(`Item at index ${index} has an invalid quantity.`);
        }
        
        // Check for duplicates using string comparison
        if (uniqueIds.has(productId)) {
          validationErrors.push(`Duplicate product ID found: ${productId}.`);
        } else if (productId) {
          uniqueIds.add(productId);
          productIds.push(productId);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(' '));
      }

      // 2. Get vendor info
      console.log('User ID from request:', req.user.id);
      const vendor = await Vendor.findOne({ 
        where: { user_id: req.user.id },
        attributes: ['id', 'status', 'user_id'],
        raw: true
      });
      
      if (!vendor) {
        console.log('No vendor found for user ID:', req.user.id);
        throw new Error('Vendor account not found');
      }
      
      console.log('Found vendor:', JSON.stringify(vendor, null, 2));
      
      if (vendor.status !== 'approved') {
        console.log('Vendor not approved:', vendor.status);
        throw new Error('Only approved vendors can supply products');
      }

      // 3. Get all products in one query
      // Convert productIds to numbers for the database query
      const numericProductIds = productIds.map(id => Number(id));
      
      const products = await Product.findAll({
        where: { 
          id: { [Op.in]: numericProductIds }
        },
        attributes: ['id', 'vendor_id', 'name'],
        raw: true
      });
      
      // Log the products and vendor ID for debugging
      console.log('Found products:', JSON.stringify(products, null, 2));
      console.log('Vendor ID from request:', vendor.id);

      // 4. Check for missing or unauthorized products
      // Convert all IDs to strings for consistent comparison
      const validProductIds = new Set(products.map(p => String(p.id)));
      const missingProducts = productIds.filter(id => !validProductIds.has(id));
      
      console.log('Vendor ID in validation:', vendor.id, 'Type:', typeof vendor.id);
      console.log('Products and their vendor IDs:');
      products.forEach(p => {
        console.log(`- Product ID: ${p.id}, Vendor ID: ${p.vendor_id}, Type: ${typeof p.vendor_id}`);
      });
      
      // Check for unauthorized products (assigned to other vendors)
      const unauthorizedProducts = products
        .filter(p => {
          // Convert both IDs to strings for comparison
          const productVendorId = String(p.vendor_id);
          const currentVendorId = String(vendor.id);
          const isUnauthorized = p.vendor_id !== null && productVendorId !== currentVendorId;
          
          if (isUnauthorized) {
            console.log(`Unauthorized product found - ID: ${p.id}, Vendor ID: ${p.vendor_id} (${typeof p.vendor_id}), Expected Vendor ID: ${vendor.id} (${typeof vendor.id})`);
          }
          return isUnauthorized;
        })
        .map(p => `${p.name} (ID: ${p.id})`);
      
      // Check for missing products
      const errors = [];
      if (missingProducts.length > 0) {
        errors.push(`Products not found: ${missingProducts.join(', ')}`);
      }
      
      if (unauthorizedProducts.length > 0) {
        errors.push(`Not authorized to supply these products: ${unauthorizedProducts.join(', ')}`);
      }
      
      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      // Store vendor ID for use in the controller
      req.vendor = { id: vendor.id };
      return true;
    }),
];
