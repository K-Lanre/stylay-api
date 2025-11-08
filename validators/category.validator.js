const { body, param, query } = require('express-validator');
const { Category } = require('../models');
const slugify = require('slugify');

// Common validation rules
const nameValidation = body('name')
  .trim()
  .notEmpty().withMessage('Category name is required')
  .isLength({ max: 100 }).withMessage('Category name must not exceed 100 characters');

const slugValidation = body('slug')
  .optional({ nullable: true })
  .trim()
  .isSlug().withMessage('Invalid slug format')
  .isLength({ max: 100 }).withMessage('Slug must not exceed 100 characters')
  .custom(async (value, { req }) => {
    if (!value) return true;
    const category = await Category.findOne({ where: { slug: value } });
    if (category && category.id !== parseInt(req.params?.id)) {
      throw new Error('Slug is already in use');
    }
    return true;
  });

const parentIdValidation = body('parent_id')
  .optional({ nullable: true })
  .isInt({ min: 1 }).withMessage('Invalid parent category ID')
  .custom(async (value) => {
    if (!value) return true;
    const parent = await Category.findByPk(value);
    if (!parent) {
      throw new Error('Parent category not found');
    }
    return true;
  });

const descriptionValidation = body('description')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters');

const imageValidation = body('image')
  .optional({ nullable: true })
  .isURL().withMessage('Invalid image URL format');

// Validation rules for creating a category
/**
 * Validation rules for creating a new category.
 * Validates category name, optional slug, parent relationship, description, and image URL.
 * Auto-generates slug from name if not provided.
 * @type {Array<ValidationChain|Function>} Array of express-validator chains and middleware functions
 * @property {ValidationChain} name - Required, 1-100 chars, trimmed
 * @property {ValidationChain} slug - Optional, 1-100 chars, unique, slug format
 * @property {ValidationChain} parent_id - Optional, integer > 0, validates parent exists
 * @property {ValidationChain} description - Optional, max 1000 chars
 * @property {ValidationChain} image - Optional, valid URL format
 * @returns {Array} Express validator middleware array for category creation
 * @example
 * // Use in route:
 * router.post('/categories', createCategoryValidation, createCategory);
 */
exports.createCategoryValidation = [
  nameValidation,
  slugValidation,
  parentIdValidation,
  descriptionValidation,
  imageValidation,
  // Auto-generate slug if not provided
  (req, res, next) => {
    if (!req.body.slug && req.body.name) {
      req.body.slug = slugify(req.body.name, { lower: true, strict: true });
    }
    next();
  }
];

// Validation rules for updating a category
/**
 * Validation rules for updating an existing category.
 * Validates category ID parameter and optional fields for updates.
 * Includes circular reference prevention for parent-child relationships.
 * @type {Array<ValidationChain|Function>} Array of express-validator chains and middleware functions
 * @property {ValidationChain} id - Required category ID parameter, integer > 0
 * @property {ValidationChain} name - Optional, 1-100 chars, trimmed
 * @property {ValidationChain} slug - Optional, 1-100 chars, unique, slug format
 * @property {ValidationChain} parent_id - Optional, integer > 0, validates parent exists
 * @property {ValidationChain} description - Optional, max 1000 chars
 * @property {ValidationChain} image - Optional, valid URL format
 * @returns {Array} Express validator middleware array for category updates
 * @example
 * // Use in route:
 * router.put('/categories/:id', updateCategoryValidation, updateCategory);
 */
exports.updateCategoryValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid category ID'),
  nameValidation.optional(),
  slugValidation,
  parentIdValidation,
  descriptionValidation,
  imageValidation,
  // Prevent circular parent-child relationship
  async (req, res, next) => {
    if (req.body.parent_id) {
      const categoryId = parseInt(req.params.id);
      if (categoryId === parseInt(req.body.parent_id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'A category cannot be its own parent' 
        });
      }
      
      // Check for circular reference
      let currentParentId = req.body.parent_id;
      const visited = new Set([categoryId]);
      
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Circular reference detected in category hierarchy' 
          });
        }
        
        visited.add(currentParentId);
        const parent = await Category.findByPk(currentParentId);
        currentParentId = parent?.parent_id;
      }
    }
    next();
  }
];

