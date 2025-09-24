const { body, param, query } = require('express-validator');
const { Product, ProductVariant, Cart, CartItem } = require('../models');
const { Op } = require('sequelize');

// Validation for getting cart
exports.getCartValidation = [
  // Optional query parameters for pagination (if needed in future)
  query('include_items')
    .optional()
    .isBoolean()
    .withMessage('include_items must be a boolean value')
];

// Validation for adding item to cart
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
      if (value) {
        const variant = await ProductVariant.findOne({
          where: { id: value, product_id: req.body.product_id }
        });
        if (!variant) {
          throw new Error('Product variant not found for the specified product');
        }
        return true;
      }
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
    })
];

// Validation for updating cart item
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
exports.clearCartValidation = [
  // No additional validation needed - cart ownership is checked in controller
];

// Validation for getting cart summary
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
exports.canAccessCart = (cart, userId = null, sessionId = null) => {
  if (userId) {
    return cart.user_id === userId;
  }

  if (sessionId) {
    return cart.session_id === sessionId;
  }

  return false;
};