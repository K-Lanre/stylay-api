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


module.exports = router;