const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory,
  getCategoryTree,
  getCategoryProducts
} = require('../controllers/category.controller');
const { 
  createCategoryValidation, 
  updateCategoryValidation, 
  getCategoryValidation, 
  deleteCategoryValidation,
  getCategoryProductsValidation 
} = require('../validators/category.validator');
const { protect, isAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validation');

// Public routes
router.get('/', getCategories);
router.get('/tree', getCategoryTree);
router.get('/:id', getCategoryValidation, validate, getCategoryById);

// Get products by category
router.get(
  '/:id/products', 
  getCategoryProductsValidation, 
  validate, 
  getCategoryProducts
);

// Protected Admin routes
router.post(
  '/', 
  protect, 
  isAdmin,
  createCategoryValidation, 
  validate, 
  createCategory
);

router.put(
  '/:id', 
  protect, 
  isAdmin, 
  updateCategoryValidation, 
  validate, 
  updateCategory
);

router.delete(
  '/:id', 
  protect, 
  isAdmin, 
  deleteCategoryValidation, 
  validate, 
  deleteCategory
);

module.exports = router;
