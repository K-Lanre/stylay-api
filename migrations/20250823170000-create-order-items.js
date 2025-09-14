'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('order_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      vendor_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      variant_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      sub_total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('order_items', ['order_id'], { name: 'order_items_order_id_idx' });
    await queryInterface.addIndex('order_items', ['product_id'], { name: 'order_items_product_id_idx' });
    await queryInterface.addIndex('order_items', ['vendor_id'], { name: 'order_items_vendor_id_idx' });
    await queryInterface.addIndex('order_items', ['variant_id'], { name: 'order_items_variant_id_idx' });

    await queryInterface.addConstraint('order_items', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'order_items_ibfk_1',
      references: {
        table: 'orders',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('order_items', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'order_items_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('order_items');
  }
};