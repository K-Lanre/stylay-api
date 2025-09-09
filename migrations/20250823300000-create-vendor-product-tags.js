'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vendor_product_tags', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      vendor_id: {
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

    await queryInterface.addIndex('vendor_product_tags', ['vendor_id', 'product_id'], { name: 'vendor_product_tags_vendor_product_idx', unique: true });
    await queryInterface.addIndex('vendor_product_tags', ['product_id'], { name: 'vendor_product_tags_product_id_fk' });

    await queryInterface.addConstraint('vendor_product_tags', {
      type: 'foreign key',
      fields: ['vendor_id'],
      name: 'vendor_product_tags_ibfk_1',
      references: {
        table: 'vendors',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('vendor_product_tags', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'vendor_product_tags_product_id_fk',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vendor_product_tags');
  }
};