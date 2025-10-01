'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add foreign key constraint for cart_id
    await queryInterface.addConstraint('cart_items', {
      fields: ['cart_id'],
      type: 'foreign key',
      name: 'cart_items_cart_id_fkey',
      references: {
        table: 'carts',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Add foreign key constraint for product_id
    await queryInterface.addConstraint('cart_items', {
      fields: ['product_id'],
      type: 'foreign key',
      name: 'cart_items_product_id_fkey',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraints
    await queryInterface.removeConstraint('cart_items', 'cart_items_cart_id_fkey');
    await queryInterface.removeConstraint('cart_items', 'cart_items_product_id_fkey');
  }
};