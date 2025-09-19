'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, check if the column exists
    const [results] = await queryInterface.sequelize.query(
      `SHOW COLUMNS FROM orders LIKE 'address_id'`
    );

    // If the column exists, remove it
    if (results.length > 0) {
      await queryInterface.removeColumn('orders', 'address_id');
    }
  },

  async down(queryInterface, Sequelize) {
    // No need to add the column back as it's not needed
  }
};
