'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create variant_types table for categorizing variant dimensions
    await queryInterface.createTable('variant_types', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Internal identifier for variant type (e.g., "color", "size")'
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'User-friendly display name (e.g., "Color", "Size")'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Display order for variant types'
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
    await queryInterface.addIndex('variant_types', ['name'], {
      name: 'variant_types_name_idx',
      unique: true
    });

    await queryInterface.addIndex('variant_types', ['sort_order'], {
      name: 'variant_types_sort_order_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('variant_types', 'variant_types_name_idx');
    await queryInterface.removeIndex('variant_types', 'variant_types_sort_order_idx');

    // Drop the table
    await queryInterface.dropTable('variant_types');
  }
};
