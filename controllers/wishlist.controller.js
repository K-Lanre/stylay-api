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
        attributes: ['id', 'quantity', 'price', 'total_price', 'selected_variants', 'variant_id', 'priority', 'notes', 'added_at'],
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
          attributes: ['id', 'quantity', 'price', 'total_price', 'selected_variants', 'variant_id', 'priority', 'notes', 'added_at'],
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
  console.log('User:', req.user.id);
  
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
 * Enhanced to support both legacy variant_id and new selected_variants array
 * @route POST /api/v1/wishlists/:id/items
 * @access Private
 */
const addItemToWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      product_id,
      variant_id,
      selected_variants = [],
      quantity = 1,
      notes,
      priority = 'medium'
    } = req.body;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // Verify product exists with variants
    const product = await Product.findByPk(product_id, {
      include: [{
        model: ProductVariant,
        as: 'variants',
        required: false
      }],
      transaction
    });

    if (!product) {
      await transaction.rollback();
      return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'active') {
      await transaction.rollback();
      return next(new AppError('Product is not available', 400));
    }

    let finalSelectedVariants = [...selected_variants];
    let basePrice = product.price;
    let finalVariantId = null;

    // Handle multiple variants (new format)
    if (finalSelectedVariants.length > 0) {
      // Validate and calculate additional price
      const variantMap = new Map(
        product.variants.map((v) => [Number(v.id), v])
      );
      const seen = new Set();
      
      for (const sel of finalSelectedVariants) {
        const variantId = Number(sel.id);
        if (isNaN(variantId)) {
          await transaction.rollback();
          return next(new AppError("Invalid variant ID: must be a number", 400));
        }

        if (seen.has(variantId)) {
          await transaction.rollback();
          return next(new AppError("Duplicate variant ID in selected_variants", 400));
        }
        seen.add(variantId);

        const variant = variantMap.get(variantId);
        if (!variant) {
          await transaction.rollback();
          return next(new AppError(`Variant ${variantId} not found for product`, 404));
        }
      }
      finalVariantId = null; // Clear for multiple variants
    } else if (variant_id) {
      // Backward compatibility: single variant
      const variant = product.variants.find((v) => v.id === variant_id);
      if (!variant) {
        await transaction.rollback();
        return next(new AppError("Product variant not found", 404));
      }
      finalSelectedVariants = [
        {
          name: variant.name,
          id: variant.id,
          value: variant.value,
          additional_price: variant.additional_price || 0,
        },
      ];
      finalVariantId = variant_id;
    }

    const price = basePrice;

    // Sort variants for consistent comparison
    const sortedSelectedVariants = [...finalSelectedVariants].sort(
      (a, b) => a.id - b.id
    );

    // Check if item already exists (using new selected_variants)
    const existingItem = await WishlistItem.findOne({
      where: {
        wishlist_id: id,
        product_id,
        selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null
      },
      transaction,
    });

    let item;
    if (existingItem) {
      // Update existing item
      await existingItem.update(
        {
          quantity,
          notes,
          priority,
          price: basePrice,
          selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null,
          variant_id: finalVariantId
        },
        { transaction }
      );

      // Update total price
      await existingItem.updateTotalPrice(transaction);
      item = existingItem;
    } else {
      // Create new item
      const totalPrice = quantity * (basePrice + finalSelectedVariants.reduce((sum, v) => sum + (v.additional_price || 0), 0));
      
      item = await WishlistItem.create(
        {
          wishlist_id: id,
          product_id,
          selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null,
          quantity,
          price: basePrice,
          total_price: totalPrice,
          notes,
          priority,
          variant_id: finalVariantId
        },
        { transaction }
      );
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
      attributes: ['id', 'quantity', 'price', 'total_price', 'selected_variants', 'variant_id', 'priority', 'notes', 'added_at'],
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

/**
 * Get wishlist summary with totals
 * @route GET /api/v1/wishlists/:id/summary
 * @access Private
 */
const getWishlistSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      include: [
        {
          model: WishlistItem,
          as: 'items',
          attributes: ['id', 'quantity', 'price', 'total_price']
        }
      ]
    });

    if (!wishlist) {
      return next(new AppError('Wishlist not found', 404));
    }

    // Calculate summary
    const totalItems = wishlist.items.length;
    const totalQuantity = wishlist.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = wishlist.items.reduce((sum, item) => sum + item.total_price, 0);
    const averagePrice = totalItems > 0 ? totalAmount / totalItems : 0;

    const summary = {
      wishlist_id: wishlist.id,
      wishlist_name: wishlist.name,
      total_items: totalItems,
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      average_item_price: averagePrice,
      is_default: wishlist.is_default,
      is_public: wishlist.is_public,
      created_at: wishlist.created_at,
      updated_at: wishlist.updated_at
    };

    res.status(200).json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Move item from wishlist to cart
 * @route POST /api/v1/wishlists/:id/move-to-cart
 * @access Private
 */
const moveToCart = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { wishlist_item_id } = req.body;

    // Verify wishlist ownership
    const wishlist = await Wishlist.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!wishlist) {
      await transaction.rollback();
      return next(new AppError('Wishlist not found', 404));
    }

    // Find the wishlist item
    const item = await WishlistItem.findOne({
      where: {
        id: wishlist_item_id,
        wishlist_id: id
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'status']
        }
      ],
      transaction
    });

    if (!item) {
      await transaction.rollback();
      return next(new AppError('Item not found in wishlist', 404));
    }

    if (item.product.status !== 'active') {
      await transaction.rollback();
      return next(new AppError('Product is not available for purchase', 400));
    }

    // Import Cart model
    const { Cart, CartItem } = require('../models');
    
    // Find or create user's cart
    let cart = await Cart.findOne({
      where: { user_id: userId },
      transaction
    });

    if (!cart) {
      cart = await Cart.create({
        user_id: userId,
        session_id: null
      }, { transaction });
    }

    // Check if item already exists in cart (using selected_variants)
    const existingCartItem = await CartItem.findOne({
      where: {
        cart_id: cart.id,
        product_id: item.product_id,
        selected_variants: item.selected_variants
      },
      transaction
    });

    if (existingCartItem) {
      // Update existing cart item quantity
      await existingCartItem.update({
        quantity: existingCartItem.quantity + item.quantity
      }, { transaction });
    } else {
      // Create new cart item
      await CartItem.create({
        cart_id: cart.id,
        product_id: item.product_id,
        selected_variants: item.selected_variants,
        quantity: item.quantity,
        price: item.price,
        total_price: item.total_price
      }, { transaction });
    }

    // Remove item from wishlist
    await item.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Item moved to cart successfully',
      data: {
        cart_id: cart.id,
        moved_item_id: item.id,
        product_name: item.product.name
      }
    });
  } catch (error) {
    await transaction.rollback();
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
  getWishlistItems,
  getWishlistSummary,
  moveToCart
};