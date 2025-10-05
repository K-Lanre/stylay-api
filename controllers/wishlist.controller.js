const { Wishlist, WishlistItem, Product, ProductVariant, User } = require('../models');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');

/**
 * Get all wishlists belonging to the authenticated user
 * Returns wishlists ordered by default status first, then creation date.
 * Optionally includes full item details with product and variant information.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of wishlists per page
 * @param {boolean} [req.query.include_items=false] - Whether to include full item details
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with user's wishlists
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {number} res.body.results - Number of wishlists in current page
 * @returns {Object} res.body.pagination - Pagination metadata
 * @returns {Array} res.body.data - Array of wishlist objects with optional items
 * @throws {Error} 500 - Server error during wishlist retrieval
 * @api {get} /api/v1/wishlists Get user wishlists
 * @private Requires authentication
 * @example
 * GET /api/v1/wishlists?page=1&limit=5&include_items=true
 * Authorization: Bearer <jwt_token>
 */
const getUserWishlists = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, include_items = false } = req.query;
    const offset = (page - 1) * limit;

    const include = [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name']
      }
    ];

    if (include_items === 'true') {
      include.push({
        model: WishlistItem,
        as: 'items',
        attributes: ['id', 'quantity', 'price', 'priority', 'notes', 'added_at'],
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price'],
            include: [
              {
                model: ProductVariant,
                as: 'variants',
                attributes: ['id', 'name', 'value', 'additional_price'],
                required: false
              }
            ]
          }
        ]
      });
    }

    const { count, rows: wishlists } = await Wishlist.findAndCountAll({
      where: { user_id: userId },
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    res.status(200).json({
      status: 'success',
      results: wishlists.length,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      },
      data: wishlists
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific wishlist
 * @route GET /api/v1/wishlists/:id
 * @access Private
 */
const getWishlist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: WishlistItem,
          as: 'items',
          attributes: ['id', 'quantity', 'price', 'priority', 'notes', 'added_at'],
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price', 'status'],
              include: [
                {
                  model: ProductVariant,
                  as: 'variants',
                  attributes: ['id', 'name', 'value', 'additional_price'],
                  required: false
                }
              ]
            }
          ],
          order: [['priority', 'DESC'], ['added_at', 'ASC']]
        }
      ]
    });

    if (!wishlist) {
      return next(new AppError('Wishlist not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: wishlist
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new wishlist
 * @route POST /api/v1/wishlists
 * @access Private
 */
const createWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { name, description, is_public = false, is_default = false } = req.body;

    // If setting as default, remove default flag from other wishlists
    if (is_default) {
      await Wishlist.update(
        { is_default: false },
        {
          where: { user_id: userId },
          transaction
        }
      );
    }

    const wishlist = await Wishlist.create({
      user_id: userId,
      name,
      description,
      is_public,
      is_default
    }, { transaction });

    await transaction.commit();

    // Fetch the created wishlist with user details
    const createdWishlist = await Wishlist.findByPk(wishlist.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    res.status(201).json({
      status: 'success',
      message: 'Wishlist created successfully',
      data: createdWishlist
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Update a wishlist
 * @route PUT /api/v1/wishlists/:id
 * @access Private
 */
const updateWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, is_public, is_default } = req.body;

    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // If setting as default, remove default flag from other wishlists
    if (is_default && !wishlist.is_default) {
      await Wishlist.update(
        { is_default: false },
        {
          where: {
            user_id: userId,
            id: { [Op.ne]: id }
          },
          transaction
        }
      );
    }

    await wishlist.update({
      name,
      description,
      is_public,
      is_default
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Wishlist updated successfully',
      data: wishlist
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Delete a wishlist
 * @route DELETE /api/v1/wishlists/:id
 * @access Private
 */
const deleteWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // Delete all items in the wishlist first
    await WishlistItem.destroy({
      where: { wishlist_id: id },
      transaction
    });

    // Delete the wishlist
    await wishlist.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Wishlist deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Add item to wishlist
 * @route POST /api/v1/wishlists/:id/items
 * @access Private
 */
const addItemToWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { product_id, variant_id, quantity = 1, notes, priority = 'medium' } = req.body;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // Verify product exists
    const product = await Product.findByPk(product_id, { transaction });
    if (!product) {
      await transaction.rollback();
      return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'active') {
      await transaction.rollback();
      return next(new AppError('Product is not available', 400));
    }

    let variant = null;
    if (variant_id) {
      variant = await ProductVariant.findByPk(variant_id, { transaction });
      if (!variant || variant.product_id !== product.id) {
        await transaction.rollback();
        return next(new AppError('Product variant not found', 404));
      }
    }

    // Calculate price
    let price = product.price;
    if (variant && variant.additional_price) {
      price += variant.additional_price;
    }

    // Check if item already exists
    const existingItem = await WishlistItem.findOne({
      where: {
        wishlist_id: id,
        product_id,
        variant_id
      },
      transaction
    });

    let item;
    if (existingItem) {
      // Update existing item
      await existingItem.update({
        quantity,
        notes,
        priority,
        price
      }, { transaction });
      item = existingItem;
    } else {
      // Create new item
      item = await WishlistItem.create({
        wishlist_id: id,
        product_id,
        variant_id,
        quantity,
        price,
        notes,
        priority
      }, { transaction });
    }

    await transaction.commit();

    // Fetch full item details
    const fullItem = await item.getFullDetails();

    res.status(201).json({
      status: 'success',
      message: 'Item added to wishlist successfully',
      data: fullItem
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Remove item from wishlist
 * @route DELETE /api/v1/wishlists/:id/items/:itemId
 * @access Private
 */
const removeItemFromWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id, itemId } = req.params;
    const userId = req.user.id;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // Find and delete the item
    const item = await WishlistItem.findOne({
      where: {
        id: itemId,
        wishlist_id: id
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

/**
 * Update wishlist item
 * @route PUT /api/v1/wishlists/:id/items/:itemId
 * @access Private
 */
const updateWishlistItem = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id, itemId } = req.params;
    const userId = req.user.id;
    const { quantity, notes, priority } = req.body;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // Find and update the item
    const item = await WishlistItem.findOne({
      where: {
        id: itemId,
        wishlist_id: id
      },
      transaction
    });

    if (!item) {
      await transaction.rollback();
      return next(new AppError('Item not found in wishlist', 404));
    }

    await item.update({
      quantity,
      notes,
      priority
    }, { transaction });

    await transaction.commit();

    // Fetch updated item details
    const updatedItem = await item.getFullDetails();

    res.status(200).json({
      status: 'success',
      message: 'Wishlist item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get wishlist items
 * @route GET /api/v1/wishlists/:id/items
 * @access Private
 */
const getWishlistItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 10, priority, sort = 'added_at' } = req.query;
    const offset = (page - 1) * limit;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId }
    });

    if (!wishlist) {
      return next(new AppError('Wishlist not found', 404));
    }

    const whereClause = { wishlist_id: id };
    if (priority) {
      whereClause.priority = priority;
    }

    const orderBy = [];
    switch (sort) {
      case 'priority':
        orderBy.push(['priority', 'DESC']);
        break;
      case 'price':
        orderBy.push(['price', 'DESC']);
        break;
      case 'added_at':
      default:
        orderBy.push(['added_at', 'ASC']);
        break;
    }

    const { count, rows: items } = await WishlistItem.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price', 'status'],
          include: [
            {
              model: ProductVariant,
              as: 'variants',
              attributes: ['id', 'name', 'value', 'additional_price'],
              required: false
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: orderBy
    });

    res.status(200).json({
      status: 'success',
      results: items.length,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      },
      data: items
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserWishlists,
  getWishlist,
  createWishlist,
  updateWishlist,
  deleteWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  updateWishlistItem,
  getWishlistItems
};