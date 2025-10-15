const express = require("express");
const router = express.Router();
const {
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../../controllers/category.controller");
const {
  createCategoryValidation,
  updateCategoryValidation,
  deleteCategoryValidation,
} = require("../../validators/category.validator");
const { protect, isAdmin } = require("../../middlewares/auth");
const validate = require("../../middlewares/validation");

// Admin routes for category management
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