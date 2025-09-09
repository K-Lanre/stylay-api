'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('product_images', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      product_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      image_url: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('product_images', ['product_id'], { name: 'product_images_product_id_idx' });
    await queryInterface.addIndex('product_images', ['is_featured'], { name: 'product_images_is_featured_idx' });

    await queryInterface.addConstraint('product_images', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'product_images_ibfk_1',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('product_images');
  }
};