'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('collection_products', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      collection_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('collection_products', ['collection_id', 'product_id'], { name: 'collection_products_collection_product_idx', unique: true });
    await queryInterface.addIndex('collection_products', ['product_id'], { name: 'product_id' });

    await queryInterface.addConstraint('collection_products', {
      type: 'foreign key',
      fields: ['collection_id'],
      name: 'collection_products_ibfk_1',
      references: {
        table: 'collections',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('collection_products', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'collection_products_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('collection_products');
  }
};