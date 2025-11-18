const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const wishlistController = require('../controllers/wishlist.controller');
const {
  addItemValidation,
  updateItemValidation,
  wishlistItemIdValidation,
  moveToCartValidation
} = require('../validators/wishlist.validator');
const validate = require('../middlewares/validation');

// Apply authentication middleware to all routes
router.use(protect);

// Get user's single wishlist
router.get(
  '/',
  wishlistController.getUserWishlist
);

// Get items in user's wishlist
router.get(
  '/items',
  wishlistController.getWishlistItems
);

// Add item to user's wishlist
router.post(
  '/items',
  addItemValidation,
  validate,
  wishlistController.addItemToWishlist
);

// Update wishlist item
router.put(
  '/items/:itemId',
  wishlistItemIdValidation,
  updateItemValidation,
  validate,
  wishlistController.updateWishlistItem
);

// Remove item from wishlist
router.delete(
  '/items/:itemId',
  wishlistItemIdValidation,
  validate,
  wishlistController.removeItemFromWishlist
);

// Update wishlist item (PATCH method)
router.patch(
  '/items/:itemId',
  wishlistItemIdValidation,
  updateItemValidation,
  validate,
  wishlistController.updateWishlistItem
);

// Clear all items from wishlist
router.delete(
  '/clear',
  wishlistController.clearWishlist
);

// Get wishlist statistics
router.get(
  '/stats',
  wishlistController.getWishlistStats
);

// Get wishlist analytics
router.get(
  '/analytics',
  wishlistController.getWishlistAnalytics
);

// Get wishlist summary with totals
router.get(
  '/summary',
  wishlistController.getWishlistSummary
);

// Move item from wishlist to cart
router.post(
  '/items/:id/move-to-cart',
  moveToCartValidation,
  validate,
  wishlistController.moveToCart
);

module.exports = router;