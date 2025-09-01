'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payment_transactions', {
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
      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('payment', 'payout', 'refund', 'commission', 'adjustment'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false
      },
      transaction_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex('payment_transactions', ['user_id'], { name: 'transactions_user_id_idx' });
    await queryInterface.addIndex('payment_transactions', ['order_id'], { name: 'transactions_order_id_idx' });

    await queryInterface.addConstraint('payment_transactions', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'payment_transactions_ibfk_1',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('payment_transactions', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'payment_transactions_ibfk_2',
      references: {
        table: 'orders',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('payment_transactions');
  }
};