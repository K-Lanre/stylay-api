'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cart_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      cart_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        comment: 'ID of the cart this item belongs to'
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        comment: 'ID of the product'
      },
      variant_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'ID of the product variant (null if no variant)'
      },
      quantity: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: 'Quantity of this item in the cart'
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Unit price of the item at the time it was added'
      },
      total_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        comment: 'Total price for this item (quantity * price)'
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
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('cart_items', ['cart_id'], {
      name: 'cart_items_cart_id_idx'
    });

    await queryInterface.addIndex('cart_items', ['product_id'], {
      name: 'cart_items_product_id_idx'
    });

    await queryInterface.addIndex('cart_items', ['variant_id'], {
      name: 'cart_items_variant_id_idx'
    });

    // Add unique constraint to prevent duplicate items in the same cart
    await queryInterface.addConstraint('cart_items', {
      fields: ['cart_id', 'product_id', 'variant_id'],
      type: 'unique',
      name: 'cart_items_unique_cart_product_variant',
      where: {
        variant_id: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    // Add another unique constraint for items without variants
    await queryInterface.addConstraint('cart_items', {
      fields: ['cart_id', 'product_id'],
      type: 'unique',
      name: 'cart_items_unique_cart_product_no_variant',
      where: {
        variant_id: null
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cart_items');
  }
};