// Validation rules for getting a category by ID (legacy)
exports.getCategoryValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid category ID')
];

// Validation rules for getting a category by ID or slug
/**
 * Validation rules for retrieving a category by ID or slug identifier.
 * Handles both numeric IDs and string slugs with appropriate validation.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} identifier - Required identifier (ID or slug), validates existence
 * @returns {Array} Express validator middleware array for category retrieval by identifier
 * @example
 * // Use in route:
 * router.get('/categories/:identifier', getCategoryByIdentifierValidation, getCategory);
 */
exports.getCategoryByIdentifierValidation = [
  param('identifier')
    .notEmpty().withMessage('Category identifier is required')
    .custom(async (value) => {
      // Check if it's a numeric ID (positive integer)
      const isNumericId = /^\d+$/.test(value);

      if (isNumericId) {
        // Validate as ID
        const category = await Category.findByPk(parseInt(value, 10));
        if (!category) {
          throw new Error('Category not found');
        }
      } else {
        // Validate as slug
        const category = await Category.findOne({ where: { slug: value } });
        if (!category) {
          throw new Error('Category not found');
        }
      }
      return true;
    })
];

// Validation rules for getting category products
/**
 * Validation rules for retrieving products in a specific category.
 * Validates category identifier and optional filtering/sorting parameters.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required category identifier (ID or slug), validates existence
 * @property {ValidationChain} page - Optional, integer >= 1
 * @property {ValidationChain} limit - Optional, integer 1-100
 * @property {ValidationChain} minPrice - Optional, float >= 0
 * @property {ValidationChain} maxPrice - Optional, float >= minPrice
 * @property {ValidationChain} sortBy - Optional, one of: price, createdAt, name
 * @property {ValidationChain} sortOrder - Optional, ASC, DESC, asc, or desc
 * @returns {Array} Express validator middleware array for category products retrieval
 * @example
 * // Use in route:
 * router.get('/categories/:id/products', getCategoryProductsValidation, getCategoryProducts);
 */
exports.getCategoryProductsValidation = [
  param('id')
    .notEmpty().withMessage('Category ID or slug is required')
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
        // Validate as slug
        const category = await Category.findOne({ where: { slug: value } });
        if (!category) {
          throw new Error('Category not found');
        }
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
    .toInt(),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum price must be a positive number')
    .toFloat(),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maximum price must be a positive number')
    .toFloat()
    .custom((value, { req }) => {
      if (req.query.minPrice && value <= req.query.minPrice) {
        throw new Error('Maximum price must be greater than minimum price');
      }
      return true;
    }),
  query('sortBy')
    .optional()
    .isIn(['price', 'createdAt', 'name']).withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Sort order must be either ASC, DESC, asc, or desc')
];

// Validation rules for deleting a category
/**
 * Validation rules for deleting a category.
 * Includes checks for child categories and associated products to prevent data integrity issues.
 * @type {Array<ValidationChain|Function>} Array of express-validator chains and middleware functions
 * @property {ValidationChain} id - Required category ID parameter, integer > 0
 * @property {Function} - Middleware to check for child categories and products
 * @returns {Array} Express validator middleware array for category deletion
 * @example
 * // Use in route:
 * router.delete('/categories/:id', deleteCategoryValidation, deleteCategory);
 */
exports.deleteCategoryValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid category ID'),
  async (req, res, next) => {
    const categoryId = parseInt(req.params.id);
    
    // Check if category has children
    const hasChildren = await Category.count({ 
      where: { parent_id: categoryId } 
    }) > 0;
    
    if (hasChildren) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category with subcategories. Please remove or reassign subcategories first.' 
      });
    }
    
    // Check if category has products
    const hasProducts = await Category.count({
      include: [{
        association: 'Products',
        required: true
      }],
      where: { id: categoryId }
    }) > 0;
    
    if (hasProducts) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category with products. Please remove or reassign products first.' 
      });
    }
    
    next();
  }
];
