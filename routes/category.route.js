const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const {
  getCategories,
  getCategoryByIdentifier,
  getCategoryTree,
  getCategoryProducts,
} = require("../controllers/category.controller");
const {
  getCategoryByIdentifierValidation,
  getCategoryProductsValidation,
} = require("../validators/category.validator");
const validate = require("../middlewares/validation");

// Public routes
router.get("/", getCategories);
router.get("/tree", getCategoryTree);

// New route that accepts both ID and slug (replaces the old :id route)
router.get(
  "/:identifier",
  getCategoryByIdentifierValidation,
  validate,
  getCategoryByIdentifier
);

// Get products by category
router.get(
  "/:id/products",
  getCategoryProductsValidation,
  validate,
  getCategoryProducts
);


module.exports = router;
