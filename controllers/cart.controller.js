const { Cart, CartItem, Product, ProductVariant, User } = require("../models");
const AppError = require("../utils/appError");
const { Op } = require("sequelize");

/**
 * Get or create shopping cart for authenticated user
 * Supports both authenticated users (with user_id) and guest users (with session_id).
 * Returns full cart details including items, products, and variants with proper associations.
 *
 * @param {import('express').Request} req - Express request object
 * @param {string} [req.headers['x-session-id']] - Session ID for guest carts (optional)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with cart data
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Cart object with items, totals, and product details
 * @returns {Object} res.body.data.cart - Cart details (null if no cart found)
 * @throws {Error} 500 - Server error during cart retrieval
 * @api {get} /api/v1/cart Get cart
 * @private Supports both authenticated and guest users
 * @example
 * GET /api/v1/cart
 * Authorization: Bearer <jwt_token>
 *
 * // For guest users:
 * GET /api/v1/cart
 * x-session-id: abc123def456
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
          total_amount: 0.0,
        },
      });

      // Load full cart details
      cart = await cart.getFullCart();
    } else {
      // Handle guest cart using session_id
      const sessionId = req.session?.id || req.headers["x-session-id"];

      if (!sessionId) {
        return res.status(200).json({
          status: "success",
          data: {
            cart: null,
            message: "No cart found. Please log in or provide session ID.",
          },
        });
      }

      cart = await Cart.findOne({
        where: { session_id: sessionId },
      });

      if (!cart) {
        return res.status(200).json({
          status: "success",
          data: {
            cart: null,
            message: "No cart found for this session.",
          },
        });
      }

      // Load full cart details consistently
      cart = await cart.getFullCart();
    }

    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add item to shopping cart
 * Validates product availability, handles quantity updates, and supports product variants.
 * Uses database transactions to ensure data consistency. Updates cart totals automatically.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {number} req.body.productId - Product ID to add (required)
 * @param {number} [req.body.quantity=1] - Quantity to add (default: 1)
 * @param {number} [req.body.variantId] - Product variant ID (optional)
 * @param {string} [req.headers['x-session-id']] - Session ID for guest carts
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with added/updated item
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Item details with product and variant information
 * @throws {AppError} 400 - Missing productId, invalid quantity, or insufficient stock
 * @throws {AppError} 404 - Product or variant not found
 * @throws {Error} 500 - Server error during cart operation
 * @api {post} /api/v1/cart/items Add item to cart
 * @private Supports both authenticated and guest users
 * @example
 * POST /api/v1/cart/items
 * Authorization: Bearer <jwt_token>
 * {
 *   "productId": 123,
 *   "quantity": 2,
 *   "variantId": 456
 * }
 *
 * // For guest users:
 * POST /api/v1/cart/items
 * x-session-id: abc123def456
 * {
 *   "productId": 123,
 *   "quantity": 1
 * }
 */
