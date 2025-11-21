'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn('product_variants', 'additional_price');
    await queryInterface.removeColumn('product_variants', 'stock');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn('product_variants', 'additional_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });
    await queryInterface.addColumn('product_variants', 'stock', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  }
};
