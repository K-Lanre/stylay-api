const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/order.controller");
const { protect, isAdmin } = require("../../middlewares/auth");

// Apply authentication middleware to all routes except webhook
router.use(protect);

// Admin routes
router.get("/", isAdmin, orderController.getAllOrders);
router.patch("/:id/status", isAdmin, orderController.updateOrderStatus);

module.exports = router;
