'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'email_verification_token_expires', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'email_verification_token'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'email_verification_token_expires');
  }
};
