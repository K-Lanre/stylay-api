const express = require('express');
const router = express.Router();

// Import admin sub-routes
const productRoutes = require('./product.route');
const categoryRoutes = require('./category.route');
const collectionRoutes = require('./collection.route');
const dashboardRoutes = require('./dashboard.route');
const inventoryRoutes = require('./inventory.route');
const journalRoutes = require('./journal.route');
const roleRoutes = require('./role.route');
const orderRoutes = require('./order.route');

// Mount sub-routes
router.use('/categories', categoryRoutes);
router.use('/collections', collectionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/journal', journalRoutes);
router.use('/roles', roleRoutes);
router.use('/orders', orderRoutes);

module.exports = router;