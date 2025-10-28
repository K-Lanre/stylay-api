'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create variant_combinations table for tracking specific combinations
    await queryInterface.createTable('variant_combinations', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Product this combination belongs to'
      },
      combination_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Human-readable combination name (e.g., "Black-Large", "Blue-Medium")'
      },
      sku_suffix: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'SKU suffix for this combination (e.g., "BL", "BM")'
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Available stock for this specific combination'
      },
      price_modifier: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Price adjustment for this combination (can be negative)'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this combination is available for purchase'
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

    // Add indexes for performance
    await queryInterface.addIndex('variant_combinations', ['product_id'], {
      name: 'variant_combinations_product_id_idx'
    });

    await queryInterface.addIndex('variant_combinations', ['combination_name'], {
      name: 'variant_combinations_name_idx'
    });

    await queryInterface.addIndex('variant_combinations', ['is_active'], {
      name: 'variant_combinations_active_idx'
    });

    await queryInterface.addIndex('variant_combinations', ['stock'], {
      name: 'variant_combinations_stock_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_product_id_idx');
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_name_idx');
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_active_idx');
    await queryInterface.removeIndex('variant_combinations', 'variant_combinations_stock_idx');

    // Drop the table
    await queryInterface.dropTable('variant_combinations');
  }
};
