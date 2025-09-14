const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const {
  createOrderValidation,
  getOrdersValidation,
  getOrderValidation,
  updateOrderStatusValidation,
  cancelOrderValidation,
  verifyPaymentValidation,
} = require("../validators/order.validator");
const { protect, isVendor, isAdmin } = require("../middlewares/auth");
const { validate } = require("../middlewares/validation");

// Apply authentication middleware to all routes except webhook
router.use((req, res, next) => {
  if (req.path === '/webhook/payment') {
    return next();
  }
  protect(req, res, next);
});

// Customer routes
router.post("/", orderController.createOrder);
router.get("/my-orders", orderController.getUserOrders);
router.get("/:id", orderController.getOrder);
router.patch("/:id/cancel", orderController.cancelOrder);

// Payment routes
router.get(
  "/verify-payment/:reference",
  verifyPaymentValidation,
  orderController.verifyPayment
);

// Webhook for payment gateway callbacks (public)
router.post(
  "/webhook/payment",
  express.raw({ type: 'application/json' }), // Parse raw body for webhook verification
  orderController.handlePaymentWebhook
);

// Vendor routes
router.get(
  "/vendor/orders",
  isVendor,
  orderController.getVendorOrders
);

router.patch(
  "/items/:id/status",
  isVendor,
  orderController.updateOrderItemStatus
);

// Admin routes
router.get("/", isAdmin, orderController.getAllOrders);
router.patch(
  "/:id/status",
  isAdmin,
  orderController.updateOrderStatus
);

module.exports = router;
