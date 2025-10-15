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
const validate = require("../../middlewares/validation");

// Protected Admin routes
router.post(
  "/",
  protect,
  isAdmin,
  createCollectionValidation,
  validate,
  createCollection
);

router.put(
  "/:id",
  protect,
  isAdmin,
  updateCollectionValidation,
  validate,
  updateCollection
);

router.delete(
  "/:id",
  protect,
  isAdmin,
  deleteCollectionValidation,
  validate,
  deleteCollection
);

// Collection Product Management
router.post(
  "/:id/products",
  protect,
  isAdmin,
  collectionProductValidation,
  validate,
  addProductsToCollection
);

router.delete(
  "/:id/products",
  protect,
  isAdmin,
  collectionProductValidation,
  validate,
  removeProductsFromCollection
);

module.exports = router;
