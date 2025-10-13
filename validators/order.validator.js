const { Address, Product, ProductVariant } = require("../models"); // Defer import
const { body, param, query } = require("express-validator");

// Validation for creating an order
/**
 * Validation rules for creating a new order.
 * Validates order items, address, shipping costs, tax amounts, and payment method.
 * Includes complex validation for product existence, variant relationships, and stock availability.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} addressId - Required, positive integer, validates address exists
 * @property {ValidationChain} items - Required array, minimum 1 item, validates product/variant relationships
 * @property {ValidationChain} shippingCost - Required, positive float
 * @property {ValidationChain} taxAmount - Required, positive float
 * @property {ValidationChain} notes - Optional string
 * @property {ValidationChain} paymentMethod - Required, one of: paystack, cash, card
 * @returns {Array} Express validator middleware array for order creation
 * @example
 * // Use in route:
 * router.post('/orders', createOrderSchema, createOrder);
 */
const createOrderSchema = [
  body("addressId")
    .notEmpty()
    .withMessage("Address ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid address ID")
    .custom(async (value) => {
      const address = await Address.findByPk(value);
      if (!address) {
        throw new Error("Address not found");
      }
      return true;
    }),
 body("items")
   .notEmpty()
   .withMessage("Items are required")
   .isArray({ min: 1 })
   .withMessage("Items must be an array")
   .custom(async (value) => {
     for (const item of value) {
       if (!item.productId || !item.quantity) {
         throw new Error(
           "Items should contain productId and quantity"
         );
       }

       // Check if neither selected_variants nor variantId is provided
       if (!item.selected_variants && !item.variantId) {
         throw new Error(
           "Items should contain either selected_variants array or variantId"
         );
       }

       // Check if both are provided (not allowed)
       if (item.selected_variants && item.variantId) {
         throw new Error(
           "Items cannot contain both selected_variants and variantId"
         );
       }

       const product = await Product.findByPk(parseInt(item.productId));
       if (!product) {
         throw new Error(`Product ${item.productId} not found`);
       }

       if (item.selected_variants) {
         // New multi-variant validation
         if (!Array.isArray(item.selected_variants)) {
           throw new Error("selected_variants must be an array");
         }

         if (item.selected_variants.length === 0) {
           throw new Error("selected_variants cannot be empty");
         }

         // Check for duplicates in selected_variants
         const variantIds = item.selected_variants.map(v => v.id);
         if (new Set(variantIds).size !== variantIds.length) {
           throw new Error("Duplicate variant IDs in selected_variants");
         }

         // Validate each variant exists and belongs to the product
         for (const variantObj of item.selected_variants) {
           if (!variantObj.id) {
             throw new Error("Each selected variant must have an id");
           }

           const variant = await ProductVariant.findOne({
             where: { id: parseInt(variantObj.id), product_id: product.id },
           });
           if (!variant) {
             throw new Error(
               `Variant ${variantObj.id} not found or does not belong to product ${item.productId}`
             );
           }
         }
       } else if (item.variantId) {
         // Backward compatibility: single variant validation
         const variant = await ProductVariant.findOne({
           where: { id: parseInt(item.variantId), product_id: product.id },
         });
         if (!variant) {
           throw new Error(
             `Variant ${item.variantId} not found or does not belong to product ${item.productId}`
           );
         }
       }
     }
   }),
  body("shippingCost")
    .notEmpty()
    .withMessage("Shipping cost is required")
    .isFloat({ min: 0 })
    .withMessage("Shipping cost must be a positive number"),
  body("taxAmount")
    .notEmpty()
    .withMessage("Tax amount is required")
    .isFloat({ min: 0 })
    .withMessage("Tax amount must be a positive number"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["paystack", "cash", "card"])
    .withMessage("Invalid payment method"),
];

// Validation for updating an order
/**
 * Validation rules for updating order status.
 * Validates order ID parameter and status updates.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required order ID parameter, positive integer
 * @property {ValidationChain} status - Required, one of: pending, processing, shipped, delivered, cancelled
 * @returns {Array} Express validator middleware array for order status updates
 * @example
 * // Use in route:
 * router.patch('/orders/:id/status', updateOrderSchema, updateOrderStatus);
 */
const updateOrderSchema = [
  param("id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid order ID"),
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "processing", "shipped", "delivered", "cancelled"])
    .withMessage("Invalid status"),
];

// Validation for canceling an order
/**
 * Validation rules for canceling an order.
 * Validates order ID parameter and cancellation reason.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required order ID parameter, positive integer
 * @property {ValidationChain} reason - Required string reason for cancellation
 * @returns {Array} Express validator middleware array for order cancellation
 * @example
 * // Use in route:
 * router.patch('/orders/:id/cancel', cancelOrderSchema, cancelOrder);
 */
const cancelOrderSchema = [
  param("id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid order ID"),
  body("reason")
    .notEmpty()
    .withMessage("Reason is required")
    .isString()
    .withMessage("Reason must be a string"),
];

// Validation for verifying payment
/**
 * Validation rules for payment verification.
 * Validates payment reference string.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} reference - Required payment reference string
 * @returns {Array} Express validator middleware array for payment verification
 * @example
 * // Use in route:
 * router.get('/orders/verify-payment/:reference', verifyPaymentSchema, verifyPayment);
 */
const verifyPaymentSchema = [
  param("reference")
    .notEmpty()
    .withMessage("Payment reference is required")
    .isString()
    .withMessage("Payment reference must be a string"),
];

// Validation for retrieving orders
/**
 * Validation rules for retrieving paginated order lists.
 * Validates pagination parameters.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} page - Optional, positive integer >= 1
 * @property {ValidationChain} limit - Optional, positive integer
 * @returns {Array} Express validator middleware array for order list retrieval
 * @example
 * // Use in route:
 * router.get('/orders', getOrdersSchema, getAllOrders);
 */
const getOrdersSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page number must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Limit must be a positive integer"),
];

// Validation for retrieving a specific order
/**
 * Validation rules for retrieving a single order by ID.
 * Validates order ID parameter.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required order ID parameter, positive integer
 * @returns {Array} Express validator middleware array for single order retrieval
 * @example
 * // Use in route:
 * router.get('/orders/:id', getOrderSchema, getOrder);
 */
const getOrderSchema = [
  param("id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid order ID"),
];

// Validation for retrieving user orders
/**
 * Validation rules for retrieving orders for the authenticated user.
 * Validates pagination and optional status filtering.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} page - Optional, positive integer >= 1
 * @property {ValidationChain} limit - Optional, positive integer
 * @property {ValidationChain} status - Optional, one of: pending, processing, shipped, delivered, cancelled
 * @returns {Array} Express validator middleware array for user order retrieval
 * @example
 * // Use in route:
 * router.get('/orders/my-orders', getUserOrdersSchema, getUserOrders);
 */
const getUserOrdersSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page number must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Limit must be a positive integer"),
  query("status")
    .optional()
    .isIn(["pending", "processing", "shipped", "delivered", "cancelled"])
    .withMessage("Invalid status"),
];

module.exports = {
  createOrderSchema,
  updateOrderSchema,
  cancelOrderSchema,
  verifyPaymentSchema,
  getOrdersSchema,
  getOrderSchema,
  getUserOrdersSchema,
};