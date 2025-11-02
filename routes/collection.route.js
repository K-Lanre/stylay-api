const express = require("express");
const router = express.Router();
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
const { hasPermission } = require("../middlewares/permission");

// Public routes
router.get("/", hasPermission('view_collections'), getCollections);
router.get("/:id", hasPermission('view_collection_by_id'), getCollectionValidation, validate, getCollectionById);

// Collection Product Management
router.get(
  "/:id/products",
  hasPermission('view_collection_products'),
  collectionProductValidation,
  validate,
  getCollectionProducts
);

module.exports = router;
