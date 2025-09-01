'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      vendor_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },
      address_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      order_status: {
        type: Sequelize.ENUM('processing', 'dispatched', 'delayed', 'success'),
        allowNull: false,
        defaultValue: 'processing'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('orders', ['user_id'], { name: 'orders_user_id_idx' });
    await queryInterface.addIndex('orders', ['vendor_id'], { name: 'orders_vendor_id_idx' });
    await queryInterface.addIndex('orders', ['payment_status'], { name: 'orders_payment_status_idx' });
    await queryInterface.addIndex('orders', ['order_status'], { name: 'orders_order_status_idx' });
    await queryInterface.addIndex('orders', ['address_id'], { name: 'address_id' });

    await queryInterface.addConstraint('orders', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'orders_ibfk_1',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('orders', {
      type: 'foreign key',
      fields: ['vendor_id'],
      name: 'orders_ibfk_2',
      references: {
        table: 'vendors',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('orders', {
      type: 'foreign key',
      fields: ['address_id'],
      name: 'orders_ibfk_3',
      references: {
        table: 'addresses',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('orders');
  }
};