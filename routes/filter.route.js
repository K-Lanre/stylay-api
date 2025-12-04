const express = require("express");
const router = express.Router();

const {
  getAllFilters,
  getCategories,
  getPriceRange,
  getColors,
  getSizes,
  getDressStyles,
  getFilteredProducts,
  getProductCombinations,
} = require("../controllers/filter.controller");

router.get("/", getAllFilters);
router.get("/categories", getCategories);
router.get("/price-range", getPriceRange);
router.get("/colors", getColors);
router.get("/sizes", getSizes);
router.get("/dress-styles", getDressStyles);
router.post("/products", getFilteredProducts);
router.get("/products/:productId/combinations", getProductCombinations);

module.exports = router;
