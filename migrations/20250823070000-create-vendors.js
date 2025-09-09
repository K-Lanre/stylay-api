'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vendors', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true
      },
      store_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true
      },
      join_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      total_sales: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
      },
      total_earnings: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
      },
      last_payment_date: {
        type: Sequelize.DATE,
        allowNull: true
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
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'registration_complete'),
        allowNull: false,
        defaultValue: 'pending'
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      approved_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      }
    });

    await queryInterface.addIndex('vendors', ['approved_by'], { name: 'vendors_approved_by_foreign_idx' });

    await queryInterface.addConstraint('vendors', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'vendors_ibfk_1',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('vendors', {
      type: 'foreign key',
      fields: ['store_id'],
      name: 'vendors_ibfk_2',
      references: {
        table: 'stores',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('vendors', {
      type: 'foreign key',
      fields: ['approved_by'],
      name: 'vendors_approved_by_foreign_idx',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vendors');
  }
};