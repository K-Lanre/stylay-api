const { Cart, CartItem, Product, ProductVariant, User } = require('../models');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');

/**
 * Get or create cart for authenticated user
 * @route GET /api/v1/cart
 * @access Private
 */
const getCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    let cart;

    if (userId) {
      // Get or create cart for authenticated user
      [cart] = await Cart.findOrCreate({
        where: { user_id: userId },
        defaults: {
          total_items: 0,
          total_amount: 0.00
        }
      });

      // Load full cart details
      cart = await cart.getFullCart();
    } else {
      // Handle guest cart using session_id
      const sessionId = req.session?.id || req.headers['x-session-id'];

      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            cart: null,
            message: 'No cart found. Please log in or provide session ID.'
          }
        });
      }

      cart = await Cart.findOne({
        where: { session_id: sessionId },
        include: [
          {
            model: CartItem,
            as: 'items',
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
              },
              {
                model: ProductVariant,
                as: 'variant',
                attributes: ['id', 'name', 'value', 'additional_price'],
                required: false
              }
            ]
          }
        ]
      });

      if (!cart) {
        return res.status(200).json({
          status: 'success',
          data: {
            cart: null,
            message: 'No cart found for this session.'
          }
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add item to cart
 * @route POST /api/v1/cart/items
 * @access Private
 */
const addToCart = async (req, res, next) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    const userId = req.user?.id;
    const { productId, quantity = 1, variantId } = req.body;

    // Validate required fields
    if (!productId) {
      return next(new AppError('Product ID is required', 400));
    }

    // Get product with variant if specified
    const product = await Product.findByPk(productId, {
      include: variantId ? [{
        model: ProductVariant,
        as: 'variants',
        where: { id: variantId },
        required: true // This ensures the variant exists
      }] : []
    });

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'active') {
      return next(new AppError('Product is not available', 400));
    }

    // Check if variant exists when variantId is provided
    if (variantId && (!product.variants || product.variants.length === 0)) {
      return next(new AppError('Product variant not found', 404));
    }

    // Calculate price (use variant price if available, otherwise product price)
    const price = variant ? (variant.additional_price || product.price) : product.price;

    // Get or create cart
    let cart;
    if (userId) {
      [cart] = await Cart.findOrCreate({
        where: { user_id: userId },
        defaults: {
          total_items: 0,
          total_amount: 0.00
        },
        transaction
      });
    } else {
      // Handle guest cart
      const sessionId = req.session?.id || req.headers['x-session-id'] || `guest_${Date.now()}`;
      [cart] = await Cart.findOrCreate({
        where: { session_id: sessionId },
        defaults: {
          total_items: 0,
          total_amount: 0.00
        },
        transaction
      });
    }

    // Check if item already exists in cart
    const existingItem = await CartItem.findOne({
      where: {
        cart_id: cart.id,
        product_id: productId,
        variant_id: variantId || null
      },
      transaction
    });

    if (existingItem) {
      // Update quantity if item exists
      const newQuantity = existingItem.quantity + quantity;
      await existingItem.update({
        quantity: newQuantity,
        total_price: newQuantity * price
      }, { transaction });

      const item = await existingItem.getFullDetails();
      await transaction.commit();

      return res.status(200).json({
        status: 'success',
        message: 'Cart item updated successfully',
        data: { item }
      });
    }

    // Create new cart item
    const cartItem = await CartItem.create({
      cart_id: cart.id,
      product_id: productId,
      variant_id: variantId || null,
      quantity: quantity,
      price: price,
      total_price: quantity * price
    }, { transaction });

    // Update cart totals
    await cart.updateTotals();

    // Get full item details
    const item = await cartItem.getFullDetails();

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      message: 'Item added to cart successfully',
      data: { item }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Update cart item quantity
 * @route PUT /api/v1/cart/items/:itemId
 * @access Private
 */
const updateCartItem = async (req, res, next) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user?.id;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return next(new AppError('Quantity must be at least 1', 400));
    }

    // Find cart item
    const cartItem = await CartItem.findByPk(itemId, {
      include: [
        {
          model: Cart,
          as: 'cart',
          include: [{ model: User, as: 'user' }]
        }
      ],
      transaction
    });

    if (!cartItem) {
      return next(new AppError('Cart item not found', 404));
    }

    // Check if user owns the cart (if authenticated)
    if (userId && cartItem.cart.user_id !== userId) {
      return next(new AppError('Access denied', 403));
    }

    // Handle guest cart access
    if (!userId) {
      const sessionId = req.session?.id || req.headers['x-session-id'];
      if (cartItem.cart.session_id !== sessionId) {
        return next(new AppError('Access denied', 403));
      }
    }

    // Update item quantity
    await cartItem.update({
      quantity: quantity,
      total_price: quantity * cartItem.price
    }, { transaction });

    // Update cart totals
    await cartItem.cart.updateTotals();

    const updatedItem = await cartItem.getFullDetails();

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Cart item updated successfully',
      data: { item: updatedItem }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Remove item from cart
 * @route DELETE /api/v1/cart/items/:itemId
 * @access Private
 */
const removeFromCart = async (req, res, next) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    const { itemId } = req.params;
    const userId = req.user?.id;

    // Find cart item
    const cartItem = await CartItem.findByPk(itemId, {
      include: [
        {
          model: Cart,
          as: 'cart',
          include: [{ model: User, as: 'user' }]
        }
      ],
      transaction
    });

    if (!cartItem) {
      return next(new AppError('Cart item not found', 404));
    }

    // Check if user owns the cart (if authenticated)
    if (userId && cartItem.cart.user_id !== userId) {
      return next(new AppError('Access denied', 403));
    }

    // Handle guest cart access
    if (!userId) {
      const sessionId = req.session?.id || req.headers['x-session-id'];
      if (cartItem.cart.session_id !== sessionId) {
        return next(new AppError('Access denied', 403));
      }
    }

    // Delete the cart item
    await cartItem.destroy({ transaction });

    // Update cart totals
    await cartItem.cart.updateTotals();

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Item removed from cart successfully',
      data: { itemId: parseInt(itemId) }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Clear all items from cart
 * @route DELETE /api/v1/cart/clear
 * @access Private
 */
const clearCart = async (req, res, next) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    const userId = req.user?.id;
    let cart;

    if (userId) {
      // Clear authenticated user's cart
      cart = await Cart.findOne({
        where: { user_id: userId },
        transaction
      });

      if (!cart) {
        return next(new AppError('Cart not found', 404));
      }
    } else {
      // Handle guest cart
      const sessionId = req.session?.id || req.headers['x-session-id'];
      if (!sessionId) {
        return next(new AppError('Session ID required for guest cart', 400));
      }

      cart = await Cart.findOne({
        where: { session_id: sessionId },
        transaction
      });

      if (!cart) {
        return next(new AppError('Cart not found', 404));
      }
    }

    // Delete all cart items
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction
    });

    // Reset cart totals
    await cart.update({
      total_items: 0,
      total_amount: 0.00
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Cart cleared successfully',
      data: { cartId: cart.id }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get cart summary (for checkout)
 * @route GET /api/v1/cart/summary
 * @access Private
 */
const getCartSummary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    let cart;

    if (userId) {
      cart = await Cart.findOne({
        where: { user_id: userId },
        include: [{
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'thumbnail', 'price', 'discounted_price']
            },
            {
              model: ProductVariant,
              as: 'variant',
              attributes: ['id', 'name', 'value'],
              required: false
            }
          ]
        }]
      });
    } else {
      const sessionId = req.session?.id || req.headers['x-session-id'];
      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            summary: null,
            message: 'No cart found. Please log in or provide session ID.'
          }
        });
      }

      cart = await Cart.findOne({
        where: { session_id: sessionId },
        include: [{
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'thumbnail', 'price', 'discounted_price']
            },
            {
              model: ProductVariant,
              as: 'variant',
              attributes: ['id', 'name', 'value'],
              required: false
            }
          ]
        }]
      });
    }

    if (!cart) {
      return res.status(200).json({
        status: 'success',
        data: {
          summary: null,
          message: 'Cart is empty'
        }
      });
    }

    // Calculate summary
    const items = cart.items || [];
    const subtotal = parseFloat(cart.total_amount);
    const shipping = 0.00; // TODO: Calculate shipping based on location
    const tax = 0.00; // TODO: Calculate tax based on location
    const total = subtotal + shipping + tax;

    const summary = {
      cartId: cart.id,
      totalItems: cart.total_items,
      subtotal,
      shipping,
      tax,
      total,
      items: items.map(item => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product.name,
        variantName: item.variant?.name || null,
        variantValue: item.variant?.value || null,
        thumbnail: item.product.thumbnail,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.total_price
      }))
    };

    res.status(200).json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
};