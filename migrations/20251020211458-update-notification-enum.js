'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Update the notification type enum to include new order-related notification types
    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM(
        'welcome',
        'order_process',
        'maintenance',
        'policy_update',
        'delay_apology',
        'success',
        'apology',
        'order_created',
        'order_received',
        'order_cancelled',
        'order_shipped',
        'order_delivered'
      ),
      allowNull: false
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert to the original enum values
    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM(
        'welcome',
        'order_process',
        'maintenance',
        'policy_update',
        'delay_apology',
        'success',
        'apology'
      ),
      allowNull: false
    });
  }
};
