'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, drop the default constraints on the timestamp columns
    await queryInterface.sequelize.query(
      'ALTER TABLE payment_transactions ALTER COLUMN created_at DROP DEFAULT;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE payment_transactions ALTER COLUMN updated_at DROP DEFAULT;'
    );
    
    // Then update the columns to allow NULL temporarily
    await queryInterface.changeColumn('payment_transactions', 'created_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.changeColumn('payment_transactions', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert the changes if needed
    await queryInterface.changeColumn('payment_transactions', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    
    await queryInterface.changeColumn('payment_transactions', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });
  }
};
