
const {
  Order,
  OrderItem,
  OrderDetail,
  User,
  Product,
  Vendor,
  Address,
  Inventory,
  InventoryHistory,
  PaymentTransaction,
  Notification,
  sequelize,
} = require("../models");
const PaymentService = require("../services/payment.service");
const emailService = require("../services/email.service");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

/**
 * Create a new order
 * @route POST /api/orders
 * @access Private
 */
async function createOrder(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const {
      addressId,
      items,
      shippingCost = 0,
      taxAmount = 0,
      notes,
      paymentMethod = "paystack",// Only support Paystack payments
    } = req.body;
    const userId = req.user.id;
    const orderDate = new Date();

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("At least one order item is required");
    }

    // Fetch user and address
    const [user, address] = await Promise.all([
      User.findByPk(userId, { transaction }),
      Address.findOne({
        where: { id: addressId, user_id: userId },
        transaction,
      }),
    ]);

    if (!user) throw new Error("User not found");
    if (!address)
      throw new Error("Address not found or does not belong to user");

    // Process order items and calculate total
    let totalAmount = 0;
    const orderItems = [];
    const vendorItems = new Map(); // Track items by vendor for notifications

    for (const item of items) {
      const product = await Product.findByPk(item.productId, {
        include: [{ model: Inventory }],
        transaction,
      });

      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (!product.inventory || product.inventory.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      const itemPrice = product.discounted_price || product.price;
      const itemTotal = item.quantity * itemPrice;
      totalAmount += itemTotal;

      // Create order item
      const orderItem = await OrderItem.create(
        {
          order_id: null, // Will be set after order is created
          product_id: product.id,
          vendor_id: product.vendor_id,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          price: itemPrice,
          sub_total: itemTotal,
        },
        { transaction }
      );

      // Get current stock before update
      const inventory = await Inventory.findOne({
        where: { product_id: product.id },
        transaction,
      });

      if (!inventory) {
        throw new Error(`Inventory not found for product ${product.id}`);
      }

      const previousStock = inventory.stock;
      const newStock = previousStock - item.quantity;

      // Update inventory
      await Inventory.decrement("stock", {
        by: item.quantity,
        where: { product_id: product.id },
        transaction,
      });

      // Record inventory history
      await InventoryHistory.create({
        inventory_id: inventory.id,
        adjustment: -item.quantity, // Negative for stock out
        previous_stock: previousStock,
        new_stock: newStock,
        note: `Order #${order?.id || 'N/A'}: Stock reduced for order placement`,
        adjusted_by: userId,
      }, { transaction });

      // Track items by vendor for notifications
      if (product.vendor_id) {
        if (!vendorItems.has(product.vendor_id)) {
          vendorItems.set(product.vendor_id, []);
        }
        vendorItems.get(product.vendor_id).push({
          ...orderItem.toJSON(),
          product: product.toJSON(),
        });
      }

      orderItems.push(orderItem);
    }

    // Add shipping and tax to total
    totalAmount += parseFloat(shippingCost || 0) + parseFloat(taxAmount || 0);

    // Create order
    const order = await Order.create(
      {
        user_id: userId,
        order_date: orderDate,
        total_amount: totalAmount,
        payment_status: "pending",
        payment_method: paymentMethod,
        order_status: "pending",
      },
      { transaction }
    );

    // Update order items with order_id
    await Promise.all(
      orderItems.map((item) =>
        item.update({ order_id: order.id }, { transaction })
      )
    );

    // Create order details
    await OrderDetail.create(
      {
        order_id: order.id,
        address_id: addressId,
        shipping_cost: shippingCost,
        tax_amount: taxAmount,
        note: notes,
      },
      { transaction }
    );

    // Initialize payment with Paystack
    const paymentService = new PaymentService();
    const reference = `STYLAY-${Date.now()}-${order.id}`;

    const paymentData = await paymentService.initializePayment({
      email: user.email,
      amount: totalAmount * 100, // Convert to kobo
      reference,
      callbackUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/verify`,
      metadata: {
        orderId: order.id,
        userId: user.id,
        items: items.map((item) => ({
          id: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        })),
      },
    });

    // Update order with payment reference
    await order.update(
      {
        payment_reference: reference,
        payment_status: "pending",
        order_status: "pending",
      },
      { transaction }
    );

    // Log payment transaction
    await PaymentTransaction.create(
      {
        user_id: userId,
        order_id: order.id,
        reference: paymentData?.data?.reference || `PAY-${uuidv4()}`,
        amount: totalAmount,
        currency: "NGN",
        status: "initiated",
        payment_method: "card",
        payment_gateway: "paystack",
        metadata: {
          paymentData: paymentData?.data || null,
        },
      },
      { transaction }
    );

    // Send order confirmation email
    await emailService.sendOrderConfirmation(order, userId);

    // Notify vendors about the new order
    await emailService.notifyVendors(order.id);

    // Create notification
    await Notification.create(
      {
        user_id: userId,
        type: "order_created",
        message: `Your order #${order.id} has been received and is being processed`,
        metadata: {
          orderId: order.id,
          status: "pending",
        },
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      status: "success",
      data: {
        order: {
          ...order.toJSON(),
          items: orderItems,
          paymentData:
            paymentMethod !== "cash_on_delivery" ? paymentData?.data : null,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Order creation failed:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to create order",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Get order by ID
 * @route GET /api/orders/:id
 * @access Private
 */
async function getOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.roles.some((role) => role.name === "admin");
    const isVendor = req.user.roles.some((role) => role.name === "vendor");

    const where = { id };

    // Non-admins can only see their own orders
    if (!isAdmin) {
      where.user_id = userId;
    }

    const order = await Order.findOne({
      where,
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email", "phone"],
        },
        {
          model: OrderItem,
          include: [
            {
              model: Product,
              attributes: [
                "id",
                "name",
                "slug",
                "price",
                "discounted_price",
                "images",
              ],
            },
            {
              model: Vendor,
              attributes: ["id", "user_id"],
              include: [
                { model: Store, attributes: ["id", "name", "slug", "logo"] },
              ],
            },
          ],
          where: isVendor ? { vendor_id: req.user.vendor_id } : {},
        },
        {
          model: OrderDetail,
          include: [
            {
              model: Address,
              attributes: { exclude: ["created_at", "updated_at"] },
            },
          ],
        },
        {
          model: PaymentTransaction,
          attributes: { exclude: ["created_at", "updated_at"] },
          order: [["created_at", "DESC"]],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found or access denied",
      });
    }

    // Format response
    const orderData = order.get({ plain: true });

    // Calculate order summary
    const orderSummary = {
      subtotal: orderData.order_items.reduce(
        (sum, item) => sum + item.sub_total,
        0
      ),
      shipping: orderData.order_detail?.shipping_cost || 0,
      tax: orderData.order_detail?.tax_amount || 0,
      total: orderData.total_amount,
    };

    res.status(200).json({
      status: "success",
      data: {
        order: {
          ...orderData,
          summary: orderSummary,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching order:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch order details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Update order status
 * @route PATCH /api/orders/:id/status
 * @access Private (Admin/Vendor)
 */
async function updateOrderStatus(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const isVendor = req.user.role === "vendor";

    // Validate status
    const validStatuses = ["processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status value");
    }

    // Find order with items
    const order = await Order.findOne({
      where: { id },
      include: [
        { model: OrderItem, include: [Product] },
        { model: User, attributes: ["id", "email", "first_name"] },
      ],
      transaction,
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Vendor can only update their own orders
    if (isVendor) {
      const vendorItems = order.order_items.filter(
        (item) => item.vendor_id === req.user.vendor_id
      );

      if (vendorItems.length === 0) {
        throw new Error("No items found for this vendor in the order");
      }
    }

    // Prevent invalid status transitions
    const currentStatus = order.order_status;
    if (
      (currentStatus === "cancelled" || order.payment_status === "failed") &&
      status !== "cancelled"
    ) {
      throw new Error(
        "Cannot update status of a cancelled or failed payment order"
      );
    }

    // Update order status
    await order.update({ order_status: status }, { transaction });

    // Handle status-specific logic
    switch (status) {
      case "shipped":
        // Send shipping confirmation email
        await emailService.sendOrderShipped(order.id, order.user_id, {
          trackingNumber: req.body.trackingNumber,
          carrier: req.body.carrier,
          estimatedDelivery: req.body.estimatedDelivery,
        });
        break;

      case "delivered":
        // Mark payment as completed if it was pending
        if (order.payment_status === "pending") {
          await order.update(
            {
              payment_status: "paid",
              paid_at: new Date(),
            },
            { transaction }
          );

          // Update payment transaction
          await PaymentTransaction.update(
            { status: "success" },
            {
              where: {
                order_id: order.id,
                status: "pending",
              },
              transaction,
            }
          );

          // Send payment confirmation
          await emailService.sendPaymentReceived(order, order.user_id, {
            amount: order.total_amount,
            paymentMethod: order.payment_method,
            transactionDate: new Date(),
          });
        }

        // Send delivery confirmation
        await emailService.sendOrderDelivered(order.id, order.user_id);
        break;

      case "cancelled":
        // Restore inventory for cancelled orders
        await Promise.all(
          order.order_items.map((item) =>
            Inventory.increment("stock", {
              by: item.quantity,
              where: { product_id: item.product_id },
              transaction,
            })
          )
        );

        // Send cancellation email
        await emailService.sendOrderCancelled(
          order,
          order.user_id,
          notes || "Order was cancelled"
        );
        break;
    }

    // Create notification
    await Notification.create(
      {
        user_id: order.user_id,
        type: `order_${status}`,
        message: `Order #${order.id} status updated to ${status}`,
        metadata: {
          orderId: order.id,
          status,
          updatedBy: userId,
        },
      },
      { transaction }
    );

    // For vendors, update only their items
    if (isVendor) {
      await OrderItem.update(
        { status },
        {
          where: {
            order_id: order.id,
            vendor_id: req.user.vendor_id,
          },
          transaction,
        }
      );
    }

    await transaction.commit();

    res.status(200).json({
      status: "success",
      data: {
        order: {
          id: order.id,
          status: order.order_status,
          updatedAt: order.updatedAt,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error updating order status:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to update order status",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Get orders for the authenticated user
 * @route GET /api/orders/my-orders
 * @access Private
 */
async function getUserOrders(req, res) {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const where = { user_id: req.user.id };

    // Add status filter if provided
    if (status) {
      where.order_status = status;
    }

    // Get paginated orders with related data
    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          attributes: ["id", "quantity", "price", "sub_total"],
          include: [
            {
              model: Product,
              attributes: ["id", "name", "slug", "images"],
              include: [
                {
                  model: Vendor,
                  attributes: ["id", "business_name"],
                },
              ],
            },
          ],
        },
        {
          model: OrderDetail,
          attributes: ["shipping_cost", "tax_amount"],
          include: [
            {
              model: Address,
              attributes: [
                "id",
                "address_line1",
                "city",
                "state",
                "country",
                "postal_code",
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Format response
    const formattedOrders = orders.map((order) => {
      const orderData = order.get({ plain: true });

      // Calculate order summary
      const subtotal = orderData.order_items.reduce(
        (sum, item) => sum + item.sub_total,
        0
      );

      const shipping = orderData.order_detail?.shipping_cost || 0;
      const tax = orderData.order_detail?.tax_amount || 0;

      return {
        id: orderData.id,
        order_number: `#${String(orderData.id).padStart(8, "0")}`,
        status: orderData.order_status,
        payment_status: orderData.payment_status,
        order_date: orderData.order_date,
        total_amount: orderData.total_amount,
        item_count: orderData.order_items.length,
        items: orderData.order_items.map((item) => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            image: item.product.images?.[0] || null,
            vendor: item.product.vendor?.business_name,
          },
          quantity: item.quantity,
          price: item.price,
          sub_total: item.sub_total,
        })),
        summary: {
          subtotal,
          shipping,
          tax,
          total: subtotal + shipping + tax,
        },
        shipping_address: orderData.order_detail?.address,
      };
    });

    res.status(200).json({
      status: "success",
      data: {
        orders: formattedOrders,
        pagination: {
          total: count,
          total_pages: totalPages,
          current_page: parseInt(page),
          has_next_page: hasNextPage,
          has_previous_page: hasPreviousPage,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching user orders:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Verify payment and update order status
 * @route GET /api/orders/verify-payment/:reference
 * @access Private
 */
async function verifyPayment(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    // Find the payment transaction
    const transactionRecord = await PaymentTransaction.findOne({
      where: { reference, user_id: userId },
      include: [Order],
      transaction,
    });

    if (!transactionRecord) {
      throw new Error("Transaction not found");
    }

    // Skip if already verified
    if (transactionRecord.status === "success") {
      return res.status(200).json({
        status: "success",
        message: "Payment already verified",
        data: { orderId: transactionRecord.order_id },
      });
    }

    // Verify with payment gateway
    const paymentService = new PaymentService();
    const verification = await paymentService.verifyPayment(reference);

    if (verification.status !== "success") {
      throw new Error(verification.message || "Payment verification failed");
    }

    // Update transaction status
    await transactionRecord.update(
      {
        status: "success",
        metadata: {
          ...(transactionRecord.metadata || {}),
          verification: verification.data,
        },
      },
      { transaction }
    );

    // Update order status
    const order = transactionRecord.order;
    await order.update(
      {
        payment_status: "paid",
        paid_at: new Date(),
        order_status: "processing", // Move to processing now that payment is confirmed
      },
      { transaction }
    );

    // Send payment confirmation email
    await emailService.sendPaymentReceived(order, userId, {
      amount: order.total_amount,
      paymentMethod: order.payment_method,
      transactionDate: new Date(),
      reference: verification.data.reference,
    });

    // Notify vendors
    await emailService.notifyVendors(order.id);

    // Create notification
    await Notification.create(
      {
        user_id: userId,
        type: "payment_received",
        message: `Payment of ₦${order.total_amount.toLocaleString()} for order #${
          order.id
        } was successful`,
        metadata: {
          orderId: order.id,
          amount: order.total_amount,
          paymentMethod: order.payment_method,
        },
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Payment verified successfully",
      data: {
        orderId: order.id,
        status: order.order_status,
        paymentStatus: order.payment_status,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Payment verification failed:", error);

    // Update transaction as failed
    if (transactionRecord) {
      await transactionRecord.update({
        status: "failed",
        metadata: {
          ...(transactionRecord.metadata || {}),
          error: error.message,
        },
      });
    }

    res.status(400).json({
      status: "error",
      message: error.message || "Payment verification failed",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Handle payment webhook
 * @route POST /api/webhooks/payment
 * @access Public (called by payment gateway)
 */
async function handlePaymentWebhook(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const event = req.body;

    // Verify webhook signature
    const paymentService = new PaymentService();
    const result = await paymentService.handleWebhook(event);

    await transaction.commit();
    res.status(200).json(result);
  } catch (error) {
    await transaction.rollback();
    logger.error("Webhook processing failed:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Webhook processing failed",
    });
  }
}

/**
 * Cancel an order
 * @route PATCH /api/orders/:id/cancel
 * @access Private
 */
async function cancelOrder(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Find the order with items
    const order = await Order.findOne({
      where: {
        id,
        user_id: userId,
        order_status: ["pending", "processing"],
      },
      include: [
        { model: OrderItem, include: [Product] },
        { model: User, attributes: ["id", "email", "first_name"] },
      ],
      transaction,
    });

    if (!order) {
      throw new Error(
        "Order not found, already cancelled, or cannot be cancelled"
      );
    }

    // Update order status
    await order.update(
      {
        order_status: "cancelled",
        cancelled_at: new Date(),
        cancelled_by: userId,
        cancellation_reason: reason,
      },
      { transaction }
    );

    // Restore inventory for cancelled orders with history tracking
    await Promise.all(
      order.order_items.map(async (item) => {
        const inventory = await Inventory.findOne({
          where: { product_id: item.product_id },
          transaction,
        });

        if (inventory) {
          const previousStock = inventory.stock;
          const newStock = previousStock + item.quantity;

          // Restore inventory
          await Inventory.increment("stock", {
            by: item.quantity,
            where: { product_id: item.product_id },
            transaction,
          });

          // Record inventory history for restoration
          await sequelize.models.InventoryHistory.create({
            inventory_id: inventory.id,
            adjustment: item.quantity, // Positive for stock in
            previous_stock: previousStock,
            new_stock: newStock,
            note: `Order #${order.id} cancelled: Stock restored`,
            adjusted_by: req.user.id,
          }, { transaction });
        }
        return true;
      })
    );

    // If payment was made, process refund
    if (order.payment_status === "paid") {
      // Create refund transaction
      await PaymentTransaction.create(
        {
          user_id: userId,
          order_id: order.id,
          reference: `REFUND-${Date.now()}-${order.id}`,
          amount: order.total_amount,
          currency: "NGN",
          status: "pending",
          payment_method: order.payment_method,
          payment_gateway: "paystack",
          type: "refund",
          metadata: {
            reason: "Order cancellation",
            cancelled_by: userId,
            cancelled_at: new Date(),
          },
        },
        { transaction }
      );

      // TODO: Initiate refund with payment gateway
      // This would typically be an async process
    }

    // Send cancellation email
    await emailService.sendOrderCancelled(
      order,
      userId,
      reason || "Order was cancelled by customer"
    );

    // Create notification
    await Notification.create(
      {
        user_id: userId,
        type: "order_cancelled",
        message: `Order #${order.id} has been cancelled`,
        metadata: {
          orderId: order.id,
          status: "cancelled",
          reason: reason || "No reason provided",
        },
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Order cancelled successfully",
      data: {
        orderId: order.id,
        status: "cancelled",
        cancelledAt: order.cancelled_at,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error cancelling order:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to cancel order",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Get vendor's orders
 * @route GET /api/orders/vendor/orders
 * @access Private (Vendor)
 */
async function getVendorOrders(req, res) {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const vendorId = req.user.id;

    const where = {
      "$order_items.product.vendor_id$": vendorId,
    };

    if (status) {
      where.order_status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          include: [
            {
              model: Product,
              attributes: ["id", "name", "price"],
              where: { vendor_id: vendorId },
            },
          ],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      distinct: true,
      offset,
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      data: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        orders,
      },
    });
  } catch (error) {
    logger.error("Error fetching vendor orders:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch vendor orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Update order item status
 * @route PATCH /api/orders/items/:id/status
 * @access Private (Vendor)
 */
async function updateOrderItemStatus(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const vendorId = req.user.id;

    // Validate status
    const validStatuses = ["processing", "shipped", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new Error(
        "Invalid status. Must be one of: " + validStatuses.join(", ")
      );
    }

    // Find the order item with product and order details
    const orderItem = await OrderItem.findOne({
      where: { id },
      include: [
        {
          model: Product,
          where: { vendor_id: vendorId },
          attributes: ["id", "vendor_id"],
        },
        {
          model: Order,
          attributes: ["id", "order_status", "user_id"],
        },
      ],
      transaction,
    });

    if (!orderItem) {
      throw new Error(
        "Order item not found or does not belong to your products"
      );
    }

    // Update order item status
    await orderItem.update(
      {
        status,
        status_updated_at: new Date(),
        status_notes: notes,
      },
      { transaction }
    );

    // Check if all items are now in the same status
    const allItems = await OrderItem.findAll({
      where: { order_id: orderItem.order_id },
      transaction,
    });

    const allSameStatus = allItems.every((item) => item.status === status);

    if (allSameStatus && status !== orderItem.order.order_status) {
      // Update order status if all items have the same status
      await Order.update(
        { order_status: status },
        {
          where: { id: orderItem.order_id },
          transaction,
        }
      );
    }

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Order item status updated successfully",
      data: {
        orderItemId: orderItem.id,
        status,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error updating order item status:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to update order item status",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Get all orders (Admin)
 * @route GET /api/orders
 * @access Private (Admin)
 */
async function getAllOrders(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) {
      where.order_status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: OrderItem,
          include: [
            {
              model: Product,
              attributes: ["id", "name", "price"],
              include: [
                {
                  model: User,
                  as: "vendor",
                  attributes: ["id", "business_name", "email"],
                },
              ],
            },
          ],
        },
      ],
      distinct: true,
      offset,
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      data: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        orders,
      },
    });
  } catch (error) {
    logger.error("Error fetching all orders:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  createOrder,
  getOrder,
  updateOrderStatus,
  getUserOrders,
  getVendorOrders,
  updateOrderItemStatus,
  getAllOrders,
  verifyPayment,
  handlePaymentWebhook,
  cancelOrder,
};
