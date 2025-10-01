'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the unique constraints that don't work properly in MySQL (no partial indexes support)
    await queryInterface.removeConstraint('cart_items', 'cart_items_unique_cart_product_variant');
    await queryInterface.removeConstraint('cart_items', 'cart_items_unique_cart_product_no_variant');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the constraints (though they won't be partial in MySQL)
    await queryInterface.addConstraint('cart_items', {
      fields: ['cart_id', 'product_id', 'selected_variants'],
      type: 'unique',
      name: 'cart_items_unique_cart_product_variant',
      where: {
        selected_variants: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addConstraint('cart_items', {
      fields: ['cart_id', 'product_id'],
      type: 'unique',
      name: 'cart_items_unique_cart_product_no_variant',
      where: {
        selected_variants: null
      }
    });
  }
};