'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add the combination_id column to the supply table
    await queryInterface.addColumn('supply', 'combination_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'variant_combinations',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // Add index for better query performance
    await queryInterface.addIndex('supply', ['combination_id'], {
      name: 'supply_combination_id_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the foreign key constraint first
    await queryInterface.removeConstraint('supply', 'supply_combination_id_foreign');

    // Remove the index
    await queryInterface.removeIndex('supply', 'supply_combination_id_idx');

    // Remove the column
    await queryInterface.removeColumn('supply', 'combination_id');
  }
};
