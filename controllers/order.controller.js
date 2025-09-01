const { 
  Order, 
  OrderItem, 
  OrderDetail, 
  OrderInfo, 
  Cart, 
  CartItem, 
  Product, 
  Address,
  sequelize,
  Sequelize 
} = require('../models');
const { Op } = require('sequelize');

// Create a new order from cart
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { addressId, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!addressId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Address ID is required'
      });
    }

    // Verify address exists and belongs to user
    const address = await Address.findOne({
      where: {
        id: addressId,
        user_id: userId
      },
      transaction
    });

    if (!address) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Get user's cart with items
    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'vendor_id', 'stock_quantity']
            }
          ]
        }
      ],
      transaction
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Group items by vendor
    const vendorItems = {};
    
    for (const item of cart.items) {
      const vendorId = item.Product.vendor_id;
      if (!vendorItems[vendorId]) {
        vendorItems[vendorId] = [];
      }
      vendorItems[vendorId].push(item);
    }

    const orders = [];
    
    // Create an order for each vendor
    for (const [vendorId, items] of Object.entries(vendorItems)) {
      // Calculate order total and validate stock
      let subtotal = 0;
      let shipping = 0; // This could be calculated based on vendor settings
      let tax = 0; // This could be calculated based on location
      
      const orderItems = [];
      
      for (const item of items) {
        // Check stock
        if (item.quantity > item.Product.stock_quantity) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for product: ${item.Product.name}`,
            productId: item.Product.id,
            available: item.Product.stock_quantity,
            requested: item.quantity
          });
        }
        
        const itemTotal = item.quantity * item.Product.price;
        subtotal += itemTotal;
        
        orderItems.push({
          product_id: item.Product.id,
          quantity: item.quantity,
          price: item.Product.price,
          total: itemTotal
        });
      }
      
      const total = subtotal + shipping + tax;
      
      // Create order
      const order = await Order.create({
        user_id: userId,
        vendor_id: vendorId,
        address_id: addressId,
        status: 'pending',
        subtotal,
        shipping,
        tax,
        total,
        payment_status: 'pending',
        payment_method: paymentMethod || 'card',
        notes: notes || null
      }, { transaction });
      
      // Create order items
      for (const item of orderItems) {
        await OrderItem.create({
          order_id: order.id,
          ...item
        }, { transaction });
        
        // Update product stock
        await Product.decrement('stock_quantity', {
          by: item.quantity,
          where: { id: item.product_id },
          transaction
        });
      }
      
      // Create order detail
      await OrderDetail.create({
        order_id: order.id,
        status: 'pending',
        status_date: new Date()
      }, { transaction });
      
      // Create order info
      await OrderInfo.create({
        order_id: order.id,
        shipping_address: `${address.address_line}, ${address.city}, ${address.state}, ${address.country}`,
        billing_address: `${address.address_line}, ${address.city}, ${address.state}, ${address.country}`,
        contact_email: req.user.email,
        contact_phone: address.phone_number
      }, { transaction });
      
      orders.push(order);
    }
    
    // Clear the cart
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction
    });
    
    await transaction.commit();
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: orders
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Get user's orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    const whereClause = { user_id: userId };
    if (status) {
      whereClause.status = status;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'thumbnail']
            }
          ]
        },
        {
          model: Address,
          attributes: ['id', 'address_line', 'city', 'state', 'country', 'postal_code']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });
    
    res.json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        orders
      }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders',
      error: error.message
    });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const order = await Order.findOne({
      where: {
        id,
        user_id: userId
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price', 'thumbnail']
            }
          ]
        },
        {
          model: OrderDetail,
          as: 'details',
          order: [['status_date', 'DESC']]
        },
        {
          model: OrderInfo,
          as: 'info'
        },
        {
          model: Address,
          attributes: ['id', 'label', 'address_line', 'city', 'state', 'country', 'postal_code', 'phone_number']
        }
      ]
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order',
      error: error.message
    });
  }
};

// Update order status (for admin/vendor)
const updateOrderStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    // Find order
    const order = await Order.findByPk(id, { transaction });
    
    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update order status
    await order.update({ status }, { transaction });
    
    // Add order detail
    await OrderDetail.create({
      order_id: order.id,
      status,
      status_date: new Date(),
      notes: notes || null
    }, { transaction });
    
    await transaction.commit();
    
    // TODO: Send notification to user about status update
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        orderId: order.id,
        status
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

// Cancel order (for user)
const cancelOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;
    
    // Find order
    const order = await Order.findOne({
      where: {
        id,
        user_id: userId,
        status: { [Op.in]: ['pending', 'processing'] } // Can only cancel if not shipped
      },
      transaction
    });
    
    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled'
      });
    }
    
    // Update order status
    await order.update({ 
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: reason || 'Cancelled by customer'
    }, { transaction });
    
    // Add order detail
    await OrderDetail.create({
      order_id: order.id,
      status: 'cancelled',
      status_date: new Date(),
      notes: reason || 'Order cancelled by customer'
    }, { transaction });
    
    // Restore product quantities
    const orderItems = await OrderItem.findAll({
      where: { order_id: order.id },
      transaction
    });
    
    for (const item of orderItems) {
      await Product.increment('stock_quantity', {
        by: item.quantity,
        where: { id: item.product_id },
        transaction
      });
    }
    
    await transaction.commit();
    
    // TODO: Send cancellation notification
    
    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder
};
