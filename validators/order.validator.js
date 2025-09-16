const { Address, Product, ProductVariant } = require("../models"); // Defer import
const { body, param, query } = require("express-validator");

// Validation for creating an order
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
        if (!item.productId || !item.quantity || !item.variantId) {
          throw new Error(
            "Items should contain productId, quantity and variantId"
          );
        }

        const product = await Product.findByPk(parseInt(item.productId));
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const variant = await ProductVariant.findOne({
          where: { id: parseInt(item.variantId), product_id: product.id },
        });
        if (!variant) {
          throw new Error(
            `Variant ${item.variantId} not found or does not belong to product ${item.productId}`
          );
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
const verifyPaymentSchema = [
  param("reference")
    .notEmpty()
    .withMessage("Payment reference is required")
    .isString()
    .withMessage("Payment reference must be a string"),
];

// Validation for retrieving orders
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
const getOrderSchema = [
  param("id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid order ID"),
];

// Validation for retrieving user orders
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