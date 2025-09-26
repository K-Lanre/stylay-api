// Import necessary models
const {
  Order,
  OrderItem,
  OrderDetail,
  User,
  Product,
  Vendor,
  Store,
  Address,
  Inventory,
  InventoryHistory,
  PaymentTransaction,
  Notification,
  NotificationItem,
  sequelize,
  ProductVariant,
  ProductImage, // Add ProductImage import
} = require("../models");
const paymentService = require("../services/payment.service");
const emailService = require("../services/email.service");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

/**
 * Creates a new order with inventory management, payment initialization, and vendor notifications.
 * Handles complex order processing including stock validation, inventory deduction, payment gateway integration,
 * and email notifications to both customer and vendors.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.body - Request body containing order data
 * @param {number} req.body.addressId - Shipping address ID (required)
 * @param {Array<Object>} req.body.items - Order items array (required)
 * @param {number} req.body.items[].productId - Product ID (required)
 * @param {number} req.body.items[].quantity - Item quantity (required)
 * @param {number} [req.body.items[].variantId] - Product variant ID (optional)
 * @param {number} [req.body.shippingCost=0] - Shipping cost
 * @param {number} [req.body.taxAmount=0] - Tax amount
 * @param {string} [req.body.notes] - Order notes
 * @param {string} [req.body.paymentMethod="paystack"] - Payment method
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for order ownership
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with order details and payment data
 * @returns {boolean} status - Success status
 * @returns {Object} data - Response data container
 * @returns {Object} data.order - Complete order information with associations
 * @returns {number} data.order.id - Order ID
 * @returns {string} data.order.order_date - Order creation date
 * @returns {number} data.order.total_amount - Total order amount
 * @returns {string} data.order.payment_status - Payment status ('pending')
 * @returns {string} data.order.order_status - Order status ('pending')
 * @returns {Array} data.order.items - Order items with product details
 * @returns {Object} data.order.details - Order shipping and tax details
 * @returns {Object} [data.order.paymentData] - Paystack payment initialization data (if applicable)
 * @throws {Error} 400 - When items array is empty or invalid, insufficient stock, or address not found
 * @api {post} /api/orders Create Order
 * @private user
 * @example
 * // Request
 * POST /api/orders
 * Authorization: Bearer <token>
 * {
 *   "addressId": 123,
 *   "items": [
 *     {"productId": 456, "quantity": 2, "variantId": 789},
 *     {"productId": 101, "quantity": 1}
 *   ],
 *   "shippingCost": 1500,
 *   "taxAmount": 500,
 *   "notes": "Please handle with care"
 * }
 *
 * // Success Response (201)
 * {
 *   "status": "success",
 *   "data": {
 *     "order": {
 *       "id": 12345,
 *       "order_date": "2024-09-26T05:00:00.000Z",
 *       "total_amount": 25000,
 *       "payment_status": "pending",
 *       "order_status": "pending",
 *       "items": [...],
 *       "details": {...},
 *       "paymentData": {...}
 *     }
 *   }
 * }
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
      paymentMethod = "paystack", // Only support Paystack payments
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

    // First pass: Validate stock, get prices, and calculate total amount
    const itemsWithDetails = [];
    for (const item of items) {
      const product = await Product.findByPk(item.productId, {
        include: [{ model: Inventory }, { model: Vendor, as: "vendor" }],
        transaction,
      });

      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (!product.vendor)
        throw new Error(`Vendor not found for product ${product.id}`);

      let itemPrice = product.discounted_price || product.price;
      let variant = null;

      if (item.variantId) {
        variant = await ProductVariant.findByPk(item.variantId, {
          where: { product_id: item.productId },
          transaction,
        });

        if (!variant)
          throw new Error(
            `Product variant ${item.variantId} not found for product ${product.id}`
          );
        if (variant.stock === null || variant.stock === undefined) {
          throw new Error(
            `Variant stock is not defined for variant ${item.variantId}`
          );
        }
        if (variant.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product variant: ${product.name} - ${variant.name}`
          );
        }

        // Use variant price if available, otherwise use product price
        itemPrice = variant.price || itemPrice;
      } else if (
        !product.inventory ||
        product.inventory.stock < item.quantity
      ) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      itemsWithDetails.push({
        ...item,
        price: itemPrice,
        vendorId: product.vendor.id,
      });

      totalAmount += item.quantity * itemPrice;
    }
    console.log(itemsWithDetails);

    // Add shipping and tax to total
    totalAmount += parseFloat(shippingCost || 0) + parseFloat(taxAmount || 0);
    console.log(totalAmount);

    // Create the order with its associations
    let order = await Order.create(
      {
        user_id: userId,
        order_date: orderDate,
        total_amount: totalAmount,
        payment_status: "pending",
        payment_method: paymentMethod,
        order_status: "pending",
        items: itemsWithDetails.map((item) => ({
          product_id: item.productId,
          vendor_id: item.vendorId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          price: item.price,
          sub_total: item.quantity * item.price,
        })),
        details: {
          address_id: addressId,
          shipping_cost: shippingCost,
          tax_amount: taxAmount,
          note: notes,
        },
      },
      {
        include: [
          { model: OrderItem, as: "items" },
          { model: OrderDetail, as: "details" },
        ],
        transaction,
      }
    );

    // Update inventory for all items in the order
    for (const item of itemsWithDetails) {
      const product = await Product.findByPk(item.productId, {
        include: [{ model: Inventory }],
        transaction,
      });

      // Update inventory and inventory history
      const inventory = await Inventory.findOne({
        where: { product_id: product.id },
        transaction,
      });

      if (!inventory) {
        throw new Error(`Inventory not found for product ${product.id}`);
      }

      const previousStock = inventory.stock;
      const newStock = previousStock - item.quantity;

      await Inventory.decrement("stock", {
        by: item.quantity,
        where: { product_id: product.id },
        transaction,
      });

      await InventoryHistory.create(
        {
          inventory_id: inventory.id,
          adjustment: -item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          note: `Order #${order.id}: Stock reduced for order placement`,
          adjusted_by: userId,
        },
        { transaction }
      );

      // Decrement variant stock if variantId is provided
      if (item.variantId) {
        await ProductVariant.decrement("stock", {
          by: item.quantity,
          where: { id: item.variantId },
          transaction,
        });
      }

      // Track items by vendor for notifications
      if (product.vendor_id) {
        if (!vendorItems.has(product.vendor_id)) {
          vendorItems.set(product.vendor_id, []);
        }
        vendorItems.get(product.vendor_id).push({
          product_id: product.id,
          vendor_id: product.vendor_id,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          price: item.price,
          product: product.toJSON(),
        });
      }

      // Update sold_units for the product
      await Product.increment('sold_units', {
        by: item.quantity,
        where: { id: item.productId },
        transaction,
      });
    }

    // Initialize payment with Paystack
    const reference = `STYLAY-${Date.now()}-${order.id}`;

    const paymentData = await paymentService.initializePayment({
      email: user.email,
      amount: totalAmount * 100, // Convert to kobo
      reference,
      callbackUrl: `${process.env.PAYSTACK_CALLBACK_URL}/${reference}`, // Use frontend URL for callback
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
        type: "payment",
        amount: totalAmount,
        status: "pending",
        transaction_id: paymentData?.data?.reference || `PAY-${uuidv4()}`,
        description: `Payment for order #${order.id}`,
      },
      { transaction }
    );

    // Commit the transaction before sending emails and notifications
    await transaction.commit();

    // Refetch the order with proper associations for email
    const orderWithItems = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: "items",
          required: false, // Ensure items are included even if empty
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "name",
                "price",
                "discounted_price",
                "thumbnail",
              ],
              include: [
                {
                  model: ProductImage,
                  as: "images",
                  attributes: ["id", "image_url", "is_featured"],
                  required: false,
                },
              ],
            },
            {
              model: Vendor,
              as: "vendor",
              attributes: ["id"],
              required: false,
              include: [
                {
                  model: Store,
                  as: "store",
                  attributes: ["id", "business_name"],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: OrderDetail,
          as: "details",
          include: [
            {
              model: Address,
              as: "address",
              attributes: { exclude: ["created_at", "updated_at"] },
            },
          ],
        },
      ],
    });

    // Send order confirmation email (outside transaction)
    try {
      await emailService.sendOrderConfirmation(orderWithItems, userId);
    } catch (emailError) {
      logger.error("Error sending order confirmation email:", emailError);
      // Don't fail the whole request if email fails
    }

    // Notify vendors about the new order (outside transaction)
    try {
      await emailService.notifyVendors(order.id);
    } catch (notificationError) {
      logger.error("Error notifying vendors:", notificationError);
      // Don't fail the whole request if vendor notification fails
    }

    // Create notification (outside transaction)
    try {
      const now = new Date();
      await Notification.create({
        user_id: userId,
        type: "order_created",
        title: `Order #${order.id} Received`,
        message: `Your order #${order.id} has been received and is being processed`,
        is_read: false,
        metadata: {
          orderId: order.id,
          status: "pending",
        },
        created_at: now,
        updated_at: now,
      });
    } catch (notificationError) {
      logger.error("Error creating notification:", notificationError);
      // Don't fail the whole request if notification creation fails
    }

    res.status(201).json({
      status: "success",
      data: {
        order: {
          ...orderWithItems.toJSON(),
          paymentData:
            paymentMethod !== "cash_on_delivery" ? paymentData?.data : null,
        },
      },
    });
  } catch (error) {
    // Only rollback if transaction hasn't been committed yet
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error("Error rolling back transaction:", rollbackError);
    }

    logger.error("Order creation failed:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to create order",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Retrieves detailed information about a specific order by ID.
 * Access control ensures users can only view their own orders, vendors can see orders containing their products,
 * and admins have unrestricted access.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Order ID to retrieve
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for access control
 * @param {Array} req.user.roles - User roles array for permission checking
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with comprehensive order details
 * @returns {boolean} status - Success status
 * @returns {Object} data - Response data container
 * @returns {Object} data.order - Complete order information
 * @returns {number} data.order.id - Order ID
 * @returns {string} data.order.order_date - Order creation date
 * @returns {number} data.order.total_amount - Total order amount
 * @returns {string} data.order.payment_status - Payment status
 * @returns {string} data.order.order_status - Order fulfillment status
 * @returns {Object} data.order.User - Customer information
 * @returns {Array} data.order.items - Order items with product details
 * @returns {Object} data.order.details - Shipping and tax details with address
 * @returns {Array} data.order.transactions - Payment transaction history
 * @returns {Object} data.order.summary - Calculated order totals (subtotal, shipping, tax, total)
 * @throws {AppError} 404 - When order not found or access denied
 * @api {get} /api/orders/:id Get Order by ID
 * @private user, vendor, admin
 * @example
 * // Request
 * GET /api/orders/12345
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "order": {
 *       "id": 12345,
 *       "order_date": "2024-09-26T05:00:00.000Z",
 *       "total_amount": 25000,
 *       "payment_status": "paid",
 *       "order_status": "processing",
 *       "User": {"first_name": "John", "last_name": "Doe"},
 *       "items": [...],
 *       "details": {...},
 *       "transactions": [...],
 *       "summary": {
 *         "subtotal": 20000,
 *         "shipping": 1500,
 *         "tax": 500,
 *         "total": 22000
 *       }
 *     }
 *   }
 * }
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
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
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
          as: "transactions",
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
 * Updates the status of an order with business logic for different status transitions.
 * Handles inventory restoration for cancellations, payment completion for deliveries,
 * and email notifications to customers. Supports both admin and vendor access with appropriate restrictions.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Order ID to update
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - New order status ('processing', 'shipped', 'delivered', 'cancelled')
 * @param {string} [req.body.notes] - Status update notes
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for audit trail
 * @param {Array} req.user.roles - User roles for permission checking
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming status update
 * @returns {boolean} status - Success status
 * @returns {Object} data - Response data container
 * @returns {number} data.order.id - Order ID
 * @returns {string} data.order.status - Updated order status
 * @returns {string} data.order.updatedAt - Last update timestamp
 * @throws {Error} 400 - When invalid status provided or invalid status transition attempted
 * @throws {Error} 404 - When order not found
 * @throws {Error} 403 - When vendor tries to update order they don't have items in
 * @api {patch} /api/orders/:id/status Update Order Status
 * @private vendor, admin
 * @example
 * // Request - Mark as shipped
 * PATCH /api/orders/12345/status
 * Authorization: Bearer <vendor_token>
 * {
 *   "status": "shipped",
 *   "notes": "Order shipped via DHL"
 * }
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "order": {
 *       "id": 12345,
 *       "status": "shipped",
 *       "updatedAt": "2024-09-26T06:00:00.000Z"
 *     }
 *   }
 * }
 */
