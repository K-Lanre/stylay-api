'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Drop the 'stock' column
    await queryInterface.removeColumn('inventory', 'stock');

    // Add unique constraint to product_id
    await queryInterface.changeColumn('inventory', 'product_id', {
      type: Sequelize.BIGINT({ unsigned: true }),
      allowNull: false,
      unique: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Re-add the 'stock' column
    await queryInterface.addColumn('inventory', 'stock', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    // Remove unique constraint from product_id
    await queryInterface.changeColumn('inventory', 'product_id', {
      type: Sequelize.BIGINT({ unsigned: true }),
      allowNull: false,
      unique: false
    });
  }
};
