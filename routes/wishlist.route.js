const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const wishlistController = require('../controllers/wishlist.controller');
const {
  createWishlistValidation,
  updateWishlistValidation,
  wishlistIdValidation,
  addItemValidation,
  updateItemValidation,
  wishlistItemIdValidation,
  getWishlistsValidation,
  getWishlistItemsValidation
} = require('../validators/wishlist.validator');
const validate = require('../middlewares/validation');

// Apply authentication middleware to all routes
router.use(protect);

// Wishlist routes
// Get all user wishlists
router.get(
  '/',
  getWishlistsValidation,
  validate,
  wishlistController.getUserWishlists
);

// Create a new wishlist
router.post(
  '/',
  createWishlistValidation,
  validate,
  wishlistController.createWishlist
);

// Get a specific wishlist
router.get(
  '/:id',
  wishlistIdValidation,
  validate,
  wishlistController.getWishlist
);

// Update a wishlist
router.put(
  '/:id',
  wishlistIdValidation,
  updateWishlistValidation,
  validate,
  wishlistController.updateWishlist
);

// Delete a wishlist
router.delete(
  '/:id',
  wishlistIdValidation,
  validate,
  wishlistController.deleteWishlist
);

// Wishlist item routes
// Get items in a wishlist
router.get(
  '/:id/items',
  wishlistIdValidation,
  getWishlistItemsValidation,
  validate,
  wishlistController.getWishlistItems
);

// Add item to wishlist
router.post(
  '/:id/items',
  wishlistIdValidation,
  addItemValidation,
  validate,
  wishlistController.addItemToWishlist
);

// Update wishlist item
router.put(
  '/:id/items/:itemId',
  wishlistIdValidation,
  wishlistItemIdValidation,
  updateItemValidation,
  validate,
  wishlistController.updateWishlistItem
);

// Remove item from wishlist
router.delete(
  '/:id/items/:itemId',
  wishlistIdValidation,
  wishlistItemIdValidation,
  validate,
  wishlistController.removeItemFromWishlist
);

module.exports = router;