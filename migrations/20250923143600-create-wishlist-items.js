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
      variant_id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: true,
        references: {
          model: 'product_variants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      quantity: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
          max: 999
        }
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0
        },
        comment: 'Price at the time item was added to wishlist'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional notes about why this item was added'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Priority level for this wishlist item'
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
          fields: ['wishlist_id', 'product_id', 'variant_id'],
          where: {
            variant_id: {
              [Sequelize.Op.ne]: null
            }
          },
          name: 'unique_wishlist_product_variant'
        },
        {
          fields: ['wishlist_id']
        },
        {
          fields: ['product_id']
        },
        {
          fields: ['variant_id']
        },
        {
          fields: ['priority']
        },
        {
          fields: ['added_at']
        }
      ]
    });

    // Add unique constraint for products without variants
    await queryInterface.addIndex('wishlist_items', ['wishlist_id', 'product_id'], {
      unique: true,
      where: {
        variant_id: null
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('wishlist_items');
  }
};