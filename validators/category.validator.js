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

// Validation rules for getting a category
exports.getCategoryValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid category ID')
];

// Validation rules for getting category products
exports.getCategoryProductsValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid category ID')
    .custom(async (value) => {
      const category = await Category.findByPk(value);
      if (!category) {
        throw new Error('Category not found');
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
    .isIn(['ASC', 'DESC']).withMessage('Sort order must be either ASC or DESC')
];

// Validation rules for deleting a category
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
