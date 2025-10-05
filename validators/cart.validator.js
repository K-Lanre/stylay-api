const { body, param, query } = require('express-validator');
const { Product, ProductVariant, Cart, CartItem } = require('../models');
const { Op } = require('sequelize');

// Validation for getting cart
/**
 * Validation rules for retrieving cart contents.
 * Validates optional query parameters for cart retrieval.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} include_items - Optional boolean to include cart items
 * @returns {Array} Express validator middleware array for cart retrieval
 * @example
 * // Use in route:
 * router.get('/cart', getCartValidation, getCart);
 */
exports.getCartValidation = [
  // Optional query parameters for pagination (if needed in future)
  query('include_items')
    .optional()
    .isBoolean()
    .withMessage('include_items must be a boolean value')
];

// Validation for adding item to cart
/**
 * Validation rules for adding items to cart.
 * Validates product existence, stock availability, quantity limits, and variant details.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} product_id - Required, positive integer, validates product exists and is active
 * @property {ValidationChain} quantity - Required, 1-100, validates stock availability
 * @property {ValidationChain} variant_id - Optional, validates variant belongs to product
 * @property {ValidationChain} price - Optional, validates price matches product/variant pricing
 * @returns {Array} Express validator middleware array for adding cart items
 * @example
 * // Use in route:
 * router.post('/cart/items', addToCartValidation, addToCart);
 */
exports.addToCartValidation = [
  body('product_id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer')
    .custom(async (value) => {
      const product = await Product.findByPk(value);
      if (!product) {
        throw new Error('Product not found');
      }
      if (product.status !== 'active') {
        throw new Error('Product is not available for purchase');
      }
      return true;
    }),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100')
    .custom(async (value, { req }) => {
      if (req.body.selected_variants && Array.isArray(req.body.selected_variants) && req.body.selected_variants.length > 0) {
        return true; // Stock check handled in selected_variants validation
      }
      // Check if variant has sufficient stock if variant_id is provided
      if (req.body.variant_id) {
        const variant = await ProductVariant.findByPk(req.body.variant_id);
        if (!variant) {
          throw new Error('Product variant not found');
        }
        if (variant.stock !== null && variant.stock < value) {
          throw new Error(`Insufficient stock for this variant. Available: ${variant.stock}`);
        }
      } else {
        // Check main product stock
        const product = await Product.findByPk(req.body.product_id);
        if (product) {
          const inventory = await product.getInventory();
          if (inventory && inventory.stock < value) {
            throw new Error(`Insufficient stock for this product. Available: ${inventory.stock}`);
          }
        }
      }
      return true;
    }),

  body('variant_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Variant ID must be a positive integer')
    .custom(async (value, { req }) => {
      if (req.body.selected_variants && Array.isArray(req.body.selected_variants) && req.body.selected_variants.length > 0 && value) {
        throw new Error('Cannot specify both variant_id and selected_variants');
      }
      if (value) {
        const variant = await ProductVariant.findOne({
          where: { id: value, product_id: req.body.product_id }
        });
        if (!variant) {
          throw new Error('Product variant not found for the specified product');
        }
        return true;
      }
      return true;
    }),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
    .custom(async (value, { req }) => {
      if (value) {
        const product = await Product.findByPk(req.body.product_id);
        if (!product) {
          throw new Error('Product not found');
        }

        if (req.body.variant_id) {
          const variant = await ProductVariant.findByPk(req.body.variant_id);
          if (variant && variant.additional_price) {
            const expectedPrice = product.price + variant.additional_price;
            if (Math.abs(value - expectedPrice) > 0.01) {
              throw new Error('Price does not match variant pricing');
            }
          }
        } else {
          if (Math.abs(value - product.price) > 0.01) {
            throw new Error('Price does not match product pricing');
          }
        }
      }
      return true;
    }),
    body('selected_variants')
      .optional()
      .isArray({ min: 0 })
      .withMessage('Selected variants must be an array')
      .custom(async (value, { req }) => {
        if (!Array.isArray(value) || value.length === 0) return true;
        const productId = req.body.product_id;
        if (!productId) throw new Error('Product ID required for selected variants');

        // Ensure productId is a number
        const numericProductId = Number(productId);
        if (isNaN(numericProductId)) {
          throw new Error('Invalid product ID');
        }

        const productVariants = await ProductVariant.findAll({ where: { product_id: numericProductId } });
        const variantMap = new Map(productVariants.map(v => [Number(v.id), v])); // Ensure ID is treated as number
        const seenIds = new Set();

        for (const sel of value) {
          if (typeof sel !== 'object' || !sel.name || !sel.value) {
            throw new Error('Invalid selected variant: requires name (str), value (str)');
          }

          // Ensure sel.id is treated as a number
          const variantId = Number(sel.id);
          if (isNaN(variantId)) {
            throw new Error('Invalid variant ID: must be a number');
          }

          if (typeof sel.additional_price !== 'number' || sel.additional_price < 0) {
            throw new Error('Invalid selected variant: additional_price must be a non-negative number');
          }

          if (seenIds.has(variantId)) throw new Error('Duplicate variant ID');
          seenIds.add(variantId);

          const variant = variantMap.get(variantId);
          if (!variant) {
            const availableIds = Array.from(variantMap.keys()).sort((a, b) => a - b).join(', ');
            throw new Error(`Variant ${variantId} not found for product. Available variant IDs: ${availableIds || 'none'}`);
          }

          if (variant.stock !== null && variant.stock < req.body.quantity) {
            throw new Error(`Low stock for ${sel.value}: ${variant.stock} available`);
          }
        }
        return true;
      })
];


