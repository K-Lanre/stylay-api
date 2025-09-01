'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('oversight_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      admin_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      functionality: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Functionality being monitored (e.g., vendor_management)'
      },
      action: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Description of the action taken'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('oversight_logs', ['admin_id'], { name: 'oversight_logs_admin_id_idx' });
    await queryInterface.addIndex('oversight_logs', ['functionality'], { name: 'oversight_logs_functionality_idx' });

    await queryInterface.addConstraint('oversight_logs', {
      type: 'foreign key',
      fields: ['admin_id'],
      name: 'oversight_logs_ibfk_1',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('oversight_logs');
  }
};