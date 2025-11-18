const { Wishlist, WishlistItem, Product, ProductVariant, User } = require('../models');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');

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
      name: 'My Wishlist',
      description: 'My personal wishlist',
      is_public: false,
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
 * Enhanced to support both legacy variant_id and new selected_variants array
 * @route POST /api/v1/wishlist/items
 * @access Private
 */
const addItemToWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      product_id,
      variant_id,
      selected_variants = [],
      quantity = 1,
      notes,
      priority = 'medium'
    } = req.body;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId, transaction);

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
        wishlist_id: wishlist.id,
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
          wishlist_id: wishlist.id,
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

/**
 * Update wishlist item in user's single wishlist
 * @route PATCH /api/v1/wishlist/items/:itemId
 * @access Private
 */
const updateWishlistItem = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const { itemId } = req.params;
    const userId = req.user.id;
    const {
      quantity,
      notes,
      priority,
      selected_variants = [],
      variant_id
    } = req.body;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId, transaction);

    // Find and update the item
    const item = await WishlistItem.findOne({
      where: {
        id: itemId,
        wishlist_id: wishlist.id
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price'],
          include: [
            {
              model: ProductVariant,
              as: 'variants',
              required: false
            }
          ]
        }
      ],
      transaction
    });

    if (!item) {
      await transaction.rollback();
      return next(new AppError('Item not found in wishlist', 404));
    }

    let finalSelectedVariants = [...selected_variants];
    let finalVariantId = null;
    let basePrice = item.product.price;

    // Handle multiple variants (new format)
    if (finalSelectedVariants.length > 0) {
      // Validate and calculate additional price
      const variantMap = new Map(
        item.product.variants.map((v) => [Number(v.id), v])
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
      const variant = item.product.variants.find((v) => v.id === variant_id);
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

    // Sort variants for consistent comparison
    const sortedSelectedVariants = [...finalSelectedVariants].sort(
      (a, b) => a.id - b.id
    );

    // Calculate new total price
    const newTotalPrice = quantity * (basePrice + finalSelectedVariants.reduce((sum, v) => sum + (v.additional_price || 0), 0));

    // Update the item with all fields
    await item.update({
      quantity,
      notes,
      priority,
      selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null,
      variant_id: finalVariantId,
      total_price: newTotalPrice
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
 * Get wishlist items from user's single wishlist
 * @route GET /api/v1/wishlist/items
 * @access Private
 */
const getWishlistItems = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, priority, sort = 'added_at' } = req.query;
    const offset = (page - 1) * limit;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId);

    const whereClause = { wishlist_id: wishlist.id };
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
 * Get wishlist summary with totals from user's single wishlist
 * @route GET /api/v1/wishlist/summary
 * @access Private
 */
const getWishlistSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId);

    const wishlistWithItems = await Wishlist.findOne({
      where: { id: wishlist.id },
      include: [
        {
          model: WishlistItem,
          as: 'items',
          attributes: ['id', 'quantity', 'price', 'total_price']
        }
      ]
    });

    // Calculate summary
    const totalItems = wishlistWithItems.items.length;
    const totalQuantity = wishlistWithItems.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = wishlistWithItems.items.reduce((sum, item) => sum + item.total_price, 0);
    const averagePrice = totalItems > 0 ? totalAmount / totalItems : 0;

    const summary = {
      wishlist_id: wishlist.id,
      wishlist_name: wishlist.name,
      total_items: totalItems,
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      average_item_price: averagePrice,
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
 * Clear all items from user's single wishlist
 * @route DELETE /api/v1/wishlist/clear
 * @access Private
 */
const clearWishlist = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const userId = req.user.id;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId, transaction);

    // Delete all items from the wishlist
    await WishlistItem.destroy({
      where: { wishlist_id: wishlist.id },
      transaction
    });

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Wishlist cleared successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get wishlist statistics
 * @route GET /api/v1/wishlist/stats
 * @access Private
 */
const getWishlistStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId);

    const { count: totalItems, rows: items } = await WishlistItem.findAndCountAll({
      where: { wishlist_id: wishlist.id },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'discounted_price', 'status']
        }
      ]
    });

    // Calculate statistics
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
    
    const priorityStats = {
      high: items.filter(item => item.priority === 'high').length,
      medium: items.filter(item => item.priority === 'medium').length,
      low: items.filter(item => item.priority === 'low').length
    };

    const statusStats = {
      active: items.filter(item => item.product.status === 'active').length,
      inactive: items.filter(item => item.product.status === 'inactive').length
    };

    const averagePrice = totalItems > 0 ? totalAmount / totalItems : 0;

    const stats = {
      total_items: totalItems,
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      average_item_price: averagePrice,
      priority_distribution: priorityStats,
      status_distribution: statusStats,
      wishlist_age_days: Math.floor((new Date() - new Date(wishlist.created_at)) / (1000 * 60 * 60 * 24))
    };

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get wishlist analytics
 * @route GET /api/v1/wishlist/analytics
 * @access Private
 */
const getWishlistAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId);

    const items = await WishlistItem.findAll({
      where: { wishlist_id: wishlist.id },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'category_id'],
          include: [
            {
              model: require('../models').Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['added_at', 'DESC']]
    });

    // Category analysis
    const categoryStats = {};
    items.forEach(item => {
      const categoryName = item.product.category?.name || 'Uncategorized';
      if (!categoryStats[categoryName]) {
        categoryStats[categoryName] = {
          count: 0,
          total_value: 0,
          items: []
        };
      }
      categoryStats[categoryName].count++;
      categoryStats[categoryName].total_value += item.total_price;
      categoryStats[categoryName].items.push({
        id: item.id,
        product_name: item.product.name,
        price: item.total_price,
        added_at: item.added_at
      });
    });

    // Priority analysis
    const priorityAnalysis = {
      high: items.filter(item => item.priority === 'high').length,
      medium: items.filter(item => item.priority === 'medium').length,
      low: items.filter(item => item.priority === 'low').length
    };

    // Time-based analysis
    const now = new Date();
    const last7Days = items.filter(item => {
      const itemDate = new Date(item.added_at);
      return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000);
    }).length;

    const last30Days = items.filter(item => {
      const itemDate = new Date(item.added_at);
      return (now - itemDate) <= (30 * 24 * 60 * 60 * 1000);
    }).length;

    // Price range analysis
    const priceRanges = {
      'under_25': items.filter(item => item.total_price < 25).length,
      '25_to_50': items.filter(item => item.total_price >= 25 && item.total_price < 50).length,
      '50_to_100': items.filter(item => item.total_price >= 50 && item.total_price < 100).length,
      'over_100': items.filter(item => item.total_price >= 100).length
    };

    const analytics = {
      category_breakdown: categoryStats,
      priority_analysis: priorityAnalysis,
      time_based_activity: {
        items_added_last_7_days: last7Days,
        items_added_last_30_days: last30Days,
        total_active_days: Math.floor((now - new Date(wishlist.created_at)) / (1000 * 60 * 60 * 24))
      },
      price_range_distribution: priceRanges,
      total_unique_products: new Set(items.map(item => item.product_id)).size,
      most_expensive_item: items.length > 0 ? Math.max(...items.map(item => item.total_price)) : 0,
      least_expensive_item: items.length > 0 ? Math.min(...items.map(item => item.total_price)) : 0
    };

    res.status(200).json({
      status: 'success',
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Move item from wishlist to cart
 * @route POST /api/v1/wishlist/items/:id/move-to-cart
 * @access Private
 */
const moveToCart = async (req, res, next) => {
  const transaction = await Wishlist.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id: itemId } = req.params;

    // Get or create user's single wishlist
    const wishlist = await getOrCreateUserWishlist(userId, transaction);

    // Find the wishlist item
    const item = await WishlistItem.findOne({
      where: {
        id: itemId,
        wishlist_id: wishlist.id
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
  getUserWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  updateWishlistItem,
  getWishlistItems,
  getWishlistSummary,
  clearWishlist,
  getWishlistStats,
  getWishlistAnalytics,
  moveToCart,
  getOrCreateUserWishlist
};