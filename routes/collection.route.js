const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { 
  createCollection, 
  getCollections, 
  getCollectionById, 
  updateCollection, 
  deleteCollection,
  addProductsToCollection,
  removeProductsFromCollection
} = require('../controllers/collection.controller');
const { 
  createCollectionValidation, 
  updateCollectionValidation, 
  getCollectionValidation, 
  deleteCollectionValidation 
} = require('../validators/collection.validator');
const { protect, isAdmin } = require('../middlewares/auth');
const validate  = require('../middlewares/validation');

// Public routes
router.get('/', getCollections);
router.get('/:id', getCollectionValidation, validate, getCollectionById);

// Protected Admin routes
router.post(
  '/', 
  protect, 
  isAdmin,
  createCollectionValidation, 
  validate, 
  createCollection
);

router.put(
  '/:id', 
  protect, 
  isAdmin, 
  updateCollectionValidation, 
  validate, 
  updateCollection
);

router.delete(
  '/:id', 
  protect, 
  isAdmin, 
  deleteCollectionValidation, 
  validate, 
  deleteCollection
);

// Collection Product Management
router.post(
  '/:id/products',
  protect,
  isAdmin,
  [
    check('product_ids')
      .isArray({ min: 1 })
      .withMessage('At least one product ID is required')
  ],
  validate,
  addProductsToCollection
);

router.delete(
  '/:id/products',
  protect,
  isAdmin,
  [
    check('product_ids')
      .isArray({ min: 1 })
      .withMessage('At least one product ID is required')
  ],
  validate,
  removeProductsFromCollection
);

module.exports = router;
