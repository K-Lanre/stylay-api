const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const {
  getCollections,
  getCollectionById,
  getCollectionProducts,
} = require("../controllers/collection.controller");
const {
  getCollectionValidation,
  collectionProductValidation,
} = require("../validators/collection.validator");
const validate = require("../middlewares/validation");

// Public routes
router.get("/", getCollections);
router.get("/:id", getCollectionValidation, validate, getCollectionById);

// Collection Product Management
router.get(
  "/:id/products",
  collectionProductValidation,
  validate,
  getCollectionProducts
);

module.exports = router;
