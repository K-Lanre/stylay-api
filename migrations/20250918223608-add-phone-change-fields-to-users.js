'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'pending_phone_number', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'phone_change_requested_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'phone_change_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'phone_change_token_expires', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'pending_phone_number');
    await queryInterface.removeColumn('users', 'phone_change_requested_at');
    await queryInterface.removeColumn('users', 'phone_change_token');
    await queryInterface.removeColumn('users', 'phone_change_token_expires');
  }
};
