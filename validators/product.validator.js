const { body, param, query } = require('express-validator');
const { Vendor } = require('../models');
const { Op } = require('sequelize');
const { Product, Category, ProductVariant, ProductImage } = require('../models');

// Common validation messages
const messages = {
  required: field => `Please provide a ${field}`,
  string: field => `${field} must be a valid text`,
  numeric: field => `${field} must be a valid number`,
  minLength: (field, length) => `${field} should be at least ${length} characters`,
  maxLength: (field, length) => `${field} cannot be longer than ${length} characters`,
  isUrl: field => `Please provide a valid URL for ${field}`,
  isIn: (field, values) => `Please choose a valid ${field.toLowerCase()} (${values.join(', ')})`,
  exists: field => `The selected ${field.toLowerCase()} does not exist`
};

// Product validation rules
exports.createProductValidation = [
  // Basic product info
  // Product name
  body('name')
    .trim()
    .notEmpty().withMessage(messages.required('product name'))
    .isString().withMessage(messages.string('Product name'))
    .isLength({ min: 2 }).withMessage(messages.minLength('Product name', 2))
    .isLength({ max: 100 }).withMessage(messages.maxLength('Product name', 100)),
    
  // Product description
  body('description')
    .optional()
    .trim()
    .isString().withMessage(messages.string('Description'))
    .isLength({ max: 2000 }).withMessage(messages.maxLength('Description', 2000)),
    
  // Price validation
  body('price')
    .notEmpty().withMessage(messages.required('price'))
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Price must be between $0.01 and $1,000,000')
    .toFloat(),
    
  // Category validation
  body('category_id')
    .notEmpty().withMessage(messages.required('category'))
    .isInt({ min: 1 }).withMessage('Please select a valid category')
    .custom(async (value) => {
      try {
        const category = await Category.findByPk(value);
        if (!category) {
          throw new Error('Selected category does not exist');
        }
        return true;
      } catch (error) {
        throw new Error('Error validating category');
      }
    }),
    
  body('sku')
    .optional()
    .trim()
    .isString().withMessage(messages.string('SKU'))
    .isLength({ max: 100 }).withMessage(messages.maxLength('SKU', 100)),
    
  // Variants validation
  body('variants')
    .optional()
    .isArray().withMessage('Variants must be an array')
    .custom(async (variants) => {
      if (!Array.isArray(variants)) return true;
      
      // Validate variant structure based on ProductVariant model
      const validVariantTypes = ['Size', 'Color', 'Material', 'Style'];
      
      for (const [index, variant] of variants.entries()) {
        const { name, value, additional_price, stock } = variant;
        
        // Check required fields
        if (!name || typeof name !== 'string' || !name.trim()) {
          throw new Error(`Variant at index ${index}: Name is required`);
        }
        
        if (name.length > 100) {
          throw new Error(`Variant at index ${index}: Name cannot exceed 100 characters`);
        }
        
        if (!validVariantTypes.includes(name)) {
          throw new Error(`Variant at index ${index}: Name must be one of: ${validVariantTypes.join(', ')}`);
        }
        
        if (!value || typeof value !== 'string' || !value.trim()) {
          throw new Error(`Variant at index ${index}: Value is required`);
        }
        
        if (value.length > 100) {
          throw new Error(`Variant at index ${index}: Value cannot exceed 100 characters`);
        }
        
        // Validate additional_price if provided
        if (additional_price !== undefined) {
          const price = parseFloat(additional_price);
          if (isNaN(price) || !Number.isFinite(price)) {
            throw new Error(`Variant at index ${index}: Additional price must be a valid number`);
          }
          if (price < -1000000 || price > 1000000) {
            throw new Error(`Variant at index ${index}: Additional price must be between -1,000,000 and 1,000,000`);
          }
        }
        
        // Validate stock if provided
        if (stock !== undefined) {
          const stockNum = Number(stock);
          if (!Number.isInteger(stockNum) || stockNum < 0 || stockNum > 1000000) {
            throw new Error(`Variant at index ${index}: Stock must be an integer between 0 and 1,000,000`);
          }
        }
      }
      
      return true;
    }),
    
  // Images validation
  body('images')
    .optional()
    .isArray().withMessage('Images must be an array')
    .custom(async (images) => {
      if (!Array.isArray(images)) return true;
      
      let featuredCount = 0;
      
      for (const [index, image] of images.entries()) {
        // Validate URL is required and is a string
        if (!image.url || typeof image.url !== 'string' || !image.url.trim()) {
          throw new Error(`Image at index ${index}: URL is required`);
        }
        
        // Validate URL format and length (max 255 chars as per model)
        try {
          new URL(image.url);
          if (image.url.length > 255) {
            throw new Error('URL exceeds maximum length of 255 characters');
          }
        } catch (e) {
          throw new Error(`Image at index ${index}: Must be a valid URL (max 255 characters)`);
        }
        
        // Handle is_featured (defaults to false if not provided)
        const isFeatured = image.is_featured !== undefined ? Boolean(image.is_featured) : false;
        
        // Count featured images
        if (isFeatured) {
          featuredCount++;
          if (featuredCount > 1) {
            throw new Error('Only one image can be marked as featured');
          }
        }
        
        // Update the image object to ensure is_featured is a boolean
        image.is_featured = isFeatured;
      }
      
      return true;
    })
];

