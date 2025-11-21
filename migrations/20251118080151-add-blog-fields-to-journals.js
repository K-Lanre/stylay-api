'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add new columns
    await queryInterface.addColumn('journals', 'excerpt', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Brief summary or teaser for the journal post'
    });

    await queryInterface.addColumn('journals', 'view_count', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of times this journal post has been viewed'
    });

    await queryInterface.addColumn('journals', 'featured_images', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of featured image objects with URLs and metadata'
    });

    await queryInterface.addColumn('journals', 'tags', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of tag strings for categorization and search'
    });

    await queryInterface.addColumn('journals', 'category', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Main category for the journal post'
    });

    // Remove the product_id column and its constraints
    await queryInterface.removeConstraint('journals', 'journals_ibfk_1');
    await queryInterface.removeIndex('journals', 'journals_product_id_idx');
    await queryInterface.removeColumn('journals', 'product_id');

    // Add new indexes
    await queryInterface.addIndex('journals', ['category']);
    await queryInterface.addIndex('journals', ['view_count']);
    await queryInterface.addIndex('journals', ['created_at']);
  },

  async down (queryInterface, Sequelize) {
    // Remove new columns
    await queryInterface.removeColumn('journals', 'excerpt');
    await queryInterface.removeColumn('journals', 'view_count');
    await queryInterface.removeColumn('journals', 'featured_images');
    await queryInterface.removeColumn('journals', 'tags');
    await queryInterface.removeColumn('journals', 'category');

    // Add back product_id column
    await queryInterface.addColumn('journals', 'product_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true
    });

    // Add back index and constraint
    await queryInterface.addIndex('journals', ['product_id'], { name: 'journals_product_id_idx' });
    await queryInterface.addConstraint('journals', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'journals_ibfk_1',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  }
};
