'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('suggested_products', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID of authenticated user (null for public suggestions)'
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID of suggested product'
      },
      suggestion_type: {
        type: Sequelize.ENUM('followed_vendor', 'random', 'recently_viewed', 'popular'),
        allowNull: false,
        defaultValue: 'random',
        comment: 'Type of suggestion algorithm used'
      },
      score: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        comment: 'Relevance score (0.0000 - 1.0000)'
      },
      context: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional context about the suggestion'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for better performance
    await queryInterface.addIndex('suggested_products', ['user_id']);
    await queryInterface.addIndex('suggested_products', ['product_id']);
    await queryInterface.addIndex('suggested_products', ['suggestion_type']);
    await queryInterface.addIndex('suggested_products', ['user_id', 'suggestion_type']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('suggested_products');
  }
};