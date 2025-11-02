const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const {
  createCollection,
  updateCollection,
  deleteCollection,
  addProductsToCollection,
  removeProductsFromCollection,
} = require("../../controllers/collection.controller");
const {
  createCollectionValidation,
  updateCollectionValidation,
  deleteCollectionValidation,
  collectionProductValidation,
} = require("../../validators/collection.validator");
const { protect, isAdmin } = require("../../middlewares/auth");
const { hasPermission } = require("../../middlewares/permission");
const validate = require("../../middlewares/validation");

// Protected Admin routes
router.post(
  "/",
  hasPermission('create_collection_admin'),
  protect,
  isAdmin,
  createCollectionValidation,
  validate,
  createCollection
);

router.put(
  "/:id",
  hasPermission('update_collection_admin'),
  protect,
  isAdmin,
  updateCollectionValidation,
  validate,
  updateCollection
);

router.delete(
  "/:id",
  hasPermission('delete_collection_admin'),
  protect,
  isAdmin,
  deleteCollectionValidation,
  validate,
  deleteCollection
);

// Collection Product Management
router.post(
  "/:id/products",
  hasPermission('add_products_to_collection'),
  protect,
  isAdmin,
  collectionProductValidation,
  validate,
  addProductsToCollection
);

router.delete(
  "/:id/products",
  hasPermission('remove_products_from_collection'),
  protect,
  isAdmin,
  collectionProductValidation,
  validate,
  removeProductsFromCollection
);

module.exports = router;
