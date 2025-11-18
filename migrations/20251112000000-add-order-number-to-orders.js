'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add order_number column to orders table
    await queryInterface.addColumn('orders', 'order_number', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    }, { after: 'user_id' });

    // Create index for order_number for faster lookups
    await queryInterface.addIndex('orders', ['order_number'], {
      name: 'orders_order_number_idx'
    });

    // Generate order numbers for existing orders
    const orders = await queryInterface.sequelize.query(
      'SELECT id FROM orders ORDER BY id ASC',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Update each existing order with a generated order number
    for (const order of orders) {
      const timestamp = Date.now();
      const paddedId = String(order.id).padStart(8, '0');
      const orderNumber = `STY-${timestamp}-${paddedId}`;

      await queryInterface.sequelize.query(
        'UPDATE orders SET order_number = ? WHERE id = ?',
        { replacements: [orderNumber, order.id] }
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the index first
    await queryInterface.removeIndex('orders', 'orders_order_number_idx');

    // Remove the order_number column
    await queryInterface.removeColumn('orders', 'order_number');
  }
};
