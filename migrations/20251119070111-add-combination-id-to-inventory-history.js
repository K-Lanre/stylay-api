'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('inventory_history', 'combination_id', {
      type: Sequelize.BIGINT({ unsigned: true }),
      allowNull: true,
      references: {
        model: 'variant_combinations',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for combination_id
    await queryInterface.addIndex('inventory_history', ['combination_id']);

    // Change 'adjustment' to 'change_amount'
    await queryInterface.renameColumn('inventory_history', 'adjustment', 'change_amount');

    // Add 'change_type' column
    await queryInterface.addColumn('inventory_history', 'change_type', {
      type: Sequelize.ENUM('supply', 'sale', 'return', 'manual_adjustment', 'other'),
      allowNull: false,
      defaultValue: 'manual_adjustment'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove 'change_type' column
    await queryInterface.removeColumn('inventory_history', 'change_type');

    // Change 'change_amount' back to 'adjustment'
    await queryInterface.renameColumn('inventory_history', 'change_amount', 'adjustment');

    // Remove index for combination_id
    await queryInterface.removeIndex('inventory_history', ['combination_id']);

    // Remove 'combination_id' column
    await queryInterface.removeColumn('inventory_history', 'combination_id');
  }
};
