'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create junction table for variant combinations and product variants
    await queryInterface.createTable('variant_combination_variants', {
      combination_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'variant_combinations',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Reference to variant combination'
      },
      variant_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'product_variants',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Reference to product variant'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Composite primary key
    await queryInterface.addConstraint('variant_combination_variants', {
      type: 'primary key',
      fields: ['combination_id', 'variant_id'],
      name: 'variant_combination_variants_pkey'
    });

    // Add indexes for performance
    await queryInterface.addIndex('variant_combination_variants', ['combination_id'], {
      name: 'variant_combination_variants_combination_id_idx'
    });

    await queryInterface.addIndex('variant_combination_variants', ['variant_id'], {
      name: 'variant_combination_variants_variant_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('variant_combination_variants', 'variant_combination_variants_combination_id_idx');
    await queryInterface.removeIndex('variant_combination_variants', 'variant_combination_variants_variant_id_idx');

    // Drop the table
    await queryInterface.dropTable('variant_combination_variants');
  }
};