async function updateOrderStatus(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.roles.some((role) => role.name === "admin");
    const isVendor = req.user.roles.some((role) => role.name === "vendor");

    // Validate status
    const validStatuses = ["processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status value");
    }

    // Find order with items
    const order = await Order.findOne({
      where: { id },
      include: [
        { model: OrderItem, as: "items", include: [Product] },
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
    // Only rollback if transaction hasn't been committed yet
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error("Error rolling back transaction:", rollbackError);
    }

    logger.error("Error updating order status:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to update order status",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Retrieves a paginated list of orders belonging to the authenticated user.
 * Provides comprehensive order history with item details, shipping information, and calculated totals.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.status] - Filter orders by status ('pending', 'processing', 'shipped', 'delivered', 'cancelled')
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of orders per page
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for order filtering
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated user orders
 * @returns {boolean} status - Success status
 * @returns {Object} data - Response data container
 * @returns {Array} data.orders - Array of order objects with formatted data
 * @returns {number} data.orders[].id - Order ID
 * @returns {string} data.orders[].order_number - Formatted order number (#000012345)
 * @returns {string} data.orders[].status - Order status
 * @returns {string} data.orders[].payment_status - Payment status
 * @returns {string} data.orders[].order_date - Order creation date
 * @returns {number} data.orders[].total_amount - Total order amount
 * @returns {number} data.orders[].item_count - Number of items in order
 * @returns {Array} data.orders[].items - Order items with product info
 * @returns {Object} data.orders[].summary - Calculated order totals
 * @returns {Object} data.orders[].shipping_address - Shipping address details
 * @returns {Object} data.pagination - Pagination metadata
 * @returns {number} data.pagination.total - Total number of orders
 * @returns {number} data.pagination.total_pages - Total number of pages
 * @returns {number} data.pagination.current_page - Current page number
 * @returns {boolean} data.pagination.has_next_page - Whether next page exists
 * @returns {boolean} data.pagination.has_previous_page - Whether previous page exists
 * @api {get} /api/orders/my-orders Get User Orders
 * @private user
 * @example
 * // Request
 * GET /api/orders/my-orders?page=1&limit=5&status=delivered
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "orders": [
 *       {
 *         "id": 12345,
 *         "order_number": "#000012345",
 *         "status": "delivered",
 *         "payment_status": "paid",
 *         "order_date": "2024-09-26T05:00:00.000Z",
 *         "total_amount": 25000,
 *         "item_count": 3,
 *         "items": [...],
 *         "summary": {
 *           "subtotal": 20000,
 *           "shipping": 1500,
 *           "tax": 500,
 *           "total": 22000
 *         },
 *         "shipping_address": {...}
 *       }
 *     ],
 *     "pagination": {
 *       "total": 25,
 *       "total_pages": 5,
 *       "current_page": 1,
 *       "has_next_page": true,
 *       "has_previous_page": false
 *     }
 *   }
 * }
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
 * Verifies payment completion with the payment gateway and updates order status accordingly.
 * Handles successful payments by marking orders as paid and processing, failed payments by updating transaction status.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.reference - Payment reference from payment gateway
 * @param {Object} [req.user] - Authenticated user info (optional for webhook calls)
 * @param {number} [req.user.id] - User ID for additional validation
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with payment verification result
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @returns {Object} data - Response data container
 * @returns {number} data.orderId - Order ID
 * @returns {string} data.status - Updated order status ('processing')
 * @returns {string} data.paymentStatus - Updated payment status ('paid')
 * @returns {string} data.reference - Payment reference
 * @throws {Error} 400 - When payment verification fails or invalid reference
 * @throws {Error} 404 - When transaction not found
 * @api {get} /api/orders/verify-payment/:reference Verify Payment
 * @private user
 * @example
 * // Request
 * GET /api/orders/verify-payment/STYLAY-1234567890-12345
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Payment verified successfully",
 *   "data": {
 *     "orderId": 12345,
 *     "status": "processing",
 *     "paymentStatus": "paid",
 *     "reference": "STYLAY-1234567890-12345"
 *   }
 * }
 */
