'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notification_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      notification_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      },
      item_details: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string with additional item details'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('notification_items', ['notification_id'], { name: 'notification_items_notification_id_idx' });

    await queryInterface.addConstraint('notification_items', {
      type: 'foreign key',
      fields: ['notification_id'],
      name: 'notification_items_ibfk_1',
      references: {
        table: 'notifications',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('notification_items');
  }
};