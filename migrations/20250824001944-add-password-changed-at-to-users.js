'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'password_changed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when the user last changed their password'
    });
    
    // Set initial value for existing users (optional)
    await queryInterface.sequelize.query(
      "UPDATE users SET password_changed_at = updated_at WHERE password_changed_at IS NULL"
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'password_changed_at');
  }
};
