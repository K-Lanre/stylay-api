'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add selected_variants JSON column to order_items table
    await queryInterface.addColumn('order_items', 'selected_variants', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'JSON array/object storing selected product variants for complex variant selections'
    });

    // Add an index on selected_variants for performance (functional index for JSON)
    // Note: This creates a BTREE index on the JSON column, which can speed up JSON searches
    await queryInterface.addIndex('order_items', ['selected_variants'], {
      name: 'order_items_selected_variants_idx',
      using: 'BTREE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the index first
    await queryInterface.removeIndex('order_items', 'order_items_selected_variants_idx');

    // Remove the selected_variants column
    await queryInterface.removeColumn('order_items', 'selected_variants');
  }
};