'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'stock');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'stock', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  }
};
