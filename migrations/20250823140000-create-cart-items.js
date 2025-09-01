'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cart_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      cart_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('cart_items', ['cart_id', 'product_id'], { name: 'cart_items_cart_product_idx', unique: true });
    await queryInterface.addIndex('cart_items', ['cart_id'], { name: 'cart_items_cart_id_idx' });
    await queryInterface.addIndex('cart_items', ['product_id'], { name: 'cart_items_product_id_idx' });

    await queryInterface.addConstraint('cart_items', {
      type: 'foreign key',
      fields: ['cart_id'],
      name: 'cart_items_ibfk_1',
      references: {
        table: 'carts',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cart_items', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'cart_items_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cart_items');
  }
};