// Validation for updating cart item
/**
 * Validation rules for updating cart item quantity.
 * Validates cart item ownership and stock availability for quantity changes.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} itemId - Required cart item ID parameter, validates ownership
 * @property {ValidationChain} quantity - Required, 0-100, 0 removes item, validates stock
 * @returns {Array} Express validator middleware array for updating cart items
 * @example
 * // Use in route:
 * router.put('/cart/items/:itemId', updateCartItemValidation, updateCartItem);
 */
exports.updateCartItemValidation = [
  param('itemId')
    .notEmpty()
    .withMessage('Cart item ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid cart item ID')
    .custom(async (value, { req }) => {
      const cartItem = await CartItem.findByPk(value);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      // Check if user owns this cart item (if authenticated)
      if (req.user) {
        const cart = await Cart.findByPk(cartItem.cart_id);
        if (cart.user_id !== req.user.id) {
          throw new Error('Access denied to this cart item');
        }
      } else if (req.sessionID) {
        const cart = await Cart.findByPk(cartItem.cart_id);
        if (cart.session_id !== req.sessionID) {
          throw new Error('Access denied to this cart item');
        }
      }

      return true;
    }),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 0, max: 100 })
    .withMessage('Quantity must be between 0 and 100')
    .custom(async (value, { req }) => {
      if (value === 0) return true; // Allow removing item by setting quantity to 0

      const cartItem = await CartItem.findByPk(req.params.itemId);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      // Check stock availability
      if (cartItem.variant_id) {
        const variant = await ProductVariant.findByPk(cartItem.variant_id);
        if (variant && variant.stock !== null && variant.stock < value) {
          throw new Error(`Insufficient stock for this variant. Available: ${variant.stock}`);
        }
      } else {
        const inventory = await cartItem.getProduct().then(product => product.getInventory());
        if (inventory && inventory.stock < value) {
          throw new Error(`Insufficient stock for this product. Available: ${inventory.stock}`);
        }
      }

      return true;
    })
];

// Validation for removing item from cart
/**
 * Validation rules for removing items from cart.
 * Validates cart item ownership before removal.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} itemId - Required cart item ID parameter, validates ownership
 * @returns {Array} Express validator middleware array for removing cart items
 * @example
 * // Use in route:
 * router.delete('/cart/items/:itemId', removeFromCartValidation, removeFromCart);
 */
exports.removeFromCartValidation = [
  param('itemId')
    .notEmpty()
    .withMessage('Cart item ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid cart item ID')
    .custom(async (value, { req }) => {
      const cartItem = await CartItem.findByPk(value);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      // Check if user owns this cart item (if authenticated)
      if (req.user) {
        const cart = await Cart.findByPk(cartItem.cart_id);
        if (cart.user_id !== req.user.id) {
          throw new Error('Access denied to this cart item');
        }
      } else if (req.sessionID) {
        const cart = await Cart.findByPk(cartItem.cart_id);
        if (cart.session_id !== req.sessionID) {
          throw new Error('Access denied to this cart item');
        }
      }

      return true;
    })
];

// Validation for clearing cart
/**
 * Validation rules for clearing entire cart.
 * No specific validation needed - cart ownership checked in controller.
 * @type {Array} Empty array for cart clearing
 * @returns {Array} Empty express validator middleware array
 * @example
 * // Use in route:
 * router.delete('/cart', clearCartValidation, clearCart);
 */
exports.clearCartValidation = [
  // No additional validation needed - cart ownership is checked in controller
];

// Validation for getting cart summary
/**
 * Validation rules for retrieving cart summary with optional shipping/tax calculations.
 * Validates optional query parameters for cart calculations.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} include_shipping - Optional boolean for shipping calculation
 * @property {ValidationChain} include_tax - Optional boolean for tax calculation
 * @property {ValidationChain} shipping_cost - Optional positive number for shipping cost
 * @property {ValidationChain} tax_rate - Optional tax rate between 0 and 1
 * @returns {Array} Express validator middleware array for cart summary
 * @example
 * // Use in route:
 * router.get('/cart/summary', getCartSummaryValidation, getCartSummary);
 */
exports.getCartSummaryValidation = [
  // Optional query parameters
  query('include_shipping')
    .optional()
    .isBoolean()
    .withMessage('include_shipping must be a boolean value'),

  query('include_tax')
    .optional()
    .isBoolean()
    .withMessage('include_tax must be a boolean value'),

  query('shipping_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping cost must be a positive number'),

  query('tax_rate')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Tax rate must be between 0 and 1')
];