async function verifyPayment(req, res) {
  const transaction = await sequelize.transaction();
  let transactionRecord;

  try {
    const { reference } = req.params;
    const userId = req.user?.id; // Make optional for webhook calls

    // Find the payment transaction by reference
    transactionRecord = await PaymentTransaction.findOne({
      where: { transaction_id: reference },
      include: [
        {
          model: Order,
          as: "order",
          where: userId ? { user_id: userId } : undefined,
          required: true,
        },
      ],
      transaction,
    });

    if (!transactionRecord) {
      throw new Error("Transaction not found");
    }

    const { order } = transactionRecord;

    // Skip if already verified
    if (transactionRecord.status === "success") {
      return res.status(200).json({
        status: "success",
        message: "Payment already verified",
        data: {
          orderId: order.id,
          status: order.order_status,
          paymentStatus: order.payment_status,
          reference: transactionRecord.transaction_id,
        },
      });
    }

    // Fetch the full order with items for email
    const fullOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "price"],
            },
          ],
        },
      ],
    });

    // Verify with payment gateway
    const verification = await paymentService.verifyPayment(reference);

    if (!verification.status || verification.data.status !== "success") {
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
    await order.update(
      {
        payment_status: "paid",
        paid_at: new Date(),
        order_status: "processing",
      },
      { transaction }
    );

    // Commit the transaction before sending emails
    await transaction.commit();

    // Send notifications after successful commit
    try {
      // Send payment confirmation email
      await emailService.sendPaymentReceived(fullOrder, order.user_id, {
        amount: order.total_amount,
        paymentMethod: order.payment_method,
        transactionDate: new Date(),
        reference: verification.data.reference,
      });

      // Notify vendors
      await emailService.notifyVendors(order.id);

      // Create notification
      const now = new Date();
      await Notification.create({
        user_id: order.user_id,
        type: "order_received",
        title: `Payment Received for Order #${order.id}`,
        message: `Payment of ₦${order.total_amount.toLocaleString()} for order #${
          order.id
        } was successful`,
        is_read: false,
        metadata: {
          orderId: order.id,
          amount: order.total_amount,
          paymentMethod: order.payment_method,
        },
        created_at: now,
        updated_at: now,
      });
    } catch (emailError) {
      logger.error("Error sending notifications:", emailError);
      // Don't fail the request if notifications fail
    }

    res.status(200).json({
      status: "success",
      message: "Payment verified successfully",
      data: {
        orderId: order.id,
        status: "processing",
        paymentStatus: "paid",
        reference: transactionRecord.transaction_id,
      },
    });
  } catch (error) {
    // Only rollback if transaction hasn't been committed yet
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error("Error rolling back transaction:", rollbackError);
    }

    logger.error("Payment verification failed:", error);

    // Update transaction as failed if it exists
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
 * Processes payment webhooks from the payment gateway.
 * Handles asynchronous payment notifications and updates order status accordingly.
 * This endpoint is called directly by the payment provider and should be secured.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.body - Webhook payload from payment gateway
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming webhook processing
 * @returns {boolean} status - Success status
 * @returns {Object} data - Webhook processing result
 * @throws {Error} 400 - When webhook signature verification fails or processing errors occur
 * @api {post} /api/webhooks/payment Handle Payment Webhook
 * @public
 * @example
 * // Webhook payload (sent by payment gateway)
 * POST /api/webhooks/payment
 * {
 *   "event": "charge.success",
 *   "data": {
 *     "reference": "STYLAY-1234567890-12345",
 *     "amount": 25000,
 *     "status": "success"
 *   }
 * }
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Webhook processed successfully"
 * }
 */