const addToCart = async (req, res, next) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    const userId = req.user?.id;
    const {
      product_id,
      quantity = 1,
      variant_id,
      selected_variants = [],
    } = req.body;

    // Validate required fields
    if (!product_id) {
      return next(new AppError("Product ID is required", 400));
    }

    // Fetch product with all variants
    const product = await Product.findByPk(product_id, {
      include: [
        {
          model: ProductVariant,
          as: "variants",
          required: false,
        },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    if (product.status !== "active") {
      return next(new AppError("Product is not available", 400));
    }

    let finalSelectedVariants = [...selected_variants];
    let basePrice = product.price;
    let totalAdditionalPrice = 0;
    let finalVariantId = null;

    if (finalSelectedVariants.length > 0) {
      // Validate and calculate additional price
      const variantMap = new Map(
        product.variants.map((v) => [Number(v.id), v])
      ); // Ensure ID is treated as number
      const seen = new Set();
      for (const sel of finalSelectedVariants) {
        // Ensure sel.id is treated as a number
        const variantId = Number(sel.id);
        if (isNaN(variantId)) {
          return next(
            new AppError("Invalid variant ID: must be a number", 400)
          );
        }

        if (seen.has(variantId)) {
          return next(
            new AppError("Duplicate variant ID in selected_variants", 400)
          );
        }
        seen.add(variantId);

        const variant = variantMap.get(variantId);
        if (!variant) {
          return next(
            new AppError(`Variant ${variantId} not found for product`, 404)
          );
        }
        if (variant.stock !== null && variant.stock < quantity) {
          return next(
            new AppError(
              `Low stock for ${sel.value}: ${variant.stock} available`,
              400
            )
          );
        }
        totalAdditionalPrice += sel.additional_price || 0;
      }
      finalVariantId = null;
    } else if (variant_id) {
      // Backward compatibility: single variant
      const variant = product.variants.find((v) => v.id === variant_id);
      if (!variant) {
        return next(new AppError("Product variant not found", 404));
      }
      if (variant.stock !== null && variant.stock < quantity) {
        return next(
          new AppError(`Low stock for variant: ${variant.stock} available`, 400)
        );
      }
      finalSelectedVariants = [
        {
          name: variant.name,
          id: variant.id,
          value: variant.value,
          additional_price: variant.additional_price || 0,
        },
      ];
      totalAdditionalPrice = variant.additional_price || 0;
      finalVariantId = null;
    } else {
      // No variants, check product inventory if applicable
      const inventory = await product.getInventory();
      if (inventory && inventory.stock !== null && inventory.stock < quantity) {
        return next(
          new AppError(
            `Low stock for product: ${inventory.stock} available`,
            400
          )
        );
      }
    }

    const price = basePrice + totalAdditionalPrice;

    // Sort variants for consistent string
    const sortedSelectedVariants = [...finalSelectedVariants].sort(
      (a, b) => a.id - b.id
    );

    // Get or create cart
    let cart;
    if (userId) {
      [cart] = await Cart.findOrCreate({
        where: { user_id: userId },
        defaults: {
          total_items: 0,
          total_amount: 0.0,
        },
        transaction,
      });
    } else {
      // Handle guest cart
      const sessionId =
        req.session?.id || req.headers["x-session-id"] || `guest_${Date.now()}`;
      [cart] = await Cart.findOrCreate({
        where: { session_id: sessionId },
        defaults: {
          total_items: 0,
          total_amount: 0.0,
        },
        transaction,
      });
    }

    // Lock the cart row to prevent concurrent updates
    await cart.reload({ lock: true, transaction });

    // Check if item already exists in cart
    const existingItem = await CartItem.findOne({
      where: {
        cart_id: cart.id,
        product_id: product_id,
        selected_variants: sortedSelectedVariants,
      },
      transaction,
    });

    if (existingItem) {
      // Update quantity if item exists
      const newQuantity = existingItem.quantity + quantity;
      await existingItem.update(
        {
          quantity: newQuantity,
        },
        { transaction }
      );

      await existingItem.updateTotalPrice(transaction);

      await transaction.commit();

      const item = await existingItem.getFullDetails();

      return res.status(200).json({
        status: "success",
        message: "Cart item updated successfully",
        data: { item },
      });
    }

    // Create new cart item
    const cartItem = await CartItem.create(
      {
        cart_id: cart.id,
        product_id: product_id,
        selected_variants: sortedSelectedVariants,
        quantity: quantity,
        price: basePrice,
        total_price: quantity * price,
      },
      { transaction }
    );

    await transaction.commit();

    // Get full item details
    const item = await cartItem.getFullDetails();

    res.status(201).json({
      status: "success",
      message: "Item added to cart successfully",
      data: { item },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Update cart item quantity
 * Validates new quantity, checks ownership, and updates cart totals.
 * Uses database transactions for data consistency.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.itemId - Cart item ID to update
 * @param {import('express').Request.body} req.body - Request body
 * @param {number} req.body.quantity - New quantity (must be >= 1)
 * @param {string} [req.headers['x-session-id']] - Session ID for guest carts
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated item
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Updated item details
 * @throws {AppError} 400 - Invalid quantity (less than 1)
 * @throws {AppError} 403 - Access denied (item doesn't belong to user)
 * @throws {AppError} 404 - Cart item not found
 * @throws {Error} 500 - Server error during update
 * @api {put} /api/v1/cart/items/:itemId Update cart item
 * @private Supports both authenticated and guest users
 * @example
 * PUT /api/v1/cart/items/789
 * Authorization: Bearer <jwt_token>
 * {
 *   "quantity": 3
 * }
 *
 * // For guest users:
 * PUT /api/v1/cart/items/789
 * x-session-id: abc123def456
 * {
 *   "quantity": 1
 * }
 */
const updateCartItem = async (req, res, next) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user?.id;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return next(new AppError("Quantity must be at least 1", 400));
    }

    // Find cart item
    const cartItem = await CartItem.findByPk(itemId, {
      include: [
        {
          model: Cart,
          as: "cart",
          include: [{ model: User, as: "user" }],
        },
      ],
      transaction,
    });

    if (!cartItem) {
      return next(new AppError("Cart item not found", 404));
    }

    // Check if user owns the cart (if authenticated)
    if (userId && cartItem.cart.user_id !== userId) {
      return next(new AppError("Access denied", 403));
    }

    // Handle guest cart access
    if (!userId) {
      const sessionId = req.session?.id || req.headers["x-session-id"];
      if (cartItem.cart.session_id !== sessionId) {
        return next(new AppError("Access denied", 403));
      }
    }

    // Lock the cart row to prevent concurrent updates
    await cartItem.cart.reload({ lock: true, transaction });

    // Update item quantity
    await cartItem.update(
      {
        quantity: quantity,
      },
      { transaction }
    );

    await cartItem.updateTotalPrice(transaction);

    const updatedItem = await cartItem.getFullDetails();

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Cart item updated successfully",
      data: { item: updatedItem },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Remove item from cart
 * Validates ownership and updates cart totals after removal.
 * Uses database transactions for data consistency.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.itemId - Cart item ID to remove
 * @param {string} [req.headers['x-session-id']] - Session ID for guest carts
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming removal
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Removed item ID
 * @throws {AppError} 403 - Access denied (item doesn't belong to user)
 * @throws {AppError} 404 - Cart item not found
 * @throws {Error} 500 - Server error during removal
 * @api {delete} /api/v1/cart/items/:itemId Remove cart item
 * @private Supports both authenticated and guest users
 * @example
 * DELETE /api/v1/cart/items/789
 * Authorization: Bearer <jwt_token>
 *
 * // For guest users:
 * DELETE /api/v1/cart/items/789
 * x-session-id: abc123def456
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
          as: "cart",
          include: [{ model: User, as: "user" }],
        },
      ],
      transaction,
    });

    if (!cartItem) {
      return next(new AppError("Cart item not found", 404));
    }

    // Check if user owns the cart (if authenticated)
    if (userId && cartItem.cart.user_id !== userId) {
      return next(new AppError("Access denied", 403));
    }

    // Handle guest cart access
    if (!userId) {
      const sessionId = req.session?.id || req.headers["x-session-id"];
      if (cartItem.cart.session_id !== sessionId) {
        return next(new AppError("Access denied", 403));
      }
    }

    // Lock the cart row to prevent concurrent updates
    await cartItem.cart.reload({ lock: true, transaction });

    // Delete the cart item
    await cartItem.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Item removed from cart successfully",
      data: { itemId: parseInt(itemId) },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Clear all items from cart
 * Removes all cart items and resets cart totals to zero.
 * Uses database transactions for data consistency.
 *
 * @param {import('express').Request} req - Express request object
 * @param {string} [req.headers['x-session-id']] - Session ID for guest carts (required for guests)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming cart clearance
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Cart ID that was cleared
 * @throws {AppError} 400 - Session ID required for guest carts
 * @throws {AppError} 404 - Cart not found
 * @throws {Error} 500 - Server error during clearance
 * @api {delete} /api/v1/cart/clear Clear cart
 * @private Supports both authenticated and guest users
 * @example
 * DELETE /api/v1/cart/clear
 * Authorization: Bearer <jwt_token>
 *
 * // For guest users:
 * DELETE /api/v1/cart/clear
 * x-session-id: abc123def456
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
        transaction,
      });

      if (!cart) {
        return next(new AppError("Cart not found", 404));
      }
    } else {
      // Handle guest cart
      const sessionId = req.session?.id || req.headers["x-session-id"];
      if (!sessionId) {
        return next(new AppError("Session ID required for guest cart", 400));
      }

      cart = await Cart.findOne({
        where: { session_id: sessionId },
        transaction,
      });

      if (!cart) {
        return next(new AppError("Cart not found", 404));
      }
    }

    // Lock the cart row to prevent concurrent updates
    await cart.reload({ lock: true, transaction });

    // Delete all cart items
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction,
    });

    // Reset cart totals
    await cart.update(
      {
        total_items: 0,
        total_amount: 0.0,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Cart cleared successfully",
      data: { cartId: cart.id },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Get cart summary for checkout
 * Provides comprehensive cart information including totals, shipping, and tax calculations.
 * Used primarily during the checkout process to display final pricing.
 *
 * @param {import('express').Request} req - Express request object
 * @param {string} [req.headers['x-session-id']] - Session ID for guest carts
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with cart summary
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Cart summary object
 * @returns {number} res.body.data.subtotal - Sum of all item subtotals
 * @returns {number} res.body.data.shipping - Shipping cost (currently 0.00)
 * @returns {number} res.body.data.tax - Tax amount (currently 0.00)
 * @returns {number} res.body.data.total - Final total amount
 * @returns {Array} res.body.data.items - Array of cart items with product details
 * @throws {Error} 500 - Server error during summary calculation
 * @api {get} /api/v1/cart/summary Get cart summary
 * @private Supports both authenticated and guest users
 * @example
 * GET /api/v1/cart/summary
 * Authorization: Bearer <jwt_token>
 *
 * // Response includes:
 * {
 *   "status": "success",
 *   "data": {
 *     "subtotal": 150.00,
 *     "shipping": 0.00,
 *     "tax": 0.00,
 *     "total": 150.00,
 *     "items": [...]
 *   }
 * }
 */
const getCartSummary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    let cart;

    if (userId) {
      cart = await Cart.findOne({
        where: { user_id: userId },
        include: [
          {
            model: CartItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
                attributes: [
                  "id",
                  "name",
                  "thumbnail",
                  "price",
                  "discounted_price",
                ],
              },
            ],
          },
        ],
      });
    } else {
      const sessionId = req.session?.id || req.headers["x-session-id"];
      if (!sessionId) {
        return res.status(200).json({
          status: "success",
          data: {
            summary: null,
            message: "No cart found. Please log in or provide session ID.",
          },
        });
      }

      cart = await Cart.findOne({
        where: { session_id: sessionId },
        include: [
          {
            model: CartItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
                attributes: [
                  "id",
                  "name",
                  "thumbnail",
                  "price",
                  "discounted_price",
                ],
              },
            ],
          },
        ],
      });
    }

    if (!cart) {
      return res.status(200).json({
        status: "success",
        data: {
          summary: null,
          message: "Cart is empty",
        },
      });
    }

    // Calculate summary
    const items = cart.items || [];
    const subtotal = parseFloat(cart.total_amount);
    const shipping = 0.0; // TODO: Calculate shipping based on location
    const tax = 0.0; // TODO: Calculate tax based on location
    const total = subtotal + shipping + tax;

    const summary = {
      cartId: cart.id,
      totalItems: cart.total_items,
      subtotal,
      shipping,
      tax,
      total,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product.name,
        thumbnail: item.product.thumbnail,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.total_price,
      })),
    };

    res.status(200).json({
      status: "success",
      data: summary,
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
  getCartSummary,
};
