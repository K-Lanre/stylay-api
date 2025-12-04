const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const wishlistController = require('../controllers/wishlist.controller');
const {
  addItemValidation,
  wishlistItemIdValidation
} = require('../validators/wishlist.validator');
const validate = require('../middlewares/validation');

// Apply authentication middleware to all routes
router.use(protect);

// Get user's single wishlist
router.get(
  '/',
  wishlistController.getUserWishlist
);

// Add item to user's wishlist
router.post(
  '/items/:productId',
  addItemValidation,
  validate,
  wishlistController.addItemToWishlist
);

// Remove item from wishlist
router.delete(
  '/items/:itemId',
  wishlistItemIdValidation,
  validate,
  wishlistController.removeItemFromWishlist
);

module.exports = router;
