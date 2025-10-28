'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add variant_type_id column to product_variants table
    await queryInterface.addColumn('product_variants', 'variant_type_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true, // Allow null for backward compatibility
      references: {
        model: 'variant_types',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: 'Reference to variant type (Color, Size, etc.)'
    });

    // Add index for performance
    await queryInterface.addIndex('product_variants', ['variant_type_id'], {
      name: 'product_variants_variant_type_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraint first
    await queryInterface.removeConstraint('product_variants', 'product_variants_variant_type_id_foreign');

    // Remove index
    await queryInterface.removeIndex('product_variants', 'product_variants_variant_type_id_idx');

    // Remove the column
    await queryInterface.removeColumn('product_variants', 'variant_type_id');
  }
};
