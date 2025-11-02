const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategoryByIdentifier,
  getCategoryTree,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");
const {
  getCategoryByIdentifierValidation,
  getCategoryProductsValidation,
} = require("../validators/category.validator");
const validate = require("../middlewares/validation");
const { protect, isAdmin } = require("../middlewares/auth");
const { hasPermission } = require("../middlewares/permission");
const {
  createCategoryValidation,
  updateCategoryValidation,
  deleteCategoryValidation,
} = require("../validators/category.validator");

// Public routes
router.get("/", getCategories);
router.get("/tree", getCategoryTree);

// New route that accepts both ID and slug (replaces the old :id route)
router.get(
  "/:identifier",
  getCategoryByIdentifierValidation,
  validate,
  hasPermission('categories', 'read'),
  getCategoryByIdentifier
);

// Get products by category
router.get(
  "/:id/products",
  getCategoryProductsValidation,
  validate,
  getCategoryProducts
);

router.post(
  "/",
  protect,
  isAdmin,
  createCategoryValidation,
  validate,
  createCategory
);

router.put(
  "/:id",
  protect,
  isAdmin,
  updateCategoryValidation,
  validate,
  updateCategory
);

router.delete(
  "/:id",
  protect,
  isAdmin,
  deleteCategoryValidation,
  validate,
  deleteCategory
);

module.exports = router;
