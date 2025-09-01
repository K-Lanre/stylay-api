'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wishlist_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      wishlist_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      variant_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
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

    await queryInterface.addIndex('wishlist_items', ['wishlist_id', 'product_id', 'variant_id'], { name: 'wishlist_items_composite_idx', unique: true });
    await queryInterface.addIndex('wishlist_items', ['wishlist_id'], { name: 'wishlist_items_wishlist_id_idx' });
    await queryInterface.addIndex('wishlist_items', ['product_id'], { name: 'wishlist_items_product_id_idx' });
    await queryInterface.addIndex('wishlist_items', ['variant_id'], { name: 'wishlist_items_variant_id_idx' });

    await queryInterface.addConstraint('wishlist_items', {
      type: 'foreign key',
      fields: ['wishlist_id'],
      name: 'wishlist_items_ibfk_1',
      references: {
        table: 'wishlists',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('wishlist_items', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'wishlist_items_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('wishlist_items', {
      type: 'foreign key',
      fields: ['variant_id'],
      name: 'wishlist_items_ibfk_3',
      references: {
        table: 'product_variants',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('wishlist_items');
  }
};