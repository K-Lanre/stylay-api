'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('cart_items', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Optional notes for the cart item'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('cart_items', 'notes');
  }
};
