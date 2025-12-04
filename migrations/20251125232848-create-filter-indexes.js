// migrations/20250126000000-create-filter-indexes.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Index on products table
      await queryInterface.addIndex('products', ['status'], {
        transaction,
        name: 'idx_products_status'
      });

      await queryInterface.addIndex('products', ['category_id'], {
        transaction,
        name: 'idx_products_category_id'
      });

      // Composite index for common product queries
      await queryInterface.addIndex('products', ['status', 'category_id'], {
        transaction,
        name: 'idx_products_status_category'
      });

      // Index on product_variants table
      await queryInterface.addIndex('product_variants', ['product_id'], {
        transaction,
        name: 'idx_product_variants_product_id'
      });

      await queryInterface.addIndex('product_variants', ['variant_type_id'], {
        transaction,
        name: 'idx_product_variants_variant_type_id'
      });

      await queryInterface.addIndex('product_variants', ['value'], {
        transaction,
        name: 'idx_product_variants_value'
      });

      // Composite index for variant lookups
      await queryInterface.addIndex(
        'product_variants',
        ['product_id', 'variant_type_id'],
        {
          transaction,
          name: 'idx_product_variants_product_type'
        }
      );

      // Index on variant_types table
      await queryInterface.addIndex('variant_types', ['name'], {
        transaction,
        name: 'idx_variant_types_name'
      });

      // Index on variant_combinations table
      await queryInterface.addIndex('variant_combinations', ['product_id'], {
        transaction,
        name: 'idx_variant_combinations_product_id'
      });

      await queryInterface.addIndex('variant_combinations', ['is_active'], {
        transaction,
        name: 'idx_variant_combinations_is_active'
      });

      // Index on variant_combination_variants (junction table)
      await queryInterface.addIndex(
        'variant_combination_variants',
        ['combination_id'],
        {
          transaction,
          name: 'idx_vcv_combination_id'
        }
      );

      await queryInterface.addIndex('variant_combination_variants', ['variant_id'], {
        transaction,
        name: 'idx_vcv_variant_id'
      });

      // Index on product_images table
      await queryInterface.addIndex('product_images', ['product_id'], {
        transaction,
        name: 'idx_product_images_product_id'
      });

      await queryInterface.addIndex('product_images', ['is_featured'], {
        transaction,
        name: 'idx_product_images_is_featured'
      });

      // Index on categories table
      await queryInterface.addIndex('categories', ['parent_id'], {
        transaction,
        name: 'idx_categories_parent_id'
      });

      await queryInterface.addIndex('categories', ['slug'], {
        transaction,
        name: 'idx_categories_slug'
      });

      await transaction.commit();
      console.log('✓ All indexes created successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('✗ Error creating indexes:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove all indexes
      await queryInterface.removeIndex('products', 'idx_products_status', {
        transaction
      });
      await queryInterface.removeIndex('products', 'idx_products_category_id', {
        transaction
      });
      await queryInterface.removeIndex('products', 'idx_products_status_category', {
        transaction
      });

      await queryInterface.removeIndex(
        'product_variants',
        'idx_product_variants_product_id',
        { transaction }
      );
      await queryInterface.removeIndex(
        'product_variants',
        'idx_product_variants_variant_type_id',
        { transaction }
      );
      await queryInterface.removeIndex('product_variants', 'idx_product_variants_value', {
        transaction
      });
      await queryInterface.removeIndex(
        'product_variants',
        'idx_product_variants_product_type',
        { transaction }
      );

      await queryInterface.removeIndex('variant_types', 'idx_variant_types_name', {
        transaction
      });

      await queryInterface.removeIndex(
        'variant_combinations',
        'idx_variant_combinations_product_id',
        { transaction }
      );
      await queryInterface.removeIndex(
        'variant_combinations',
        'idx_variant_combinations_is_active',
        { transaction }
      );

      await queryInterface.removeIndex(
        'variant_combination_variants',
        'idx_vcv_combination_id',
        { transaction }
      );
      await queryInterface.removeIndex(
        'variant_combination_variants',
        'idx_vcv_variant_id',
        { transaction }
      );

      await queryInterface.removeIndex('product_images', 'idx_product_images_product_id', {
        transaction
      });
      await queryInterface.removeIndex('product_images', 'idx_product_images_is_featured', {
        transaction
      });

      await queryInterface.removeIndex('categories', 'idx_categories_parent_id', {
        transaction
      });
      await queryInterface.removeIndex('categories', 'idx_categories_slug', {
        transaction
      });

      await transaction.commit();
      console.log('✓ All indexes removed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('✗ Error removing indexes:', error);
      throw error;
    }
  }
};