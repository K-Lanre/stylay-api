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

    // Note: MySQL doesn't support direct indexing on JSON columns
    // The selected_variants column will be searched without an index
    // This is acceptable for now as order queries typically filter by order_id and product_id first
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the index first
    await queryInterface.removeIndex('order_items', 'order_items_selected_variants_idx');

    // Remove the selected_variants column
    await queryInterface.removeColumn('order_items', 'selected_variants');
  }
};