'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('order_details', 'shipping_cost', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    await queryInterface.addColumn('order_details', 'tax_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('order_details', 'shipping_cost');
    await queryInterface.removeColumn('order_details', 'tax_amount');
  }
};
