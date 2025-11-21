'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add combination_id column to order_items table
    await queryInterface.addColumn('order_items', 'combination_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'variant_combinations',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: 'Reference to variant combination for complex variant selections'
    });

    // Add index for performance
    await queryInterface.addIndex('order_items', ['combination_id'], {
      name: 'order_items_combination_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('order_items', 'order_items_combination_id_idx');

    // Remove the column
    await queryInterface.removeColumn('order_items', 'combination_id');
  }
};
