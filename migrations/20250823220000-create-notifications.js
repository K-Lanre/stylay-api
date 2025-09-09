'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notifications', {
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
      type: {
        type: Sequelize.ENUM('welcome', 'order_process', 'maintenance', 'policy_update', 'delay_apology', 'success', 'apology'),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      is_read: {
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

    await queryInterface.addIndex('notifications', ['user_id'], { name: 'notifications_user_id_idx' });
    await queryInterface.addIndex('notifications', ['is_read'], { name: 'notifications_is_read_idx' });

    await queryInterface.addConstraint('notifications', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'notifications_ibfk_1',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('notifications');
  }
};