'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'payment_reference', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'payment_method'
    });

    await queryInterface.addColumn('orders', 'paid_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'payment_reference'
    });

    // Add index for payment_reference for faster lookups
    await queryInterface.addIndex('orders', ['payment_reference'], {
      name: 'orders_payment_reference_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('orders', 'orders_payment_reference_idx');
    await queryInterface.removeColumn('orders', 'paid_at');
    await queryInterface.removeColumn('orders', 'payment_reference');
  }
};