async function handlePaymentWebhook(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const event = req.body;

    // Verify webhook signature
    const result = await paymentService.handleWebhook(event);

    await transaction.commit();
    res.status(200).json(result);
  } catch (error) {
    // Only rollback if transaction hasn't been committed yet
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error("Error rolling back transaction:", rollbackError);
    }

    logger.error("Webhook processing failed:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Webhook processing failed",
    });
  }
}

/**
 * Cancels a pending or processing order and restores inventory.
 * Handles refund processing for paid orders and sends cancellation notifications.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Order ID to cancel
 * @param {Object} req.body - Request body
 * @param {string} [req.body.reason] - Reason for cancellation
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for ownership verification and audit trail
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming order cancellation
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @returns {Object} data - Response data container
 * @returns {number} data.orderId - Cancelled order ID
 * @returns {string} data.status - Order status ('cancelled')
 * @returns {string} data.cancelledAt - Cancellation timestamp
 * @throws {Error} 400 - When order cannot be cancelled (already shipped/delivered) or not found
 * @api {patch} /api/orders/:id/cancel Cancel Order
 * @private user
 * @example
 * // Request
 * PATCH /api/orders/12345/cancel
 * Authorization: Bearer <token>
 * {
 *   "reason": "Changed my mind about the purchase"
 * }
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Order cancelled successfully",
 *   "data": {
 *     "orderId": 12345,
 *     "status": "cancelled",
 *     "cancelledAt": "2024-09-26T06:00:00.000Z"
 *   }
 * }
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
        { model: OrderItem, as: "items", include: [Product] },
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
          await sequelize.models.InventoryHistory.create(
            {
              inventory_id: inventory.id,
              adjustment: item.quantity, // Positive for stock in
              previous_stock: previousStock,
              new_stock: newStock,
              note: `Order #${order.id} cancelled: Stock restored`,
              adjusted_by: req.user.id,
            },
            { transaction }
          );
        }
        return true;
      })
    );
      // Restore variant stock if variantId is provided
      await Promise.all(
        order.order_items.map(async (item) => {
          if (item.variant_id) {
            await ProductVariant.increment("stock", {
              by: item.quantity,
              where: { id: item.variant_id },
              transaction,
            });
          }
          return true;
        })
      );

      // Decrement sold_units for cancelled products since they weren't actually sold
      await Promise.all(
        order.order_items.map(async (item) => {
          await Product.decrement('sold_units', {
            by: item.quantity,
            where: { id: item.product_id },
            transaction,
          });
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
          type: "refund",
          amount: order.total_amount,
          status: "pending",
          transaction_id: `REFUND-${Date.now()}-${order.id}`,
          description: `Refund for cancelled order #${order.id}`,
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
    // Only rollback if transaction hasn't been committed yet
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error("Error rolling back transaction:", rollbackError);
    }

    logger.error("Error cancelling order:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to cancel order",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Retrieves orders that contain products from the authenticated vendor.
 * Shows order information for vendor order management and fulfillment.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.status] - Filter orders by status
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of orders per page
 * @param {Object} req.user - Authenticated vendor user info
 * @param {number} req.user.id - Vendor user ID for filtering
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor's orders
 * @returns {boolean} status - Success status
 * @returns {Object} data - Response data container
 * @returns {number} data.total - Total number of orders
 * @returns {number} data.page - Current page number
 * @returns {number} data.limit - Items per page
 * @returns {Array} data.orders - Array of order objects
 * @returns {number} data.orders[].id - Order ID
 * @returns {string} data.orders[].order_date - Order date
 * @returns {number} data.orders[].total_amount - Order total
 * @returns {string} data.orders[].order_status - Order status
 * @returns {Array} data.orders[].order_items - Order items belonging to vendor
 * @returns {Object} data.orders[].user - Customer information
 * @api {get} /api/orders/vendor/orders Get Vendor Orders
 * @private vendor
 * @example
 * // Request
 * GET /api/orders/vendor/orders?page=1&limit=10&status=processing
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "total": 25,
 *     "page": 1,
 *     "limit": 10,
 *     "orders": [
 *       {
 *         "id": 12345,
 *         "order_date": "2024-09-26T05:00:00.000Z",
 *         "total_amount": 25000,
 *         "order_status": "processing",
 *         "order_items": [...],
 *         "user": {
 *           "id": 678,
 *           "first_name": "John",
 *           "last_name": "Doe",
 *           "email": "john@example.com"
 *         }
 *       }
 *     ]
 *   }
 * }
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
 * Updates the status of individual order items for vendor-specific fulfillment.
 * Allows vendors to update status of their products within orders independently.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Order item ID to update
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - New item status ('processing', 'shipped', 'cancelled')
 * @param {string} [req.body.notes] - Status update notes
 * @param {Object} req.user - Authenticated vendor user info
 * @param {number} req.user.id - Vendor user ID for ownership verification
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming item status update
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @returns {Object} data - Response data container
 * @returns {number} data.orderItemId - Updated order item ID
 * @returns {string} data.status - New item status
 * @returns {string} data.updatedAt - Update timestamp
 * @throws {Error} 400 - When invalid status or item not found/belongs to different vendor
 * @api {patch} /api/orders/items/:id/status Update Order Item Status
 * @private vendor
 * @example
 * // Request
 * PATCH /api/orders/items/987/status
 * Authorization: Bearer <vendor_token>
 * {
 *   "status": "shipped",
 *   "notes": "Item shipped via DHL"
 * }
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Order item status updated successfully",
 *   "data": {
 *     "orderItemId": 987,
 *     "status": "shipped",
 *     "updatedAt": "2024-09-26T06:00:00.000Z"
 *   }
 * }
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
          as: "order",
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
    // Only rollback if transaction hasn't been committed yet
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error("Error rolling back transaction:", rollbackError);
    }

    logger.error("Error updating order item status:", error);
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to update order item status",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Retrieves a comprehensive list of all orders with admin-level filtering and pagination.
 * Provides complete order information for administrative oversight and management.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.status] - Filter orders by status
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of orders per page (higher default for admin)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with comprehensive order listing
 * @returns {boolean} status - Success status
 * @returns {Object} data - Response data container
 * @returns {number} data.total - Total number of orders
 * @returns {number} data.page - Current page number
 * @returns {number} data.limit - Items per page
 * @returns {Array} data.orders - Array of detailed order objects
 * @returns {number} data.orders[].id - Order ID
 * @returns {string} data.orders[].order_date - Order creation date
 * @returns {string} data.orders[].order_status - Order fulfillment status
 * @returns {string} data.orders[].payment_status - Payment status
 * @returns {number} data.orders[].total_amount - Order total amount
 * @returns {Object} data.orders[].user - Customer information
 * @returns {Array} data.orders[].order_items - Order items with product and vendor details
 * @api {get} /api/orders Get All Orders (Admin)
 * @private admin
 * @example
 * // Request
 * GET /api/orders?page=1&limit=20&status=processing
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "total": 150,
 *     "page": 1,
 *     "limit": 20,
 *     "orders": [
 *       {
 *         "id": 12345,
 *         "order_date": "2024-09-26T05:00:00.000Z",
 *         "order_status": "processing",
 *         "payment_status": "paid",
 *         "total_amount": 25000,
 *         "user": {
 *           "id": 678,
 *           "first_name": "John",
 *           "last_name": "Doe",
 *           "email": "john@example.com"
 *         },
 *         "order_items": [
 *           {
 *             "id": 987,
 *             "quantity": 2,
 *             "price": 12500,
 *             "product": {
 *               "id": 456,
 *               "name": "Wireless Headphones"
 *             },
 *             "vendor": {
 *               "id": 1,
 *               "business_name": "Tech Store",
 *               "email": "vendor@example.com"
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
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
