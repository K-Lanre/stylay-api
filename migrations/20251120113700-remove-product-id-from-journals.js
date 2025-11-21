'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if product_id column exists in journals table
    const tableDescription = await queryInterface.describeTable('journals');

    if (tableDescription.product_id) {
      console.log('Removing product_id column from journals table...');

      // Remove the foreign key constraint first
      try {
        await queryInterface.removeConstraint('journals', 'journals_ibfk_1');
        console.log('Removed foreign key constraint journals_ibfk_1');
      } catch (error) {
        console.log('Foreign key constraint journals_ibfk_1 not found or already removed');
      }

      // Remove the index
      try {
        await queryInterface.removeIndex('journals', 'journals_product_id_idx');
        console.log('Removed index journals_product_id_idx');
      } catch (error) {
        console.log('Index journals_product_id_idx not found or already removed');
      }

      // Remove the column
      await queryInterface.removeColumn('journals', 'product_id');
      console.log('Successfully removed product_id column from journals table');
    } else {
      console.log('product_id column does not exist in journals table - skipping removal');
    }
  },

  async down (queryInterface, Sequelize) {
    // Add back the product_id column
    await queryInterface.addColumn('journals', 'product_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true
    });

    // Add back the index
    await queryInterface.addIndex('journals', ['product_id'], { name: 'journals_product_id_idx' });

    // Add back the foreign key constraint
    await queryInterface.addConstraint('journals', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'journals_ibfk_1',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  }
};
