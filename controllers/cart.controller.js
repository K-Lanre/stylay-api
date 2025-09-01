const { Cart, CartItem, Product } = require('../models');
const { Op } = require('sequelize');

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find or create cart for user
    let cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'thumbnail']
            }
          ]
        }
      ]
    });

    if (!cart) {
      cart = await Cart.create({
        user_id: userId
      });
      cart = await Cart.findByPk(cart.id, {
        include: [
          {
            model: CartItem,
            as: 'items',
            include: [
              {
                model: Product,
                attributes: ['id', 'name', 'price', 'thumbnail']
              }
            ]
          }
        ]
      });
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cart',
      error: error.message
    });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  const transaction = await Cart.sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    // Validate input
    if (!productId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({
      where: { user_id: userId },
      transaction
    });

    if (!cart) {
      cart = await Cart.create({
        user_id: userId
      }, { transaction });
    }

    // Check if product exists
    const product = await Product.findByPk(productId, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if item already in cart
    let cartItem = await CartItem.findOne({
      where: {
        cart_id: cart.id,
        product_id: productId
      },
      transaction
    });

    if (cartItem) {
      // Update quantity if item exists
      cartItem.quantity += parseInt(quantity, 10);
      await cartItem.save({ transaction });
    } else {
      // Add new item to cart
      cartItem = await CartItem.create({
        cart_id: cart.id,
        product_id: productId,
        quantity: parseInt(quantity, 10)
      }, { transaction });
    }

    await transaction.commit();

    // Return updated cart
    const updatedCart = await Cart.findByPk(cart.id, {
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'thumbnail']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Item added to cart',
      data: updatedCart
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message
    });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  const transaction = await Cart.sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Validate input
    if (quantity === undefined || quantity < 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Find cart item
    const cartItem = await CartItem.findOne({
      where: {
        id: itemId,
        cart_id: cart.id
      },
      transaction
    });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      await cartItem.destroy({ transaction });
    } else {
      // Update quantity
      cartItem.quantity = quantity;
      await cartItem.save({ transaction });
    }

    await transaction.commit();

    // Return updated cart
    const updatedCart = await Cart.findByPk(cart.id, {
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'thumbnail']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Cart updated',
      data: updatedCart
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart',
      error: error.message
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  const transaction = await Cart.sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    // Find user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Find and delete cart item
    const result = await CartItem.destroy({
      where: {
        id: itemId,
        cart_id: cart.id
      },
      transaction
    });

    if (!result) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    await transaction.commit();

    // Return updated cart
    const updatedCart = await Cart.findByPk(cart.id, {
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'thumbnail']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: updatedCart
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error removing from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message
    });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  const transaction = await Cart.sequelize.transaction();
  
  try {
    const userId = req.user.id;

    // Find user's cart
    const cart = await Cart.findOne({
      where: { user_id: userId },
      transaction
    });

    if (!cart) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Remove all items from cart
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction
    });

    await transaction.commit();

    // Return empty cart
    const updatedCart = await Cart.findByPk(cart.id, {
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'thumbnail']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Cart cleared',
      data: updatedCart
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
