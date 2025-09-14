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
      order_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.STRING,
        allowNull: true
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      order_status: {
        type: Sequelize.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('orders', ['user_id'], { name: 'orders_user_id_idx' });
    await queryInterface.addIndex('orders', ['payment_status'], { name: 'orders_payment_status_idx' });
    await queryInterface.addIndex('orders', ['order_status'], { name: 'orders_order_status_idx' });

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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('orders');
  }
};