// Update product validation
exports.updateProductValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid product ID')
    .custom(async (value) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('name')
    .optional()
    .trim()
    .isString().withMessage(messages.string('Name'))
    .isLength({ min: 3 }).withMessage(messages.minLength('Name', 3))
    .isLength({ max: 255 }).withMessage(messages.maxLength('Name', 255)).custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('description')
    .optional()
    .trim()
    .isString().withMessage(messages.string('Description'))
    .isLength({ min: 10 }).withMessage(messages.minLength('Description', 10)).custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('price')
    .optional()
    .isNumeric().withMessage(messages.numeric('Price'))
    .isFloat({ min: 0.01 }).withMessage('Price must be greater than 0').custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('category_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid category ID')
    .custom(async (value) => {
      const category = await Category.findByPk(value);
      if (!category) {
        throw new Error('Category not found');
      }
      return true;
    }).custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('sku')
    .optional()
    .trim()
    .isString().withMessage(messages.string('SKU'))
    .isLength({ max: 100 }).withMessage(messages.maxLength('SKU', 100)).custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer').custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'out_of_stock'])
    .withMessage('Invalid status value')
];

// Get products validation
exports.getProductsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
    
  query('category')
    .optional()
    .custom(async (value) => {
      // Check if it's a numeric ID
      const isNumericId = !isNaN(value) && !isNaN(parseFloat(value));

      if (isNumericId) {
        // Validate as ID
        const category = await Category.findByPk(parseInt(value));
        if (!category) {
          throw new Error('Category not found');
        }
      } else {
        // Validate as name or slug
        const category = await Category.findOne({
          where: {
            [Op.or]: [
              { name: { [Op.like]: `%${value}%` } },
              { slug: value }
            ]
          }
        });
        if (!category) {
          throw new Error('Category not found');
        }
      }
      return true;
    }),
  query('sortBy')
    .optional()
    .isIn(['price', 'createdAt', 'name']).withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Sort order must be either ASC, DESC, asc, or desc'),

  query('vendor')
    .optional()
    .isInt({ min: 1 }).withMessage('Vendor ID must be a positive integer')
    .custom(async (value) => {
      const vendor = await Vendor.findByPk(value);
      if (!vendor) {
        throw new Error('Vendor not found');
      }
      return true;
    }),

    
  query('search')
    .optional()
    .trim()
    .isString().withMessage('Search term must be a string')
    .isLength({ min: 2 }).withMessage('Search term must be at least 2 characters')
];

// Get product by ID or slug validation
exports.getProductByIdentifierValidation = [
  param('identifier')
    .notEmpty().withMessage('Product identifier is required')
    .custom(async (value) => {
      // Check if it's a numeric ID
      const isNumericId = !isNaN(value) && !isNaN(parseFloat(value));

      if (isNumericId) {
        // Validate as ID
        const product = await Product.findByPk(parseInt(value));
        if (!product) {
          throw new Error('Product not found');
        }
      } else {
        // Validate as slug
        const product = await Product.findOne({ where: { slug: value } });
        if (!product) {
          throw new Error('Product not found');
        }
      }
      return true;
    })
];

// Delete product validation
exports.deleteProductValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid product ID')
    .custom(async (value, { req }) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error('Product not found');
      }
      // Check if the current user is the product owner or admin
      if (product.vendor_id !== req.user.id && req.user.role !== 'admin') {
        throw new Error('Not authorized to delete this product');
      }
      return true;
    })
];

// Update product validation
exports.updateProductValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid product ID')
    .custom(async (value, { req }) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error('Product not found');
      }
      // Check if the current user is the product owner or admin
      if (product.vendor_id !== req.user.id && req.user.role !== 'admin') {
        throw new Error('Not authorized to update this product');
      }
      return true;
    }),
    
  // Optional fields that can be updated
  body('name')
    .optional()
    .trim()
    .isString().withMessage(messages.string('Name'))
    .isLength({ min: 3 }).withMessage(messages.minLength('Name', 3))
    .isLength({ max: 255 }).withMessage(messages.maxLength('Name', 255)).custom(async (value, { req }) => {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        throw new Error('Product not found');
      }
      return true;
    }),
    
  body('description')
    .optional()
    .trim()
    .isString().withMessage(messages.string('Description')),
    
  body('price')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
    
  body('category_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid category ID')
    .custom(async (value) => {
      const category = await Category.findByPk(value);
      if (!category) {
        throw new Error('Category not found');
      }
      return true;
    }),
    
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    
  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'out_of_stock'])
    .withMessage('Invalid status value')
];

// Get vendor products validation
exports.getVendorProductsValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid vendor ID')
    .custom(async (value) => {
      const vendor = await Vendor.findByPk(value);
      if (!vendor) {
        throw new Error('Vendor not found');
      }
      return true;
    }),
    
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];
