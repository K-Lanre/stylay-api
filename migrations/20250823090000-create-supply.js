'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('supply', {
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
      quantity_supplied: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      supply_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('supply', ['vendor_id'], { name: 'supply_vendor_id_idx' });
    await queryInterface.addIndex('supply', ['product_id'], { name: 'supply_product_id_idx' });

    await queryInterface.addConstraint('supply', {
      type: 'foreign key',
      fields: ['vendor_id'],
      name: 'supply_ibfk_1',
      references: {
        table: 'vendors',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('supply', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'supply_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('supply');
  }
};