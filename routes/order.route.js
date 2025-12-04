const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { protect, isVendor } = require("../middlewares/auth");

// Apply authentication middleware to all routes except webhook
router.use((req, res, next) => {
  if (req.path === "/webhook/payment") {
    return next();
  }
  protect(req, res, next);
});

// Customer routes
router.post("/", orderController.createOrder);
router.post("/from-cart", orderController.createOrderFromCart);
router.get("/my-orders", orderController.getUserOrders);
router.get("/:id", orderController.getOrder);
router.patch("/:id/cancel", orderController.cancelOrder);

// Payment routes
router.get("/verify-payment/:reference", orderController.verifyPayment);

// Webhook for payment gateway callbacks (public)
router.post(
  "/webhook/payment",
  express.raw({ type: "application/json" }), // Parse raw body for webhook verification
  orderController.handlePaymentWebhook
);

// Vendor routes
router.get("/vendor/orders", isVendor, orderController.getVendorOrders);

router.patch(
  "/items/:id/status",
  isVendor,
  orderController.updateOrderItemStatus
);

module.exports = router;
