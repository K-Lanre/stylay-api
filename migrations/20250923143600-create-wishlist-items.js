'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wishlist_items', {
      id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      wishlist_id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        references: {
          model: 'wishlists',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      price_at_addition: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0
        },
        comment: 'Price at the time item was added to wishlist'
      },
      added_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    }, {
      indexes: [
        {
          unique: true,
          fields: ['wishlist_id', 'product_id'],
          name: 'unique_wishlist_product'
        },
        {
          fields: ['wishlist_id']
        },
        {
          fields: ['product_id']
        },
        {
          fields: ['added_at']
        }
      ]
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('wishlist_items');
  }
};
