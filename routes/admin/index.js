const express = require('express');
const router = express.Router();

// Import admin sub-routes
const productRoutes = require('./product.route');
const collectionRoutes = require('./collection.route');
const dashboardRoutes = require('./dashboard.route');
const inventoryRoutes = require('./inventory.route');
const journalRoutes = require('./journal.route');
const orderRoutes = require('./order.route');
const supplyRoutes = require('./supply.route');
const webhookRoutes = require('./webhook.route');

// Mount sub-routes
router.use('/collections', collectionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/journal', journalRoutes);
router.use('/orders', orderRoutes);
router.use('/supplies', supplyRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
