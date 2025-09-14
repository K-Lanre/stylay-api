'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('order_details', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      address_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('order_details', ['order_id'], { name: 'order_details_order_id_idx' });
    await queryInterface.addIndex('order_details', ['address_id'], { name: 'order_details_address_id_idx' });

    await queryInterface.addConstraint('order_details', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'order_details_ibfk_1',
      references: {
        table: 'orders',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('order_details', {
      type: 'foreign key',
      fields: ['address_id'],
      name: 'order_details_ibfk_2',
      references: {
        table: 'addresses',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('order_details');
  }
};