// Helper function to validate cart ownership
/**
 * Validates ownership/access rights for a cart.
 * Checks if user or session has access to the specified cart.
 * @param {number} cartId - Cart ID to validate
 * @param {number|null} userId - User ID for ownership check (null for guest carts)
 * @param {string|null} sessionId - Session ID for guest cart access (null for user carts)
 * @returns {Promise<Object>} Cart instance if validation passes
 * @throws {Error} When cart not found or access denied
 * @example
 * // Validate user cart access
 * const cart = await validateCartOwnership(cartId, userId);
 * // Validate guest cart access
 * const cart = await validateCartOwnership(cartId, null, sessionId);
 */
exports.validateCartOwnership = async (cartId, userId = null, sessionId = null) => {
  const cart = await Cart.findByPk(cartId);
  if (!cart) {
    throw new Error('Cart not found');
  }

  if (userId && cart.user_id !== userId) {
    throw new Error('Access denied to this cart');
  }

  if (sessionId && cart.session_id !== sessionId) {
    throw new Error('Access denied to this cart');
  }

  return cart;
};

// Helper function to check if user can access cart
/**
 * Checks if a user/session can access a specific cart.
 * Performs ownership validation for both authenticated users and guest sessions.
 * @param {Object} cart - Cart instance to check access for
 * @param {number|null} userId - User ID for ownership check (null for guest carts)
 * @param {string|null} sessionId - Session ID for guest cart access (null for user carts)
 * @returns {boolean} True if access is allowed, false otherwise
 * @example
 * // Check user cart access
 * const canAccess = canAccessCart(cart, userId);
 * // Check guest cart access
 * const canAccess = canAccessCart(cart, null, sessionId);
 */
exports.canAccessCart = (cart, userId = null, sessionId = null) => {
  if (userId) {
    return cart.user_id === userId;
  }

  if (sessionId) {
    return cart.session_id === sessionId;
  }

  return false;
};

// Validation for syncing cart
/**
 * Validation rules for syncing local cart with server cart.
 * Validates local cart items array and their individual properties.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} localItems - Required array of cart items with custom validation for each item's properties
 * @returns {Array} Express validator middleware array for cart sync
 * @example
 * // Use in route:
 * router.post('/cart/sync', syncCartValidation, syncCart);
 */
exports.syncCartValidation = [
  body('localItems')
    .exists({ checkFalsy: true })
    .withMessage('Local cart items are required')
    .isArray()
    .withMessage('Local cart items must be an array')
    .custom(async (value) => {
      console.log('Validating localItems array:', JSON.stringify(value, null, 2));
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        console.log(`Validating item at index ${i}:`, item);

        if (!item) {
          throw new Error(`Item at index ${i} is undefined or null`);
        }

        // Validate productId
        if (!item.productId) {
          throw new Error('Product ID is required for each item');
        }
        if (typeof item.productId !== 'string') {
          throw new Error('Product ID must be a string');
        }
        const numericProductId = parseInt(item.productId, 10);
        if (isNaN(numericProductId) || numericProductId <= 0) {
          throw new Error('Product ID must be a valid positive integer string');
        }
        const product = await Product.findByPk(numericProductId);
        if (!product) {
          throw new Error('Product not found');
        }
        if (product.status !== 'active') {
          throw new Error('Product is not available for purchase');
        }

        // Validate quantity
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 100) {
          throw new Error('Quantity must be between 1 and 100');
        }

        // Validate price
        if (!item.price || typeof item.price !== 'number' || item.price < 0) {
          throw new Error('Price must be a non-negative number');
        }

        // Validate selected_variants
        if (item.selected_variants !== undefined) {
          if (!Array.isArray(item.selected_variants)) {
            throw new Error('Selected variants must be an array');
          }
          if (item.selected_variants.length > 0) {
            const productVariants = await ProductVariant.findAll({
              where: { product_id: numericProductId }
            });
            const variantMap = new Map(productVariants.map(v => [Number(v.id), v]));
            const seenIds = new Set();

            for (const sel of item.selected_variants) {
              if (typeof sel !== 'object' || !sel.name || !sel.value) {
                throw new Error('Invalid selected variant: requires name and value');
              }

              const variantId = Number(sel.id);
              if (isNaN(variantId) || variantId < 1) {
                throw new Error('Invalid variant ID: must be a positive integer');
              }

              if (typeof sel.additional_price !== 'number' || sel.additional_price < 0) {
                throw new Error('Invalid selected variant: additional_price must be a non-negative number');
              }

              if (seenIds.has(variantId)) throw new Error('Duplicate variant ID');
              seenIds.add(variantId);

              const variant = variantMap.get(variantId);
              if (!variant) {
                throw new Error(`Variant ${variantId} not found for product`);
              }
            }
          }
        }
      }
      return true;
    })
];
