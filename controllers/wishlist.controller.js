const { Wishlist, WishlistItem, Product, User } = require('../models');
const AppError = require('../utils/appError');

/**
 * Helper function to ensure user has a single wishlist
 * Creates one automatically if it doesn't exist
 */
const getOrCreateUserWishlist = async (userId, transaction = null) => {
  const options = transaction ? { transaction } : {};
  
  let wishlist = await Wishlist.findOne({
    where: { user_id: userId },
    ...options
  });

  if (!wishlist) {
    // Create a default wishlist for the user
    wishlist = await Wishlist.create({
      user_id: userId,
      is_default: true
    }, options);
  }

  return wishlist;
};

/**
 * Get user's single wishlist with items
 * Simplified version that works with single wishlist per user
 * @route GET /api/v1/wishlist
 * @access Private
 */
const getUserWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId);

    const wishlistWithItems = await Wishlist.findOne({
      where: { id: wishlist.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: WishlistItem,
          as: 'items',
          attributes: ['id', 'price_at_addition', 'added_at'],
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price', 'status'],
            }
          ],
          order: [['added_at', 'ASC']]
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: wishlistWithItems
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add item to user's single wishlist
 * @route POST /api/v1/wishlist/items/:productId
 * @access Private
 */
const addItemToWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId, transaction);

    // Verify product exists
    const product = await Product.findByPk(productId, { transaction });

    if (!product) {
      await transaction.rollback();
      return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'active') {
      await transaction.rollback();
      return next(new AppError('Product is not available', 400));
    }

    // Check if item already exists
    const existingItem = await WishlistItem.findOne({
      where: {
        wishlist_id: wishlist.id,
        product_id: product.id
      },
      transaction,
    });

    if (existingItem) {
      await transaction.rollback();
      return next(new AppError('Item already in wishlist', 409));
    }

    // Create new item
    const item = await WishlistItem.create(
      {
        wishlist_id: wishlist.id,
        product_id: product.id,
        price_at_addition: product.price,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      message: 'Item added to wishlist successfully',
      data: item
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Remove item from user's single wishlist
 * @route DELETE /api/v1/wishlist/items/:itemId
 * @access Private
 */
const removeItemFromWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId, transaction);

    // Find and delete the item
    const item = await WishlistItem.findOne({
      where: {
        id: itemId,
        wishlist_id: wishlist.id
      },
      transaction
    });

    if (!item) {
      await transaction.rollback();
      return next(new AppError('Item not found in wishlist', 404));
    }

    await item.destroy({ transaction });
    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Item removed from wishlist successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getUserWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  getOrCreateUserWishlist
};
